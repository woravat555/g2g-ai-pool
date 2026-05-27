// =============================================================
// MOAC Platform — Google Sheets Sync Web App
// Deploy: Apps Script → New deployment → Web app → "Anyone"
// Execute as: ME (script owner) — writes to the active spreadsheet
// Companion Node module: scripts/moac-sheets-sync.js
// =============================================================

const API_KEY = 'MOAC_SYNC_KEY_2026'; // change here + on Fly (MOAC_SYNC_KEY) to rotate
const MAX_BODY_BYTES = 50 * 1024;     // 50KB hard cap per request
const LIST_LIMIT_DEFAULT = 100;
const LIST_LIMIT_MAX = 500;
const LOCK_WAIT_MS = 5000;

// Schema (also enforced on auto-create header row)
const SCHEMAS = {
  tasks:     ['id','from','fromName','to','toName','title','detail','priority','status','created','updated'],
  reports:   ['id','from','fromName','fromLevel','toLevel','title','summary','dataJson','created'],
  kpis:      ['id','dept','metric','value','target','asOf','source'],
  audit_log: ['ts','action','actor','target','payload'],
};
const TAB_NAMES = { tasks:'Tasks', reports:'Reports', kpis:'KPIs', audit_log:'AuditLog' };

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _err(msg, extra) {
  const out = { ok: false, error: String(msg) };
  if (extra) Object.assign(out, extra);
  return _json(out);
}

function _authOk(e) {
  const key = (e && e.parameter && e.parameter.key) || '';
  return key === API_KEY;
}

function _getSheet(table) {
  const tabName = TAB_NAMES[table];
  if (!tabName) return null;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
    sh.appendRow(SCHEMAS[table]);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(SCHEMAS[table]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _recordToRow(table, record) {
  const cols = SCHEMAS[table];
  return cols.map(function(c) {
    let v = record[c];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v); // dataJson, payload, etc
    return v;
  });
}

function _rowToObject(table, row) {
  const cols = SCHEMAS[table];
  const obj = {};
  for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
  return obj;
}

function _findRowById(sh, idValue) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues(); // col 1 = id
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(idValue)) return i + 2; // 1-indexed + header
  }
  return -1;
}

function doPost(e) {
  if (!_authOk(e)) return _err('unauthorized');

  let body;
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (!raw) return _err('empty_body');
    if (raw.length > MAX_BODY_BYTES) return _err('payload_too_large', { bytes: raw.length, max: MAX_BODY_BYTES });
    body = JSON.parse(raw);
  } catch (err) {
    return _err('invalid_json: ' + err.message);
  }

  const action = body.action;
  const table = body.table;
  const record = body.record || {};

  if (!action) return _err('missing_action');
  if (!table || !SCHEMAS[table]) return _err('invalid_table', { table: table, allowed: Object.keys(SCHEMAS) });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (err) {
    return _err('lock_timeout');
  }

  try {
    const sh = _getSheet(table);
    if (!sh) return _err('sheet_unavailable');

    if (action === 'append') {
      const row = _recordToRow(table, record);
      sh.appendRow(row);
      return _json({ ok: true, action: 'append', table: table, row: sh.getLastRow() });
    }

    if (action === 'update') {
      const id = record.id;
      if (!id) return _err('missing_id_for_update');
      const rowIdx = _findRowById(sh, id);
      if (rowIdx === -1) return _err('not_found', { id: id });
      // Merge: read existing row, overlay non-empty record fields
      const cols = SCHEMAS[table];
      const existing = sh.getRange(rowIdx, 1, 1, cols.length).getValues()[0];
      const merged = {};
      for (let i = 0; i < cols.length; i++) merged[cols[i]] = existing[i];
      Object.keys(record).forEach(function(k) {
        if (record[k] !== undefined) merged[k] = record[k];
      });
      if (cols.indexOf('updated') >= 0) merged.updated = new Date().toISOString();
      const newRow = _recordToRow(table, merged);
      sh.getRange(rowIdx, 1, 1, cols.length).setValues([newRow]);
      return _json({ ok: true, action: 'update', table: table, row: rowIdx });
    }

    if (action === 'delete') {
      const id = record.id;
      if (!id) return _err('missing_id_for_delete');
      const rowIdx = _findRowById(sh, id);
      if (rowIdx === -1) return _err('not_found', { id: id });
      sh.deleteRow(rowIdx);
      return _json({ ok: true, action: 'delete', table: table, row: rowIdx });
    }

    if (action === 'list') {
      return _json(_listRows(sh, table, body.query || {}));
    }

    return _err('invalid_action', { action: action });
  } catch (err) {
    return _err('exception: ' + err.message, { stack: err.stack || null });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function doGet(e) {
  // doGet is convenient for List + health check (and to receive 302 redirected response)
  if (!_authOk(e)) {
    return _json({ ok: true, service: 'MOAC Sheets Sync', version: '1.0' });
  }
  const p = (e && e.parameter) || {};
  const table = p.table;
  if (!table) return _json({ ok: true, service: 'MOAC Sheets Sync', authenticated: true });
  if (!SCHEMAS[table]) return _err('invalid_table');
  const sh = _getSheet(table);
  if (!sh) return _err('sheet_unavailable');
  return _json(_listRows(sh, table, p));
}

function _listRows(sh, table, q) {
  const cols = SCHEMAS[table];
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, table: table, count: 0, rows: [] };
  const limit = Math.min(parseInt(q.limit || LIST_LIMIT_DEFAULT, 10) || LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX);
  const all = sh.getRange(2, 1, lastRow - 1, cols.length).getValues();
  let rows = all.map(function(r) { return _rowToObject(table, r); });
  // Optional filters
  ['from','to','status','fromLevel','toLevel','dept','actor','action'].forEach(function(f) {
    if (q[f] && cols.indexOf(f) >= 0) {
      rows = rows.filter(function(r) { return String(r[f]) === String(q[f]); });
    }
  });
  // Newest last in sheet; return newest first
  rows = rows.slice(-limit).reverse();
  return { ok: true, table: table, count: rows.length, rows: rows };
}
