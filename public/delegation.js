/**
 * G2G Delegation System v1.0
 * ระบบมอบหมายงาน + อนุมัติ 7 วัน
 * ใช้ได้กับทุก management page — inject <script src="/delegation.js"></script>
 *
 * Flow:
 *   Agency Head → สร้าง Staff Code สูงสุด 10 ชุด
 *   Staff → ใส่ Code → Draft Mode (แก้ไขได้, แต่ยังไม่บันทึกจริง)
 *   Server intercept → เก็บเป็น Pending Change
 *   Agency Head → อนุมัติ/ปฏิเสธ (Web + LINE Quick Reply)
 *   ถ้าไม่อนุมัติใน 7 วัน → ระบบกลับสภาพเดิม
 */

(function () {
  'use strict';

  /* ── CONFIG ── */
  const API = '';            // same origin
  const STORAGE_KEY = 'g2g_delegation';

  /* ── STATE ── */
  let state = {
    role: null,              // 'head' | 'staff' | null
    staffCode: null,
    staffName: null,
    agencySlug: detectSlug(),
    adminCode: null,
    pendingCount: 0,
  };

  /* ── DETECT SLUG FROM URL ── */
  function detectSlug() {
    const path = window.location.pathname;
    const m = path.match(/management-([^.]+)\.html/);
    return m ? m[1] : 'unknown';
  }

  /* ── DETECT PAGE TITLE ── */
  function detectPageTitle() {
    return document.title || state.agencySlug;
  }

  /* ── INIT ── */
  function init() {
    injectStyles();
    renderButton();

    // restore session
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      if (saved.role) {
        state = { ...state, ...saved };
        applyDraftMode();
        refreshPendingBadge();
      }
    } catch (e) {}

    // HEAD auto-refresh pending count every 30s
    setInterval(() => {
      if (state.role === 'head') refreshPendingBadge();
    }, 30000);
  }

  /* ─────────────────────────────────────────────
     STYLES
  ───────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('deleg-styles')) return;
    const s = document.createElement('style');
    s.id = 'deleg-styles';
    s.textContent = `
      #deleg-fab {
        position: fixed; bottom: 24px; right: 24px; z-index: 9000;
        width: 52px; height: 52px; border-radius: 50%;
        background: linear-gradient(135deg,#1e40af,#7c3aed);
        color: #fff; font-size: 22px; border: none; cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        transition: transform .2s;
      }
      #deleg-fab:hover { transform: scale(1.1); }
      #deleg-badge {
        position: absolute; top: -4px; right: -4px;
        background: #ef4444; color: #fff;
        font-size: 11px; font-weight: 700;
        min-width: 18px; height: 18px; border-radius: 9px;
        display: flex; align-items: center; justify-content: center;
        padding: 0 4px;
      }
      #deleg-panel {
        position: fixed; bottom: 90px; right: 24px; z-index: 9001;
        width: 400px; max-height: 80vh; overflow-y: auto;
        background: #0f172a; border: 1px solid #334155;
        border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        font-family: 'Sarabun', sans-serif; font-size: 14px; color: #e2e8f0;
        display: none;
      }
      #deleg-panel.open { display: block; }
      .dp-header {
        background: linear-gradient(135deg,#1e40af,#7c3aed);
        padding: 14px 18px; border-radius: 12px 12px 0 0;
        display: flex; align-items: center; justify-content: space-between;
      }
      .dp-header h3 { margin: 0; font-size: 15px; font-weight: 700; }
      .dp-close { background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; line-height: 1; }
      .dp-body { padding: 18px; }
      .dp-tab-row { display: flex; gap: 0; border-bottom: 1px solid #334155; margin-bottom: 16px; }
      .dp-tab {
        padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
        border-bottom: 2px solid transparent; color: #64748b; white-space: nowrap;
      }
      .dp-tab.active { color: #a78bfa; border-bottom-color: #a78bfa; }
      .dp-section { display: none; }
      .dp-section.active { display: block; }
      .dp-input {
        width: 100%; padding: 9px 12px; background: #1e293b; border: 1px solid #334155;
        border-radius: 7px; color: #e2e8f0; font-size: 14px; margin-bottom: 10px;
        font-family: inherit; box-sizing: border-box;
      }
      .dp-input:focus { outline: none; border-color: #7c3aed; }
      .dp-btn {
        padding: 9px 18px; border-radius: 7px; font-size: 13px; font-weight: 700;
        cursor: pointer; border: none; transition: opacity .2s;
      }
      .dp-btn:hover { opacity: .85; }
      .dp-btn-primary { background: #7c3aed; color: #fff; }
      .dp-btn-success { background: #10b981; color: #fff; }
      .dp-btn-danger  { background: #ef4444; color: #fff; }
      .dp-btn-ghost   { background: #334155; color: #e2e8f0; }
      .dp-msg { padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 10px; }
      .dp-msg-ok  { background: #064e3b; color: #6ee7b7; border-left: 3px solid #10b981; }
      .dp-msg-err { background: #450a0a; color: #fca5a5; border-left: 3px solid #ef4444; }
      .dp-msg-warn{ background: #451a03; color: #fed7aa; border-left: 3px solid #f97316; }

      .code-card {
        background: #1e293b; border: 1px solid #334155; border-radius: 8px;
        padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px;
      }
      .code-val { font-family: monospace; font-size: 15px; font-weight: 700; color: #a78bfa; flex: 1; }
      .code-name { font-size: 12px; color: #94a3b8; }
      .code-revoke { background: #ef4444; color: #fff; border: none; padding: 4px 10px; border-radius: 5px; font-size: 12px; cursor: pointer; }

      .change-card {
        background: #1e293b; border: 1px solid #334155; border-radius: 8px;
        padding: 12px 14px; margin-bottom: 10px;
      }
      .change-meta { font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
      .change-desc { font-size: 13px; margin-bottom: 10px; line-height: 1.5; }
      .change-diff { background: #0f172a; padding: 8px 10px; border-radius: 5px; font-size: 12px; font-family: monospace; margin-bottom: 10px; }
      .diff-old { color: #f87171; text-decoration: line-through; }
      .diff-new { color: #6ee7b7; }
      .change-actions { display: flex; gap: 8px; }
      .change-expire { font-size: 11px; color: #f97316; margin-bottom: 6px; }

      /* Draft mode banner */
      #deleg-draft-banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 8999;
        background: linear-gradient(90deg,#7c3aed,#1d4ed8);
        color: #fff; padding: 8px 20px; font-size: 13px; font-weight: 600;
        display: flex; align-items: center; gap: 12px; justify-content: center;
      }
      #deleg-draft-banner .draft-submit {
        background: #fff; color: #7c3aed; padding: 4px 14px;
        border-radius: 5px; font-weight: 700; font-size: 12px;
        border: none; cursor: pointer; margin-left: 8px;
      }
      #deleg-draft-banner .draft-exit {
        background: rgba(255,255,255,0.2); color: #fff; padding: 4px 10px;
        border-radius: 5px; font-size: 12px; border: none; cursor: pointer;
      }

      /* Highlight editable in draft mode */
      body.deleg-draft-mode [data-deleg-field] {
        outline: 2px dashed #7c3aed; outline-offset: 2px;
        cursor: pointer;
      }
      body.deleg-draft-mode [data-deleg-field]:hover {
        background: rgba(124,58,237,0.08);
      }
    `;
    document.head.appendChild(s);
  }

  /* ─────────────────────────────────────────────
     FAB BUTTON
  ───────────────────────────────────────────── */
  function renderButton() {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-block';

    const fab = document.createElement('button');
    fab.id = 'deleg-fab';
    fab.title = 'ระบบมอบหมายงาน';
    fab.innerHTML = '👥';
    fab.onclick = togglePanel;

    const badge = document.createElement('span');
    badge.id = 'deleg-badge';
    badge.style.display = 'none';

    wrap.appendChild(fab);
    wrap.appendChild(badge);
    document.body.appendChild(wrap);
    renderPanel();
  }

  /* ─────────────────────────────────────────────
     PANEL
  ───────────────────────────────────────────── */
  function renderPanel() {
    const panel = document.createElement('div');
    panel.id = 'deleg-panel';
    panel.innerHTML = `
      <div class="dp-header">
        <h3>👥 ระบบมอบหมายงาน</h3>
        <button class="dp-close" onclick="document.getElementById('deleg-panel').classList.remove('open')">✕</button>
      </div>
      <div class="dp-body">
        <div class="dp-tab-row">
          <div class="dp-tab active" onclick="dpTab('head')">🏛️ หัวหน้า</div>
          <div class="dp-tab" onclick="dpTab('staff')">👤 เจ้าหน้าที่</div>
          <div class="dp-tab" onclick="dpTab('pending')">⏳ Pending <span id="dp-pending-count"></span></div>
        </div>

        <!-- AGENCY HEAD TAB -->
        <div id="dp-sec-head" class="dp-section active">
          <div id="dp-head-auth">
            <p style="font-size:13px;color:#94a3b8;margin-bottom:12px;">เข้าสู่โหมดหัวหน้าหน่วยงาน — ป้อนรหัสผู้ดูแล</p>
            <input id="dp-admin-code" class="dp-input" type="password" placeholder="Admin Code" onkeydown="if(event.key==='Enter')dpHeadLogin()"/>
            <button class="dp-btn dp-btn-primary" onclick="dpHeadLogin()" style="width:100%">เข้าสู่ระบบ</button>
            <div id="dp-head-msg"></div>
          </div>
          <div id="dp-head-panel" style="display:none">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
              <span style="font-size:13px;color:#6ee7b7;font-weight:700;">✅ เข้าสู่ระบบแล้ว</span>
              <button class="dp-btn dp-btn-ghost" onclick="dpHeadLogout()" style="padding:4px 10px;font-size:12px;">ออกจากระบบ</button>
            </div>

            <p style="font-size:13px;font-weight:700;margin-bottom:10px;">สร้าง Code ให้เจ้าหน้าที่ (<span id="dp-code-count">0</span>/10)</p>
            <input id="dp-staff-name-input" class="dp-input" type="text" placeholder="ชื่อเจ้าหน้าที่" style="margin-bottom:6px;"/>
            <button class="dp-btn dp-btn-success" onclick="dpCreateCode()" style="width:100%;margin-bottom:14px;">+ สร้าง Code ใหม่</button>
            <div id="dp-code-list"></div>
          </div>
        </div>

        <!-- STAFF TAB -->
        <div id="dp-sec-staff" class="dp-section">
          <div id="dp-staff-auth">
            <p style="font-size:13px;color:#94a3b8;margin-bottom:12px;">เจ้าหน้าที่ป้อน Code ที่ได้รับจากหัวหน้า</p>
            <input id="dp-staff-code" class="dp-input" type="text" placeholder="Staff Code (เช่น XK7M2P)" style="text-transform:uppercase;letter-spacing:2px;" onkeydown="if(event.key==='Enter')dpStaffLogin()"/>
            <button class="dp-btn dp-btn-primary" onclick="dpStaffLogin()" style="width:100%">เข้าสู่ Draft Mode</button>
            <div id="dp-staff-msg"></div>
          </div>
          <div id="dp-staff-panel" style="display:none">
            <div class="dp-msg dp-msg-ok">✅ Draft Mode: <strong id="dp-staff-name-display"></strong><br/><small>การแก้ไขทั้งหมดจะรอการอนุมัติจากหัวหน้าภายใน 7 วัน</small></div>
            <button class="dp-btn dp-btn-danger" onclick="dpStaffLogout()" style="width:100%;margin-top:8px;">ออกจาก Draft Mode</button>
          </div>
        </div>

        <!-- PENDING CHANGES TAB -->
        <div id="dp-sec-pending" class="dp-section">
          <div id="dp-pending-list">
            <p style="font-size:13px;color:#94a3b8;">กำลังโหลด...</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  function togglePanel() {
    const panel = document.getElementById('deleg-panel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && state.role === 'head') {
      refreshPendingList();
    }
  }

  /* ─────────────────────────────────────────────
     TABS
  ───────────────────────────────────────────── */
  window.dpTab = function (tab) {
    document.querySelectorAll('.dp-tab').forEach((t, i) => {
      t.classList.toggle('active', ['head', 'staff', 'pending'][i] === tab);
    });
    ['head', 'staff', 'pending'].forEach(s => {
      const el = document.getElementById('dp-sec-' + s);
      if (el) el.classList.toggle('active', s === tab);
    });
    if (tab === 'pending') refreshPendingList();
  };

  /* ─────────────────────────────────────────────
     AGENCY HEAD AUTH
  ───────────────────────────────────────────── */
  window.dpHeadLogin = async function () {
    const code = document.getElementById('dp-admin-code').value.trim();
    const msg = document.getElementById('dp-head-msg');
    if (!code) { showMsg(msg, 'กรุณาใส่ Admin Code', 'err'); return; }

    try {
      const r = await fetch(`${API}/api/delegation/head/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: code, agencySlug: state.agencySlug }),
      });
      const d = await r.json();
      if (!d.ok) { showMsg(msg, d.error || 'Code ไม่ถูกต้อง', 'err'); return; }

      state.role = 'head';
      state.adminCode = code;
      saveSession();
      showHeadPanel();
      refreshCodeList();
      refreshPendingBadge();
    } catch (e) {
      showMsg(msg, 'เชื่อมต่อไม่ได้: ' + e.message, 'err');
    }
  };

  window.dpHeadLogout = function () {
    state.role = null; state.adminCode = null;
    clearSession();
    document.getElementById('dp-head-auth').style.display = '';
    document.getElementById('dp-head-panel').style.display = 'none';
    document.getElementById('dp-admin-code').value = '';
  };

  function showHeadPanel() {
    document.getElementById('dp-head-auth').style.display = 'none';
    document.getElementById('dp-head-panel').style.display = '';
  }

  /* ─────────────────────────────────────────────
     STAFF AUTH
  ───────────────────────────────────────────── */
  window.dpStaffLogin = async function () {
    const code = document.getElementById('dp-staff-code').value.trim().toUpperCase();
    const msg = document.getElementById('dp-staff-msg');
    if (!code) { showMsg(msg, 'กรุณาใส่ Staff Code', 'err'); return; }

    try {
      const r = await fetch(`${API}/api/delegation/staff/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffCode: code, agencySlug: state.agencySlug }),
      });
      const d = await r.json();
      if (!d.ok) { showMsg(msg, d.error || 'Code ไม่ถูกต้อง', 'err'); return; }

      state.role = 'staff';
      state.staffCode = code;
      state.staffName = d.staffName;
      saveSession();
      applyDraftMode();

      document.getElementById('dp-staff-auth').style.display = 'none';
      document.getElementById('dp-staff-panel').style.display = '';
      document.getElementById('dp-staff-name-display').textContent = d.staffName;
      document.getElementById('deleg-panel').classList.remove('open');
    } catch (e) {
      showMsg(msg, 'เชื่อมต่อไม่ได้: ' + e.message, 'err');
    }
  };

  window.dpStaffLogout = function () {
    state.role = null; state.staffCode = null; state.staffName = null;
    clearSession();
    exitDraftMode();
    document.getElementById('dp-staff-auth').style.display = '';
    document.getElementById('dp-staff-panel').style.display = 'none';
    document.getElementById('dp-staff-code').value = '';
  };

  /* ─────────────────────────────────────────────
     DRAFT MODE
  ───────────────────────────────────────────── */
  function applyDraftMode() {
    if (state.role !== 'staff') return;

    document.body.classList.add('deleg-draft-mode');

    // Show draft banner
    if (!document.getElementById('deleg-draft-banner')) {
      const banner = document.createElement('div');
      banner.id = 'deleg-draft-banner';
      banner.innerHTML = `
        ✏️ Draft Mode — <strong>${state.staffName || 'เจ้าหน้าที่'}</strong>&nbsp;
        การแก้ไขทั้งหมดจะรอการอนุมัติจากหัวหน้าหน่วยงาน (7 วัน)
        <button class="draft-exit" onclick="dpStaffLogout()">ออก</button>
      `;
      document.body.prepend(banner);
    }

    // Intercept fetch — add staff code header
    if (!window._delegOrigFetch) {
      window._delegOrigFetch = window.fetch;
      window.fetch = function (url, opts = {}) {
        if (state.role === 'staff' && state.staffCode) {
          const isWrite = opts.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(opts.method.toUpperCase());
          const isApi = typeof url === 'string' && (url.includes('/api/') || url.startsWith('/'));
          if (isWrite && isApi) {
            opts.headers = opts.headers || {};
            opts.headers['X-Staff-Code'] = state.staffCode;
            opts.headers['X-Agency-Slug'] = state.agencySlug;
          }
        }
        return window._delegOrigFetch.apply(this, arguments);
      };
    }
  }

  function exitDraftMode() {
    document.body.classList.remove('deleg-draft-mode');
    const banner = document.getElementById('deleg-draft-banner');
    if (banner) banner.remove();
    // restore original fetch
    if (window._delegOrigFetch) {
      window.fetch = window._delegOrigFetch;
      delete window._delegOrigFetch;
    }
  }

  /* ─────────────────────────────────────────────
     CODE MANAGEMENT (Agency Head)
  ───────────────────────────────────────────── */
  window.dpCreateCode = async function () {
    const nameEl = document.getElementById('dp-staff-name-input');
    const name = nameEl.value.trim();
    if (!name) { alert('กรุณาใส่ชื่อเจ้าหน้าที่'); return; }

    const r = await fetch(`${API}/api/delegation/codes/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode: state.adminCode, agencySlug: state.agencySlug, staffName: name }),
    });
    const d = await r.json();
    if (d.ok) {
      nameEl.value = '';
      refreshCodeList();
    } else {
      alert(d.error || 'สร้าง Code ไม่ได้');
    }
  };

  window.dpRevokeCode = async function (code) {
    if (!confirm(`ยกเลิก Code: ${code} ?`)) return;
    const r = await fetch(`${API}/api/delegation/codes/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode: state.adminCode, agencySlug: state.agencySlug, staffCode: code }),
    });
    const d = await r.json();
    if (d.ok) refreshCodeList();
  };

  async function refreshCodeList() {
    const list = document.getElementById('dp-code-list');
    if (!list || state.role !== 'head') return;
    try {
      const r = await fetch(`${API}/api/delegation/codes/${state.agencySlug}?adminCode=${encodeURIComponent(state.adminCode)}`);
      const d = await r.json();
      const codes = d.codes || [];
      document.getElementById('dp-code-count').textContent = codes.length;
      list.innerHTML = codes.length === 0
        ? '<p style="font-size:13px;color:#64748b;">ยังไม่มี Code — สร้างเพื่อมอบให้เจ้าหน้าที่</p>'
        : codes.map(c => `
          <div class="code-card">
            <div>
              <div class="code-val">${c.code}</div>
              <div class="code-name">👤 ${c.staffName} · หมดอายุ ${new Date(c.expiresAt).toLocaleDateString('th-TH')}</div>
            </div>
            <button class="code-revoke" onclick="dpRevokeCode('${c.code}')">ยกเลิก</button>
          </div>
        `).join('');
    } catch (e) {
      list.innerHTML = '<p style="color:#f87171;font-size:12px;">โหลดไม่ได้: ' + e.message + '</p>';
    }
  }

  /* ─────────────────────────────────────────────
     PENDING CHANGES
  ───────────────────────────────────────────── */
  async function refreshPendingBadge() {
    try {
      const param = state.role === 'head' ? `adminCode=${encodeURIComponent(state.adminCode)}` : '';
      const r = await fetch(`${API}/api/delegation/changes/${state.agencySlug}/count?${param}`);
      const d = await r.json();
      const count = d.count || 0;
      state.pendingCount = count;
      const badge = document.getElementById('deleg-badge');
      const countEl = document.getElementById('dp-pending-count');
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
        if (countEl) countEl.textContent = `(${count})`;
      } else {
        badge.style.display = 'none';
        if (countEl) countEl.textContent = '';
      }
    } catch (e) {}
  }

  async function refreshPendingList() {
    const list = document.getElementById('dp-pending-list');
    if (!list) return;
    list.innerHTML = '<p style="font-size:13px;color:#94a3b8;">กำลังโหลด...</p>';

    try {
      const adminParam = state.adminCode ? `adminCode=${encodeURIComponent(state.adminCode)}` : '';
      const staffParam = state.staffCode ? `staffCode=${encodeURIComponent(state.staffCode)}` : '';
      const r = await fetch(`${API}/api/delegation/changes/${state.agencySlug}?${adminParam}&${staffParam}`);
      const d = await r.json();
      const changes = d.changes || [];

      if (changes.length === 0) {
        list.innerHTML = '<p style="font-size:13px;color:#64748b;text-align:center;padding:20px;">ไม่มีรายการรอดำเนินการ ✅</p>';
        return;
      }

      list.innerHTML = changes.map(c => {
        const expire = new Date(c.expiresAt);
        const hoursLeft = Math.round((expire - Date.now()) / 3600000);
        const isHead = state.role === 'head';
        return `
          <div class="change-card">
            <div class="change-meta">
              📋 Change ID: <strong>${c.changeId.slice(-8)}</strong> &nbsp;|&nbsp;
              👤 ${c.staffName} &nbsp;|&nbsp;
              🕒 ${new Date(c.submittedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
            <div class="change-expire">⏳ เหลือ ${hoursLeft > 0 ? hoursLeft + ' ชม.' : 'หมดเวลาแล้ว'} ก่อนยกเลิกอัตโนมัติ</div>
            <div class="change-desc">📝 <strong>${c.description}</strong></div>
            ${c.oldValue || c.newValue ? `
            <div class="change-diff">
              ${c.oldValue ? `<div class="diff-old">- ${c.oldValue}</div>` : ''}
              ${c.newValue ? `<div class="diff-new">+ ${c.newValue}</div>` : ''}
            </div>` : ''}
            ${isHead ? `
            <div class="change-actions">
              <button class="dp-btn dp-btn-success" onclick="dpApproveChange('${c.changeId}')">✅ อนุมัติ</button>
              <button class="dp-btn dp-btn-danger"  onclick="dpRejectChange('${c.changeId}')">❌ ปฏิเสธ</button>
            </div>` : `<span style="font-size:12px;color:#94a3b8;">⏳ รอหัวหน้าอนุมัติ</span>`}
          </div>
        `;
      }).join('');
    } catch (e) {
      list.innerHTML = '<p style="color:#f87171;font-size:12px;">โหลดไม่ได้: ' + e.message + '</p>';
    }
  }

  window.dpApproveChange = async function (changeId) {
    if (!confirm('อนุมัติการเปลี่ยนแปลงนี้?')) return;
    const r = await fetch(`${API}/api/delegation/changes/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeId, adminCode: state.adminCode, agencySlug: state.agencySlug }),
    });
    const d = await r.json();
    if (d.ok) { refreshPendingList(); refreshPendingBadge(); alert('อนุมัติแล้ว ✅\n' + (d.note || '')); }
    else alert('ผิดพลาด: ' + (d.error || 'unknown'));
  };

  window.dpRejectChange = async function (changeId) {
    const reason = prompt('เหตุผลที่ปฏิเสธ (ไม่บังคับ):') || '';
    const r = await fetch(`${API}/api/delegation/changes/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeId, adminCode: state.adminCode, agencySlug: state.agencySlug, reason }),
    });
    const d = await r.json();
    if (d.ok) { refreshPendingList(); refreshPendingBadge(); }
    else alert('ผิดพลาด: ' + (d.error || 'unknown'));
  };

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */
  function showMsg(el, text, type) {
    if (!el) return;
    el.innerHTML = `<div class="dp-msg dp-msg-${type}">${text}</div>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 4000);
  }

  function saveSession() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  /* ─────────────────────────────────────────────
     EXPOSE GLOBAL API (for management pages that want to submit changes manually)
  ───────────────────────────────────────────── */
  window.G2GDelegation = {
    submitChange: async function ({ description, oldValue, newValue, endpoint, method, body }) {
      if (state.role !== 'staff') return null;
      const r = await fetch(`${API}/api/delegation/changes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffCode: state.staffCode,
          agencySlug: state.agencySlug,
          description,
          oldValue: String(oldValue || ''),
          newValue: String(newValue || ''),
          endpoint: endpoint || '',
          method: method || 'POST',
          body: body || {},
        }),
      });
      return r.json();
    },
    isStaffMode: () => state.role === 'staff',
    isHeadMode: () => state.role === 'head',
    getStaffCode: () => state.staffCode,
  };

  /* ─────────────────────────────────────────────
     RESTORE HEAD SESSION (if role was head)
  ───────────────────────────────────────────── */
  if (state.role === 'head') {
    setTimeout(showHeadPanel, 0);
    setTimeout(refreshCodeList, 0);
  }

  /* ─────────────────────────────────────────────
     RUN
  ───────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
