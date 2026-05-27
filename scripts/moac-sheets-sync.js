// =============================================================
// MOAC Sheets Sync — Node-side wrapper
// Calls the Apps Script web-app (see scripts/moac-sheets-apps-script.gs)
// Handles the Apps Script 302 redirect pattern + retries.
//
// Env:
//   SHEETS_WEBHOOK_URL  (required) — the Apps Script /exec URL
//   MOAC_SYNC_KEY       (optional) — defaults to 'MOAC_SYNC_KEY_2026'
// Used by server.js  /api/moac/sheets-sync  routes.
// =============================================================

const TIMEOUT_MS = 8000;
const KEY = process.env.MOAC_SYNC_KEY || 'MOAC_SYNC_KEY_2026';
const URL_BASE = process.env.SHEETS_WEBHOOK_URL || '';

let _warned = false;
function _noopWarn() {
  if (_warned) return null;
  _warned = true;
  console.warn('[MOAC-SHEETS] SHEETS_WEBHOOK_URL not set — sync is a no-op. Set env on Fly to enable.');
  return null;
}

function _withKey(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}key=${encodeURIComponent(KEY)}`;
}

// Apps Script web apps respond with HTTP 302 to a googleusercontent.com URL
// that holds the actual JSON body. We POST manually, then GET the Location.
async function _callOnce(method, urlWithKey, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const init = {
      method,
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',
      signal: ctrl.signal,
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(urlWithKey, init);
    const loc = res.headers.get('location');
    if (loc) {
      const res2 = await fetch(loc, { method: 'GET', signal: ctrl.signal });
      const text = await res2.text();
      try { return JSON.parse(text); }
      catch { return { ok: false, error: 'non_json_response', raw: text.slice(0, 300) }; }
    }
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, error: 'non_json_response', raw: text.slice(0, 300) }; }
  } finally {
    clearTimeout(timer);
  }
}

async function _call(method, body, queryString) {
  if (!URL_BASE) return _noopWarn();
  let url = _withKey(URL_BASE);
  if (queryString) url += '&' + queryString;
  try {
    return await _callOnce(method, url, body);
  } catch (e1) {
    // One retry on network/timeout
    try {
      await new Promise(r => setTimeout(r, 400));
      return await _callOnce(method, url, body);
    } catch (e2) {
      console.error('[MOAC-SHEETS] network error after retry:', e2.message);
      return { ok: false, error: 'network_error', detail: e2.message };
    }
  }
}

export async function syncToSheets(action, table, record) {
  if (!['append','update','delete','list'].includes(action)) {
    throw new Error(`syncToSheets: invalid action "${action}"`);
  }
  if (!['tasks','reports','kpis','audit_log'].includes(table)) {
    throw new Error(`syncToSheets: invalid table "${table}"`);
  }
  return _call('POST', { action, table, record: record || {} });
}

export async function listFromSheets(table, query = {}) {
  if (!['tasks','reports','kpis','audit_log'].includes(table)) {
    throw new Error(`listFromSheets: invalid table "${table}"`);
  }
  const params = new URLSearchParams();
  params.set('table', table);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  return _call('GET', undefined, params.toString());
}

// Fire-and-forget helper used by /assign and /report routes — never throws,
// never blocks the response. Logs failures.
export function syncToSheetsAsync(action, table, record) {
  if (!URL_BASE) return;
  syncToSheets(action, table, record)
    .then(r => {
      if (r && r.ok === false) console.warn('[MOAC-SHEETS] sync failed:', r.error);
    })
    .catch(e => console.warn('[MOAC-SHEETS] sync threw:', e.message));
}

export function isConfigured() {
  return !!URL_BASE;
}
