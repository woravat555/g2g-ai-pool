/**
 * MoacApp — Comprehensive client-side enhancer for all moac-*.html pages.
 *
 * What it does (auto-runs on include):
 *   A. Detects current role from URL pathname (57 mapped roles)
 *   B. Auto-inits MoacDelegate (so 🌾 FAB works even on pages that forgot to call init)
 *   C. Injects a horizontal Quick-Action strip below the topbar
 *   D. Replaces mock KPI numbers in the overview tab with live values from /api/moac/*
 *   E. Injects a profile chip + 🔔 bell + 📥 inbox badge into the topbar
 *   F. Renders a real task list when "งานของฉัน" tab is clicked
 *   G. Renders a vertical workflow timeline for selected tasks
 *   H. Adds a "→ ส่งต่อให้: …" link at the bottom of the sidebar
 *   I. Wires Cmd+K / "/" / Cmd+/ / Esc shortcuts
 *   J. Autosaves any <textarea|input.lp-auto> to localStorage every 2s
 *   K. Logs a [MoacApp] bootstrap line for debugging
 *
 * Self-contained: tolerates missing MoacDelegate, missing endpoints, missing DOM
 * pieces. Falls back to existing mock data if /api/moac/* returns 404.
 */
(function () {
  'use strict';

  if (window.__MoacAppLoaded) {
    console.warn('[MoacApp] already loaded — skipping');
    return;
  }
  window.__MoacAppLoaded = true;

  // ────────────────────────────────────────────────────────────────────────
  // CONFIG + CONSTANTS
  // ────────────────────────────────────────────────────────────────────────
  const API_BASE = (function () {
    // Use the same host the page is served from. If it's localhost (dev), point
    // to the production Fly app as a safe fallback so /api/moac/* always works.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return location.origin; // assume local server.js on same host
    }
    return location.origin;
  })();
  const API = API_BASE + '/api/moac';
  const CACHE_TTL_MS = 60 * 1000;
  const cache = new Map(); // url → {ts, body}

  // ────────────────────────────────────────────────────────────────────────
  // ROLE MAP — 57 roles
  // ────────────────────────────────────────────────────────────────────────
  // Top of chain
  // minister → ps + dep-minister + minister-sec
  // ps → deputy-ps + ps-sec + ps-advisor + 15 dept heads
  // dep-minister → dep-minister-sec
  // deputy-ps → deputy-ps-sec
  // <dept-head> → <dept>-deputy + <dept>-staff
  // <dept>-deputy → <dept>-staff
  // <dept>-staff → (no one)
  const DEPTS = [
    { code: 'ops',  name: 'สป.กษ.' },
    { code: 'doae', name: 'กรมส่งเสริมการเกษตร' },
    { code: 'cpd',  name: 'กรมส่งเสริมสหกรณ์' },
    { code: 'cad',  name: 'กรมตรวจบัญชีสหกรณ์' },
    { code: 'dld',  name: 'กรมปศุสัตว์' },
    { code: 'dof',  name: 'กรมประมง' },
    { code: 'rd',   name: 'กรมการข้าว' },
    { code: 'doa',  name: 'กรมวิชาการเกษตร' },
    { code: 'ldd',  name: 'กรมพัฒนาที่ดิน' },
    { code: 'rid',  name: 'กรมชลประทาน' },
    { code: 'alro', name: 'ส.ป.ก.' },
    { code: 'raot', name: 'การยางแห่งประเทศไทย' },
    { code: 'qsds', name: 'กรมหม่อนไหม' },
    { code: 'oae',  name: 'สำนักงานเศรษฐกิจการเกษตร' },
    { code: 'acfs', name: 'มกอช.' }
  ];

  const PS_SUBORDINATES = [
    { id: 'moac-deputy-ps', name: 'รองปลัด กษ.' },
    { id: 'moac-ps-sec',    name: 'เลขานุการปลัด กษ.' },
    { id: 'moac-ps-advisor',name: 'ที่ปรึกษาปลัด กษ.' }
  ].concat(DEPTS.map(d => ({ id: 'moac-' + d.code, name: 'อธิบดี ' + d.name })));

  function buildRoleMap() {
    const map = {};

    // Minister
    map['moac-minister'] = {
      level: 'minister',
      roleName: 'รัฐมนตรีว่าการ กษ. — นายสุริยะ จึงรุ่งเรืองกิจ',
      reportsTo: 'cabinet',
      canAssignTo: [
        { id: 'moac-ps',             name: 'ปลัด กษ.' },
        { id: 'moac-dep-minister',   name: 'รมช. กษ. (คนที่ 1) — นายวัชระพล ขาวขำ' },
        { id: 'moac-dep-minister-2', name: 'รมช. กษ. (คนที่ 2) — นางสาวปิยรัฐชย์ ติยะไพรัช' },
        { id: 'moac-minister-sec',   name: 'เลขานุการรัฐมนตรี' }
      ]
    };
    map['moac-dep-minister'] = {
      level: 'dep-minister',
      roleName: 'รมช. กษ. (คนที่ 1) — นายวัชระพล ขาวขำ',
      reportsTo: 'moac-minister',
      canAssignTo: [
        { id: 'moac-dof',              name: 'อธิบดี กรมประมง' },
        { id: 'moac-qsds',             name: 'อธิบดี กรมหม่อนไหม' },
        { id: 'moac-alro',             name: 'เลขาธิการ ส.ป.ก.' },
        { id: 'moac-dep-minister-sec', name: 'เลขานุการ รมช. (คนที่ 1)' }
      ]
    };
    map['moac-dep-minister-2'] = {
      level: 'dep-minister',
      roleName: 'รมช.กษ. (คนที่ 2) — นางสาวปิยรัฐชย์ ติยะไพรัช',
      reportsTo: 'moac-minister',
      canAssignTo: [
        { id: 'moac-doae',               name: 'อธิบดี กรมส่งเสริมการเกษตร' },
        { id: 'moac-cpd',                name: 'อธิบดี กรมส่งเสริมสหกรณ์' },
        { id: 'moac-cad',                name: 'อธิบดี กรมตรวจบัญชีสหกรณ์' },
        { id: 'moac-acfs',               name: 'เลขาธิการ มกอช.' },
        { id: 'moac-dep-minister-2-sec', name: 'เลขาฯ รมช. (คนที่ 2)' }
      ]
    };
    map['moac-minister-sec'] = {
      level: 'minister-sec',
      roleName: 'เลขานุการรัฐมนตรี กษ.',
      reportsTo: 'moac-minister',
      canAssignTo: []
    };
    map['moac-dep-minister-sec'] = {
      level: 'dep-minister-sec',
      roleName: 'เลขานุการ รมช. กษ. (คนที่ 1)',
      reportsTo: 'moac-dep-minister',
      canAssignTo: []
    };
    map['moac-dep-minister-2-sec'] = {
      level: 'sec',
      roleName: 'เลขาฯ รมช.กษ. (คนที่ 2)',
      reportsTo: 'moac-dep-minister-2',
      canAssignTo: []
    };

    // PS layer
    map['moac-ps'] = {
      level: 'ps',
      roleName: 'ปลัด กษ.',
      reportsTo: 'moac-minister',
      canAssignTo: PS_SUBORDINATES
    };
    map['moac-deputy-ps'] = {
      level: 'deputy-ps',
      roleName: 'รองปลัด กษ.',
      reportsTo: 'moac-ps',
      canAssignTo: [
        { id: 'moac-deputy-ps-sec', name: 'เลขานุการรองปลัด' }
      ].concat(DEPTS.map(d => ({ id: 'moac-' + d.code, name: 'อธิบดี ' + d.name })))
    };
    map['moac-ps-sec']    = { level: 'ps-sec',    roleName: 'เลขานุการปลัด กษ.',  reportsTo: 'moac-ps', canAssignTo: [] };
    map['moac-ps-advisor']= { level: 'ps-advisor',roleName: 'ที่ปรึกษาปลัด กษ.',   reportsTo: 'moac-ps', canAssignTo: [] };
    map['moac-deputy-ps-sec'] = { level: 'deputy-ps-sec', roleName: 'เลขานุการรองปลัด', reportsTo: 'moac-deputy-ps', canAssignTo: [] };

    // 15 departments: dept-head + dept-deputy + dept-staff
    DEPTS.forEach(d => {
      const head     = 'moac-' + d.code;
      const deputy   = d.code + '-deputy';
      const staff    = d.code + '-staff';
      map[head] = {
        level: 'dept-head',
        roleName: 'อธิบดี ' + d.name,
        reportsTo: 'moac-ps',
        canAssignTo: [
          { id: deputy, name: 'รองอธิบดี ' + d.name },
          { id: staff,  name: 'นักวิชาการ ' + d.name }
        ]
      };
      map[d.code + '-deputy'] = {
        level: 'dept-deputy',
        roleName: 'รองอธิบดี ' + d.name,
        reportsTo: head,
        canAssignTo: [
          { id: staff, name: 'นักวิชาการ ' + d.name }
        ]
      };
      map[d.code + '-staff'] = {
        level: 'staff',
        roleName: 'นักวิชาการ ' + d.name,
        reportsTo: deputy,
        canAssignTo: []
      };
    });

    return map;
  }
  const ROLE_MAP = buildRoleMap();

  // URL pathname → roleId
  function detectRoleId() {
    const p = location.pathname.toLowerCase();
    const m = p.match(/moac-([a-z0-9-]+?)\.html$/);
    if (!m) return null;
    const slug = m[1];
    if (slug === 'hub' || slug === 'org') return null;
    // map slug → roleId
    // /moac-minister.html → moac-minister
    // /moac-ps.html → moac-ps
    // /moac-doae.html → moac-doae (dept head)
    // /moac-doae-deputy.html → doae-deputy
    // /moac-doae-staff.html → doae-staff
    if (slug.endsWith('-deputy') || slug.endsWith('-staff')) {
      // dept-deputy / dept-staff use bare slug
      return slug;
    }
    return 'moac-' + slug;
  }

  // ────────────────────────────────────────────────────────────────────────
  // UTILS
  // ────────────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  async function apiGet(path, opts) {
    opts = opts || {};
    const url = API + path;
    const c = cache.get(url);
    if (c && (Date.now() - c.ts) < CACHE_TTL_MS && !opts.fresh) {
      return c.body;
    }
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) {
        // 404 → silent fallback; other errors → throw
        if (r.status === 404) return null;
        throw new Error('HTTP ' + r.status);
      }
      const body = await r.json();
      cache.set(url, { ts: Date.now(), body });
      return body;
    } catch (e) {
      console.warn('[MoacApp] GET', path, 'failed:', e.message);
      return null;
    }
  }
  async function apiPost(path, body) {
    try {
      const r = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      return r.json();
    } catch (e) {
      console.warn('[MoacApp] POST', path, 'failed:', e.message);
      return { ok: false, error: e.message };
    }
  }
  async function apiPatch(path, body) {
    try {
      const r = await fetch(API + path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      return r.json();
    } catch (e) {
      console.warn('[MoacApp] PATCH', path, 'failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // dept code from roleId (e.g., 'moac-doae' → 'DOAE', 'doae-deputy' → 'DOAE')
  function deptCodeFromRoleId(roleId) {
    if (!roleId) return null;
    const m = roleId.replace(/^moac-/, '').match(/^([a-z]+)(?:-(?:deputy|staff))?$/);
    if (!m) return null;
    const code = m[1].toUpperCase();
    // valid dept codes only
    if (DEPTS.some(d => d.code.toUpperCase() === code)) return code;
    return null;
  }

  // ────────────────────────────────────────────────────────────────────────
  // STYLE INJECTION
  // ────────────────────────────────────────────────────────────────────────
  function injectStyle() {
    if ($('#moac-app-style')) return;
    const css = `
      .moac-app-bar{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px;background:rgba(11,61,46,.04);
        border-bottom:1px solid rgba(11,61,46,.08);align-items:center}
      .moac-app-bar .lbl{font-size:11px;color:#56707a;font-weight:600;margin-right:4px}
      .moac-act{background:#fff;border:1px solid #cfe3d4;color:#0b3d2e;padding:5px 11px;
        border-radius:18px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;
        display:inline-flex;align-items:center;gap:4px;transition:.15s}
      .moac-act:hover{background:#e6f4ea;border-color:#0b3d2e}
      .moac-act.primary{background:linear-gradient(135deg,#0b3d2e,#2d6a4f);color:#fff;border-color:#c9a227}

      .moac-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.18);
        color:#fff;padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;
        border:1px solid rgba(201,162,39,.4);cursor:pointer;font-family:inherit}
      .moac-chip .dot{width:7px;height:7px;border-radius:50%;background:#22c55e;
        box-shadow:0 0 0 2px rgba(34,197,94,.25)}
      .moac-bell{position:relative;background:rgba(255,255,255,.18);color:#fff;border:none;
        width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:13px;display:inline-flex;
        align-items:center;justify-content:center;margin-left:4px}
      .moac-bell:hover{background:rgba(255,255,255,.32)}
      .moac-bell .badge{position:absolute;top:-3px;right:-3px;background:#ef4444;color:#fff;
        font-size:9px;font-weight:700;border-radius:9px;min-width:15px;height:15px;padding:0 3px;
        display:flex;align-items:center;justify-content:center}

      .moac-toast{position:fixed;top:70px;right:18px;width:340px;max-height:60vh;overflow-y:auto;
        background:#fff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.22);z-index:9998;
        display:none;flex-direction:column;border-top:3px solid #c9a227;font-family:Sarabun,sans-serif}
      .moac-toast.open{display:flex}
      .moac-toast .hd{padding:10px 14px;font-size:13px;font-weight:700;color:#0b3d2e;
        border-bottom:1px solid #e0e0e0;background:#f9f9f9;display:flex;align-items:center;gap:6px}
      .moac-toast .it{padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:12px}
      .moac-toast .it:last-child{border-bottom:none}
      .moac-toast .it .t{font-weight:600;color:#0b3d2e;margin-bottom:2px;font-size:12.5px}
      .moac-toast .it .s{color:#666;font-size:11px}
      .moac-toast .it .ts{color:#999;font-size:10px;margin-top:3px}
      .moac-toast .empty{padding:24px;text-align:center;color:#999;font-size:12px}

      .moac-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9997;display:none;
        align-items:center;justify-content:center;font-family:Sarabun,sans-serif}
      .moac-modal-bg.open{display:flex}
      .moac-modal{background:#fff;border-radius:14px;width:min(540px,94vw);max-height:90vh;
        overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.3);border-top:4px solid #c9a227}
      .moac-modal .h{padding:14px 18px;background:linear-gradient(90deg,#0b3d2e,#2d6a4f);color:#fff;
        font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;
        border-radius:14px 14px 0 0}
      .moac-modal .h .x{margin-left:auto;background:none;border:none;color:#fff;font-size:18px;
        cursor:pointer;font-family:inherit}
      .moac-modal .b{padding:16px 18px}
      .moac-fld{margin-bottom:11px}
      .moac-fld label{display:block;font-size:11px;font-weight:600;color:#666;margin-bottom:4px}
      .moac-fld input,.moac-fld select,.moac-fld textarea{width:100%;padding:8px 10px;
        border:1px solid #cfe3d4;border-radius:8px;font-size:13px;font-family:inherit;background:#fff}
      .moac-fld textarea{resize:vertical;min-height:70px}
      .moac-btn{background:linear-gradient(135deg,#0b3d2e,#2d6a4f);color:#fff;border:none;
        padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
        font-family:inherit}
      .moac-btn.ghost{background:#fff;color:#0b3d2e;border:1px solid #cfe3d4}

      .moac-task-card{background:#fff;border:1px solid #cfe3d4;border-left:4px solid #c9a227;
        border-radius:10px;padding:11px 14px;margin-bottom:9px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
      .moac-task-card .ttl{font-size:13px;font-weight:700;color:#0b3d2e}
      .moac-task-card .fr{font-size:11px;color:#666;margin-top:1px}
      .moac-task-card .dt{font-size:11.5px;color:#444;margin-top:5px}
      .moac-task-card .row{display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;align-items:center}
      .moac-pri{display:inline-block;padding:1px 8px;border-radius:9px;font-size:10.5px;font-weight:700}
      .moac-pri.urgent{background:#fee2e2;color:#991b1b}
      .moac-pri.high{background:#fed7aa;color:#9a3412}
      .moac-pri.normal{background:#fef9c3;color:#854d0e}
      .moac-pri.low{background:#dcfce7;color:#166534}
      .moac-st{display:inline-block;padding:1px 8px;border-radius:9px;font-size:10.5px;font-weight:700}
      .moac-st.pending{background:#fee2e2;color:#991b1b}
      .moac-st.in_progress{background:#dbeafe;color:#1e40af}
      .moac-st.done{background:#dcfce7;color:#166534}
      .moac-mini{font-size:10.5px;padding:3px 9px;border-radius:6px;border:none;cursor:pointer;
        font-family:inherit;font-weight:600}
      .moac-mini.b1{background:#3b82f6;color:#fff}
      .moac-mini.b2{background:#22c55e;color:#fff}
      .moac-mini.b3{background:#c9a227;color:#fff}

      .moac-tl{padding:6px 0}
      .moac-tl-it{position:relative;padding:0 0 16px 22px;border-left:2px solid #cfe3d4}
      .moac-tl-it:last-child{border-left-color:transparent}
      .moac-tl-it::before{content:'';position:absolute;left:-6px;top:2px;width:10px;height:10px;
        border-radius:50%;background:#c9a227;border:2px solid #fff;box-shadow:0 0 0 1px #c9a227}
      .moac-tl-ttl{font-size:12.5px;font-weight:700;color:#0b3d2e}
      .moac-tl-sub{font-size:11px;color:#666;margin-top:1px}
      .moac-tl-ts{font-size:10px;color:#999;margin-top:2px}

      .moac-skel{display:inline-block;background:linear-gradient(90deg,#eee,#f5f5f5,#eee);
        background-size:200% 100%;animation:moacskel 1.4s infinite;border-radius:4px;
        height:1em;min-width:60px;color:transparent}
      @keyframes moacskel{0%{background-position:200% 0}100%{background-position:-200% 0}}

      .moac-flash{position:fixed;bottom:84px;right:84px;background:#0b3d2e;color:#fff;
        padding:10px 16px;border-radius:8px;font-size:12.5px;font-weight:600;
        box-shadow:0 6px 24px rgba(0,0,0,.3);z-index:9999;font-family:Sarabun,sans-serif;
        opacity:0;transform:translateY(8px);transition:.2s}
      .moac-flash.show{opacity:1;transform:translateY(0)}
    `;
    const s = document.createElement('style');
    s.id = 'moac-app-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function flash(msg) {
    let el = $('#moac-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'moac-flash';
      el.className = 'moac-flash';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ────────────────────────────────────────────────────────────────────────
  // (B) AUTO-INIT MoacDelegate
  // ────────────────────────────────────────────────────────────────────────
  function waitFor(check, timeoutMs, intervalMs) {
    timeoutMs = timeoutMs || 5000; intervalMs = intervalMs || 100;
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function tick() {
        try {
          const v = check();
          if (v) return resolve(v);
        } catch (_) {}
        if (Date.now() - start >= timeoutMs) return reject(new Error('timeout'));
        setTimeout(tick, intervalMs);
      })();
    });
  }

  async function autoInitDelegate(state) {
    try {
      await waitFor(() => typeof window.MoacDelegate !== 'undefined', 6000, 120);
    } catch (e) {
      console.warn('[MoacApp] MoacDelegate not available — FAB will be skipped');
      return false;
    }
    // If the page already called init, MoacDelegate.config will have myId set
    if (window.MoacDelegate.config && window.MoacDelegate.config.myId) {
      console.log('[MoacApp] MoacDelegate already initialized by page —', window.MoacDelegate.config.myId);
      return true;
    }
    try {
      window.MoacDelegate.init({
        myId: state.roleId,
        roleName: state.roleName,
        level: state.level,
        reportsTo: state.reportsTo,
        canAssignTo: state.canAssignTo
      });
      return true;
    } catch (e) {
      console.warn('[MoacApp] MoacDelegate.init failed', e);
      return false;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // (C) ACTION BAR
  // ────────────────────────────────────────────────────────────────────────
  function actionsForLevel(level) {
    const A = {
      'minister': [
        { id:'overview',  label:'📊 ดูสรุปกระทรวง',     primary:true },
        { id:'check-ps',  label:'📋 ตรวจรายงานปลัด' },
        { id:'approve',   label:'✅ อนุมัตินโยบาย' },
        { id:'urgent',    label:'⚠️ วาระเร่งด่วน' },
        { id:'assign',    label:'📤 มอบหมายงาน' }
      ],
      'dep-minister': [
        { id:'overview',  label:'📊 ดูสรุปกระทรวง', primary:true },
        { id:'urgent',    label:'⚠️ วาระเร่งด่วน' },
        { id:'assign',    label:'📤 มอบหมายงาน' },
        { id:'report',    label:'📨 รายงานต่อรมว.' }
      ],
      'minister-sec': [
        { id:'mytasks', label:'📋 งานของฉัน', primary:true },
        { id:'agenda',  label:'📅 จัดวาระประชุม' },
        { id:'report',  label:'📨 รายงานต่อ รมว.' }
      ],
      'dep-minister-sec': [
        { id:'mytasks', label:'📋 งานของฉัน', primary:true },
        { id:'agenda',  label:'📅 จัดวาระประชุม' },
        { id:'report',  label:'📨 รายงานต่อ รมช.' }
      ],
      'ps': [
        { id:'overview',   label:'📊 Dashboard 15 กรม', primary:true },
        { id:'budget',     label:'💰 ตรวจสอบงบ' },
        { id:'cross',      label:'🔁 Cross-dept Task' },
        { id:'assign',     label:'📤 มอบหมายงาน' },
        { id:'report',     label:'📨 รายงานต่อ รมว.' }
      ],
      'deputy-ps': [
        { id:'mytasks',  label:'📋 งานของฉัน', primary:true },
        { id:'depts',    label:'🏛️ ติดตามกรม' },
        { id:'assign',   label:'📤 มอบหมายงาน' },
        { id:'report',   label:'📨 รายงานต่อปลัด' }
      ],
      'ps-sec':     [{ id:'mytasks', label:'📋 งานของฉัน', primary:true }, { id:'agenda', label:'📅 จัดวาระประชุม' }, { id:'report', label:'📨 รายงานต่อปลัด' }],
      'ps-advisor': [{ id:'mytasks', label:'📋 งานของฉัน', primary:true }, { id:'review', label:'📑 พิจารณานโยบาย' }, { id:'report', label:'📨 รายงานต่อปลัด' }],
      'deputy-ps-sec':[{ id:'mytasks', label:'📋 งานของฉัน', primary:true }, { id:'agenda', label:'📅 จัดวาระประชุม' }, { id:'report', label:'📨 รายงานต่อรองปลัด' }],
      'dept-head': [
        { id:'mytasks',  label:'📋 งานที่ปลัดมอบ', primary:true },
        { id:'assign',   label:'📤 มอบหมายในกรม' },
        { id:'approve',  label:'✅ Approve โครงการ' },
        { id:'kpi',      label:'📊 ตรวจ KPI' },
        { id:'report',   label:'📨 ส่งรายงานต่อปลัด' }
      ],
      'dept-deputy': [
        { id:'mytasks',  label:'📋 งานที่ อธิบดี มอบ', primary:true },
        { id:'assign',   label:'📤 มอบงานต่อ' },
        { id:'monitor',  label:'👀 ตรวจสายงาน' },
        { id:'report',   label:'📨 ส่งรายงานต่อ อธิบดี' }
      ],
      'staff': [
        { id:'mytasks',  label:'📋 งานของฉัน', primary:true },
        { id:'progress', label:'📝 ส่งความคืบหน้า' },
        { id:'help',     label:'🆘 ขอความช่วยเหลือ' },
        { id:'diary',    label:'📔 บันทึกประจำวัน' }
      ]
    };
    return A[level] || [
      { id:'mytasks', label:'📋 งานของฉัน', primary:true },
      { id:'report',  label:'📨 ส่งรายงาน' }
    ];
  }

  function injectActionBar(state) {
    const topbar = $('.topbar');
    if (!topbar || $('#moac-app-bar')) return;
    const acts = actionsForLevel(state.level);
    const bar = document.createElement('div');
    bar.id = 'moac-app-bar';
    bar.className = 'moac-app-bar';
    bar.innerHTML =
      `<span class="lbl">⚡ Quick Actions:</span>` +
      acts.map(a => `<button class="moac-act ${a.primary?'primary':''}" data-act="${a.id}">${a.label}</button>`).join('');
    // insert after topbar
    topbar.parentNode.insertBefore(bar, topbar.nextSibling);

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      handleAction(btn.dataset.act, state);
    });
  }

  function handleAction(actId, state) {
    switch (actId) {
      case 'overview':
      case 'depts':
      case 'urgent':
      case 'budget':
      case 'kpi':
      case 'review':
      case 'monitor':
      case 'agenda':
        // Try to switch to the corresponding tab if present
        switchTabByHint(actId);
        break;
      case 'mytasks':
        openMyTasksModal(state);
        break;
      case 'assign':
      case 'cross':
        if (window.MoacDelegate && typeof window.MoacDelegate.toggle === 'function') {
          window.MoacDelegate.toggle();
          setTimeout(() => {
            if (typeof window.MoacDelegate.switchTab === 'function') {
              window.MoacDelegate.switchTab(1);
            }
          }, 100);
        } else {
          openAssignModal(state);
        }
        break;
      case 'report':
        openReportModal(state);
        break;
      case 'approve':
        openApproveModal(state);
        break;
      case 'progress':
        openProgressModal(state);
        break;
      case 'help':
        openHelpModal(state);
        break;
      case 'diary':
        openDiaryModal(state);
        break;
      default:
        flash('Action: ' + actId);
    }
  }

  function switchTabByHint(hint) {
    // try to find a sidebar item whose text matches the hint
    const map = {
      'overview':'ภาพรวม|สถานะ|Dashboard|15 กรม',
      'depts':   'กรม|หน่วยงาน',
      'urgent':  'เร่งด่วน|วาระ',
      'budget':  'งบ',
      'kpi':     'KPI|ตัวชี้',
      'review':  'นโยบาย|พิจารณา',
      'monitor': 'สาย|ตรวจ',
      'agenda':  'ประชุม|วาระ|ตาราง'
    };
    const re = new RegExp(map[hint] || hint, 'i');
    const items = $$('.nav-item, .sb-item');
    for (const it of items) {
      if (re.test(it.textContent || '')) {
        it.click();
        return true;
      }
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────────────────
  // MODALS
  // ────────────────────────────────────────────────────────────────────────
  function ensureModalRoot() {
    let m = $('#moac-modal-bg');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'moac-modal-bg';
    m.className = 'moac-modal-bg';
    m.innerHTML = `<div class="moac-modal" role="dialog"></div>`;
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
    document.body.appendChild(m);
    return m;
  }
  function openModal(titleHtml, bodyHtml) {
    const root = ensureModalRoot();
    const inner = root.querySelector('.moac-modal');
    inner.innerHTML =
      `<div class="h">${titleHtml}<button class="x" type="button">✕</button></div>
       <div class="b">${bodyHtml}</div>`;
    root.querySelector('.x').addEventListener('click', closeModal);
    root.classList.add('open');
    return inner;
  }
  function closeModal() {
    const root = $('#moac-modal-bg');
    if (root) root.classList.remove('open');
  }

  function openAssignModal(state) {
    const opts = (state.canAssignTo || []).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    const inner = openModal('📤 มอบหมายงาน',
      `<div class="moac-fld"><label>มอบหมายให้</label>
        <select id="ma-to">${opts || '<option value="">ไม่มีลูกน้อง</option>'}</select></div>
       <div class="moac-fld"><label>หัวข้องาน</label>
        <input id="ma-title" type="text" class="lp-auto" placeholder="ระบุหัวข้องาน..."></div>
       <div class="moac-fld"><label>รายละเอียด</label>
        <textarea id="ma-detail" class="lp-auto" rows="3" placeholder="รายละเอียด · กำหนดส่ง · ผลที่คาดหวัง..."></textarea></div>
       <div class="moac-fld"><label>ความสำคัญ</label>
        <select id="ma-pri">
          <option value="urgent">🔴 ด่วนมาก</option>
          <option value="high">🟠 สูง</option>
          <option value="normal" selected>🟡 ปกติ</option>
          <option value="low">🟢 ต่ำ</option>
        </select></div>
       <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="moac-btn ghost" id="ma-cancel">ยกเลิก</button>
        <button class="moac-btn" id="ma-go">📤 มอบหมาย</button>
       </div>
       <div id="ma-res" style="margin-top:10px;font-size:12px;color:#15803d"></div>`);
    $('#ma-cancel', inner).addEventListener('click', closeModal);
    $('#ma-go', inner).addEventListener('click', async () => {
      const sel = $('#ma-to', inner);
      const toId = sel.value;
      const toName = sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text;
      const title = $('#ma-title', inner).value.trim();
      const detail = $('#ma-detail', inner).value.trim();
      const pri = $('#ma-pri', inner).value;
      if (!toId || !title) { alert('กรุณาเลือกผู้รับและระบุหัวข้องาน'); return; }
      const r = await apiPost('/assign', {
        from: state.roleId, fromName: state.roleName, to: toId, toName, title, detail, priority: pri
      });
      $('#ma-res', inner).innerHTML = r.ok
        ? `✅ มอบหมายงาน "<b>${esc(title)}</b>" ถึง ${esc(toName)} (ID: ${esc(r.taskId)})`
        : '❌ ' + esc(r.error || 'ผิดพลาด');
      if (r.ok) { flash('มอบหมายงานสำเร็จ'); setTimeout(closeModal, 1100); refreshNotifications(state); }
    });
  }

  function openReportModal(state) {
    const inner = openModal('📨 ส่งรายงานขึ้น',
      `<div style="font-size:12px;color:#666;margin-bottom:10px">รายงานถึง: <b>${esc(state.reportsTo || 'ศูนย์กลาง')}</b></div>
       <div class="moac-fld"><label>หัวข้อรายงาน</label>
        <input id="mr-title" type="text" class="lp-auto" placeholder="หัวข้อรายงาน..."></div>
       <div class="moac-fld"><label>สรุปประเด็นสำคัญ</label>
        <textarea id="mr-sum" rows="5" class="lp-auto" placeholder="สรุปผลงาน · ปัญหา · ข้อเสนอแนะ..."></textarea></div>
       <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="moac-btn ghost" id="mr-cancel">ยกเลิก</button>
        <button class="moac-btn" id="mr-go">📨 ส่งรายงาน</button>
       </div>
       <div id="mr-res" style="margin-top:10px;font-size:12px;color:#15803d"></div>`);
    $('#mr-cancel', inner).addEventListener('click', closeModal);
    $('#mr-go', inner).addEventListener('click', async () => {
      const title = $('#mr-title', inner).value.trim();
      const summary = $('#mr-sum', inner).value.trim();
      if (!title) { alert('กรุณาระบุหัวข้อรายงาน'); return; }
      const r = await apiPost('/report', {
        from: state.roleId, fromName: state.roleName,
        fromLevel: state.level, toLevel: state.reportsTo,
        title, summary, data: {}
      });
      $('#mr-res', inner).innerHTML = r.ok
        ? `✅ ส่งรายงาน "<b>${esc(title)}</b>" สำเร็จ (ID: ${esc(r.reportId)})`
        : '❌ ' + esc(r.error || 'ผิดพลาด');
      if (r.ok) { flash('ส่งรายงานสำเร็จ'); setTimeout(closeModal, 1100); }
    });
  }

  function openApproveModal(state) {
    openModal('✅ อนุมัตินโยบาย / โครงการ',
      `<div class="moac-fld"><label>โครงการ / นโยบาย</label>
        <input id="mp-name" type="text" placeholder="ระบุชื่อโครงการที่ต้องการอนุมัติ..."></div>
       <div class="moac-fld"><label>วงเงิน (ล้านบาท)</label>
        <input id="mp-amt" type="number" min="0" step="0.1" placeholder="0"></div>
       <div class="moac-fld"><label>หมายเหตุ</label>
        <textarea id="mp-note" class="lp-auto" rows="3" placeholder="เงื่อนไข · ข้อสังเกต..."></textarea></div>
       <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="moac-btn ghost" id="mp-cancel">ยกเลิก</button>
        <button class="moac-btn" id="mp-go">✅ บันทึกการอนุมัติ</button>
       </div>`);
    $('#mp-cancel').addEventListener('click', closeModal);
    $('#mp-go').addEventListener('click', async () => {
      const name = $('#mp-name').value.trim();
      const amt = parseFloat($('#mp-amt').value || '0');
      const note = $('#mp-note').value.trim();
      if (!name) { alert('กรุณาระบุชื่อโครงการ'); return; }
      // Persist as a "report" with type=approval
      await apiPost('/report', {
        from: state.roleId, fromName: state.roleName,
        fromLevel: state.level, toLevel: 'log',
        title: '[APPROVAL] ' + name,
        summary: 'วงเงิน ' + amt + ' ล้านบาท · ' + note,
        data: { type: 'approval', amount_mbaht: amt }
      });
      flash('บันทึกการอนุมัติแล้ว');
      closeModal();
    });
  }

  function openProgressModal(state) {
    openModal('📝 ส่งความคืบหน้า',
      `<div class="moac-fld"><label>งาน / โครงการ</label>
        <input id="pg-task" type="text" placeholder="ระบุงานที่กำลังทำ..."></div>
       <div class="moac-fld"><label>เปอร์เซ็นต์ความคืบหน้า</label>
        <input id="pg-pct" type="number" min="0" max="100" value="50"></div>
       <div class="moac-fld"><label>รายละเอียด</label>
        <textarea id="pg-note" class="lp-auto" rows="4" placeholder="ทำอะไรไปแล้ว · ติดปัญหาอะไร · ขั้นถัดไป..."></textarea></div>
       <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="moac-btn ghost" id="pg-cancel">ยกเลิก</button>
        <button class="moac-btn" id="pg-go">📝 ส่ง</button>
       </div>`);
    $('#pg-cancel').addEventListener('click', closeModal);
    $('#pg-go').addEventListener('click', async () => {
      const task = $('#pg-task').value.trim();
      const pct = parseInt($('#pg-pct').value || '0', 10);
      const note = $('#pg-note').value.trim();
      if (!task) { alert('กรุณาระบุงาน'); return; }
      await apiPost('/report', {
        from: state.roleId, fromName: state.roleName,
        fromLevel: state.level, toLevel: state.reportsTo,
        title: '[PROGRESS ' + pct + '%] ' + task,
        summary: note,
        data: { type: 'progress', pct }
      });
      flash('ส่งความคืบหน้าแล้ว');
      closeModal();
    });
  }

  function openHelpModal(state) {
    openModal('🆘 ขอความช่วยเหลือ',
      `<div class="moac-fld"><label>เรื่อง</label>
        <input id="hp-t" type="text" placeholder="ระบุปัญหา / สิ่งที่ต้องการความช่วยเหลือ"></div>
       <div class="moac-fld"><label>รายละเอียด</label>
        <textarea id="hp-d" class="lp-auto" rows="4" placeholder="อธิบายปัญหาให้หัวหน้าเห็นภาพ..."></textarea></div>
       <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="moac-btn ghost" id="hp-cancel">ยกเลิก</button>
        <button class="moac-btn" id="hp-go">🆘 ส่งขอความช่วยเหลือ</button>
       </div>`);
    $('#hp-cancel').addEventListener('click', closeModal);
    $('#hp-go').addEventListener('click', async () => {
      const title = $('#hp-t').value.trim();
      const det = $('#hp-d').value.trim();
      if (!title) { alert('กรุณาระบุเรื่อง'); return; }
      await apiPost('/report', {
        from: state.roleId, fromName: state.roleName,
        fromLevel: state.level, toLevel: state.reportsTo,
        title: '[HELP] ' + title, summary: det, data: { type: 'help_request' }
      });
      flash('ส่งคำขอแล้ว');
      closeModal();
    });
  }

  function openDiaryModal(state) {
    const today = new Date().toLocaleDateString('th-TH');
    openModal('📔 บันทึกประจำวัน — ' + today,
      `<div class="moac-fld"><label>หัวข้อสรุปวันนี้</label>
        <input id="dy-t" type="text" placeholder="เช่น ลงพื้นที่ ศพก. อ.สูงเม่น"></div>
       <div class="moac-fld"><label>รายละเอียด</label>
        <textarea id="dy-d" class="lp-auto" rows="6" placeholder="สิ่งที่ทำ · พบเจอ · บันทึกการเรียนรู้ · งานพรุ่งนี้..."></textarea></div>
       <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="moac-btn ghost" id="dy-cancel">ยกเลิก</button>
        <button class="moac-btn" id="dy-go">💾 บันทึก</button>
       </div>`);
    $('#dy-cancel').addEventListener('click', closeModal);
    $('#dy-go').addEventListener('click', async () => {
      const t = $('#dy-t').value.trim();
      const d = $('#dy-d').value.trim();
      if (!t) { alert('กรุณาระบุหัวข้อ'); return; }
      await apiPost('/report', {
        from: state.roleId, fromName: state.roleName,
        fromLevel: state.level, toLevel: 'log',
        title: '[DIARY] ' + t, summary: d, data: { type: 'diary', date: new Date().toISOString().slice(0,10) }
      });
      flash('บันทึกแล้ว');
      closeModal();
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // (F) MY TASKS MODAL
  // ────────────────────────────────────────────────────────────────────────
  async function openMyTasksModal(state) {
    const inner = openModal('📋 งานของฉัน — ' + esc(state.roleName),
      `<div id="mt-body" style="font-size:12px;color:#999;padding:18px;text-align:center">กำลังโหลด...</div>`);
    const data = await apiGet('/tasks?assignee=' + encodeURIComponent(state.roleId), { fresh: true });
    const tasks = (data && data.tasks) ? data.tasks : [];
    const body = $('#mt-body', inner);
    if (!tasks.length) {
      body.innerHTML = '<div style="text-align:center;color:#999;padding:24px">ไม่มีงานในระบบ</div>';
      return;
    }
    body.innerHTML = tasks.map(t => `
      <div class="moac-task-card" data-id="${esc(t.id)}">
        <div class="ttl">${esc(t.title)}</div>
        <div class="fr">จาก: ${esc(t.fromName || t.from || '—')}</div>
        <div class="dt">${esc(t.detail || '')}</div>
        <div class="row">
          <span class="moac-pri ${esc(t.priority || 'normal')}">${labelPri(t.priority)}</span>
          <span class="moac-st ${esc(t.status || 'pending')}">${labelStatus(t.status)}</span>
          <span style="flex:1"></span>
          <button class="moac-mini b1" data-do="in_progress">กำลังทำ</button>
          <button class="moac-mini b2" data-do="done">เสร็จแล้ว</button>
          <button class="moac-mini b3" data-do="report">ส่งรายงาน</button>
          <button class="moac-mini" data-do="workflow" style="background:#eee;color:#0b3d2e">🔗 timeline</button>
        </div>
      </div>`).join('');
    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-do]');
      if (!btn) return;
      const card = btn.closest('.moac-task-card');
      const id = card.dataset.id;
      const action = btn.dataset.do;
      if (action === 'in_progress' || action === 'done') {
        const r = await apiPatch('/tasks/' + encodeURIComponent(id), { status: action });
        if (r.ok) {
          flash('อัพเดตสถานะ: ' + labelStatus(action));
          card.querySelector('.moac-st').className = 'moac-st ' + action;
          card.querySelector('.moac-st').textContent = labelStatus(action);
        }
      } else if (action === 'report') {
        closeModal();
        openReportModal(state);
      } else if (action === 'workflow') {
        openWorkflowModal(id);
      }
    });
  }

  function labelPri(p) { return ({urgent:'🔴 ด่วนมาก',high:'🟠 สูง',normal:'🟡 ปกติ',low:'🟢 ต่ำ'})[p||'normal'] || 'ปกติ'; }
  function labelStatus(s) { return ({pending:'รอ',in_progress:'กำลังทำ',done:'เสร็จแล้ว'})[s||'pending'] || s; }

  // ────────────────────────────────────────────────────────────────────────
  // (G) WORKFLOW TIMELINE
  // ────────────────────────────────────────────────────────────────────────
  async function openWorkflowModal(taskId) {
    const inner = openModal('🔁 Workflow Timeline — ' + esc(taskId),
      `<div id="wf-body" style="font-size:12px;color:#999;padding:16px;text-align:center">กำลังโหลด...</div>`);
    const data = await apiGet('/workflow/' + encodeURIComponent(taskId), { fresh: true });
    const body = $('#wf-body', inner);
    if (!data || !data.ok) {
      body.innerHTML = '<div style="text-align:center;color:#999;padding:24px">ไม่พบข้อมูล workflow (อาจเป็น task เดิมที่ยังไม่มีรายงาน)</div>';
      return;
    }
    const events = data.events || [];
    if (!events.length) {
      body.innerHTML = '<div style="text-align:center;color:#999;padding:24px">ยังไม่มี event</div>';
      return;
    }
    body.innerHTML = '<div class="moac-tl">' + events.map(ev => `
      <div class="moac-tl-it">
        <div class="moac-tl-ttl">${esc(ev.label || ev.type)}</div>
        <div class="moac-tl-sub">${esc(ev.summary || '')}</div>
        <div class="moac-tl-ts">${esc(new Date(ev.ts || ev.created || Date.now()).toLocaleString('th-TH'))}</div>
      </div>`).join('') + '</div>';
  }

  // ────────────────────────────────────────────────────────────────────────
  // (E) PROFILE CHIP + BELL
  // ────────────────────────────────────────────────────────────────────────
  function injectProfileBar(state) {
    const topbar = $('.topbar');
    if (!topbar || $('#moac-chip')) return;
    const wrap = document.createElement('div');
    wrap.id = 'moac-chip-wrap';
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';
    wrap.style.marginLeft = 'auto';
    wrap.innerHTML = `
      <div id="moac-chip" class="moac-chip" title="${esc(state.roleId)}">
        <span class="dot"></span><span>${esc(state.roleName)}</span>
      </div>
      <button class="moac-bell" id="moac-bell" title="แจ้งเตือน">🔔<span class="badge" id="moac-bell-badge" style="display:none">0</span></button>
    `;

    // Logout button (.tb-lo / .tb-logout / similar) — place before it.
    const logout = topbar.querySelector('.tb-lo, .tb-logout, [onclick*="logout"]');
    if (logout) {
      topbar.insertBefore(wrap, logout);
    } else {
      topbar.appendChild(wrap);
    }

    // bell toast
    const toast = document.createElement('div');
    toast.id = 'moac-toast';
    toast.className = 'moac-toast';
    toast.innerHTML = `<div class="hd">🔔 แจ้งเตือนล่าสุด</div><div id="moac-toast-body"><div class="empty">กำลังโหลด...</div></div>`;
    document.body.appendChild(toast);

    $('#moac-bell').addEventListener('click', (e) => {
      e.stopPropagation();
      toast.classList.toggle('open');
      if (toast.classList.contains('open')) refreshNotifications(state);
    });
    document.addEventListener('click', (e) => {
      if (!toast.contains(e.target) && e.target.id !== 'moac-bell') {
        toast.classList.remove('open');
      }
    });
  }

  async function refreshNotifications(state) {
    const data = await apiGet('/notifications/' + encodeURIComponent(state.roleId), { fresh: true });
    const body = $('#moac-toast-body');
    const badge = $('#moac-bell-badge');
    if (!data || !data.ok) {
      // fallback: derive from /tasks + /reports
      const t = await apiGet('/tasks?assignee=' + encodeURIComponent(state.roleId), { fresh: true });
      const r = await apiGet('/reports?toLevel=' + encodeURIComponent(state.level), { fresh: true });
      const tasks = (t && t.tasks) || [];
      const reports = (r && r.reports) || [];
      const pending = tasks.filter(x => x.status === 'pending');
      const unread = pending.length + reports.length;
      if (badge) {
        if (unread > 0) { badge.textContent = unread; badge.style.display = ''; }
        else { badge.style.display = 'none'; }
      }
      if (body) {
        const events = []
          .concat(pending.slice(0, 5).map(p => ({ type:'task_assigned', title:p.title, summary:'จาก '+(p.fromName||p.from||'?'), ts:p.created })))
          .concat(reports.slice(0, 5).map(p => ({ type:'report_received', title:p.title, summary:'จาก '+(p.fromName||p.from||'?'), ts:p.created })));
        body.innerHTML = events.length
          ? events.map(ev => `<div class="it"><div class="t">${esc(ev.title)}</div><div class="s">${esc(ev.summary)}</div><div class="ts">${esc(new Date(ev.ts).toLocaleString('th-TH'))}</div></div>`).join('')
          : '<div class="empty">ไม่มีรายการ</div>';
      }
      return;
    }
    const unread = data.unread || 0;
    if (badge) {
      if (unread > 0) { badge.textContent = unread; badge.style.display = ''; }
      else { badge.style.display = 'none'; }
    }
    if (body) {
      const events = data.events || [];
      body.innerHTML = events.length
        ? events.map(ev => `<div class="it"><div class="t">${esc(ev.title || ev.type)}</div><div class="s">${esc(ev.summary || '')}</div><div class="ts">${esc(new Date(ev.ts).toLocaleString('th-TH'))}</div></div>`).join('')
        : '<div class="empty">ไม่มีรายการ</div>';
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // (D) LIVE KPI REPLACEMENT
  // ────────────────────────────────────────────────────────────────────────
  async function refreshLiveKpis(state) {
    const overview = $('.tab-pane.active') || $('#t0') || $('.tab-pane');
    if (!overview) return;

    // KPI cells inside the overview tab — kpis use either .kv (most pages)
    // or .kpi-v (minister), so we look for both.
    const cells = $$('.kv, .kpi-v', overview);
    if (!cells.length) return;

    // Detect dept code
    const code = deptCodeFromRoleId(state.roleId);
    let data = null;
    if (state.level === 'minister' || state.level === 'dep-minister' || state.level === 'ps' || state.level === 'deputy-ps') {
      data = await apiGet('/overview');
    } else if (code) {
      data = await apiGet('/departments/' + code);
    }

    const dash = await apiGet('/dashboard/' + encodeURIComponent(state.roleId));
    const myTasks = await apiGet('/tasks?assignee=' + encodeURIComponent(state.roleId));

    // We don't blindly replace every number — we look for labels that match.
    cells.forEach(cell => {
      const labelEl = cell.parentElement && (cell.parentElement.querySelector('.kl, .kpi-l'));
      if (!labelEl) return;
      const label = (labelEl.textContent || '').trim();
      const rep = pickKpiValue(label, { data, dash, myTasks, state });
      if (rep != null) {
        cell.dataset.origValue = cell.dataset.origValue || cell.textContent;
        cell.textContent = rep;
        cell.title = 'ค่าจริงจาก API (อัปเดต ' + new Date().toLocaleTimeString('th-TH') + ')';
      }
    });
  }

  function pickKpiValue(label, ctx) {
    const L = label.toLowerCase();
    const ministry = ctx.data && (ctx.data.fiscal_year_2568_budget_baht ? ctx.data : null);
    const dept = ctx.data && ctx.data.department;
    const tasksCount = ctx.myTasks && (ctx.myTasks.count != null ? ctx.myTasks.count : (ctx.myTasks.tasks || []).length);
    const pendingCount = ctx.myTasks && (ctx.myTasks.tasks || []).filter(t => t.status === 'pending').length;
    const dashOpen = ctx.dash && ctx.dash.openTaskCount;
    const dashReports = ctx.dash && ctx.dash.reportsCount;

    // farmer / เกษตรกร
    if (/เกษตรกร/.test(label) || /farmer/.test(L)) {
      if (ministry && ministry.thai_farmer_count_total) return (ministry.thai_farmer_count_total / 1e6).toFixed(1) + 'M';
    }
    // budget
    if (/งบ/.test(label) && /(รวม|กรม|กระทรวง|2568)/.test(label)) {
      if (ministry && ministry.fiscal_year_2568_budget_baht) return (ministry.fiscal_year_2568_budget_baht / 1e6).toLocaleString('th-TH') + 'M';
    }
    // ministry-wide dept count
    if (/(หน่วยงาน|กรม)$/.test(label)) {
      if (ministry && ministry.departments_count) return String(ministry.departments_count);
    }
    // task counters
    if (/งานต้องทำ|งานของฉัน|งานในกล่อง|งานเข้าใหม่|งานที่|งาน$/.test(label)) {
      if (tasksCount != null) return String(tasksCount);
    }
    if (/รายงานเข้า|รายงานค้าง|รายงานใหม่/.test(label)) {
      if (dashReports != null) return String(dashReports);
    }
    if (/รอ|pending|รอดำเนินการ/.test(label)) {
      if (pendingCount != null) return String(pendingCount);
    }
    if (dashOpen != null && /open|งานเปิด|กำลังทำ/.test(L)) return String(dashOpen);

    // Dept budget hint — when dept page asks "งบกรม"
    if (dept && /งบกรม/.test(label) && dept.budget_baht) {
      return (dept.budget_baht / 1e6).toLocaleString('th-TH') + 'M';
    }
    return null; // leave the mock value
  }

  // ────────────────────────────────────────────────────────────────────────
  // (H) CROSS-ROLE NAVIGATION
  // ────────────────────────────────────────────────────────────────────────
  function injectSidebarChain(state) {
    const sidebar = $('.sidebar');
    if (!sidebar || $('#moac-chain')) return;
    const links = document.createElement('div');
    links.id = 'moac-chain';
    links.style.padding = '8px 12px';
    links.style.fontSize = '11px';
    links.style.borderTop = '1px solid #e0e0e0';
    links.style.background = 'rgba(11,61,46,.04)';
    const upUrl = roleIdToHref(state.reportsTo);
    const downSamples = (state.canAssignTo || []).slice(0, 3);
    let html = '';
    if (state.reportsTo && state.reportsTo !== 'cabinet' && upUrl) {
      html += `<div style="margin-bottom:4px"><a href="${upUrl}" style="color:#0b3d2e;text-decoration:none">↑ ส่งต่อให้: ${esc(roleIdToName(state.reportsTo))}</a></div>`;
    }
    if (downSamples.length) {
      html += downSamples.map(p => {
        const u = roleIdToHref(p.id);
        return u ? `<div style="margin-top:3px"><a href="${u}" style="color:#2d6a4f;text-decoration:none">↓ ${esc(p.name)}</a></div>` : '';
      }).join('');
    }
    if (!html) return;
    links.innerHTML = html;
    sidebar.appendChild(links);
  }

  function roleIdToName(id) {
    if (!id) return '';
    if (ROLE_MAP[id]) return ROLE_MAP[id].roleName;
    return id;
  }
  function roleIdToHref(id) {
    if (!id) return null;
    if (id === 'cabinet' || id === 'log') return null;
    // moac-doae → /moac-doae.html
    // doae-deputy → /moac-doae-deputy.html
    // doae-staff → /moac-doae-staff.html
    if (id.startsWith('moac-')) return '/' + id + '.html';
    return '/moac-' + id + '.html';
  }

  // ────────────────────────────────────────────────────────────────────────
  // (I) KEYBOARD SHORTCUTS
  // ────────────────────────────────────────────────────────────────────────
  function setupShortcuts(state) {
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const isTyping = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      // Esc
      if (e.key === 'Escape') {
        const m = $('#moac-modal-bg.open');
        if (m) { closeModal(); e.preventDefault(); return; }
        const ts = $('#moac-toast.open');
        if (ts) { ts.classList.remove('open'); }
        return;
      }
      // Cmd+K or / → focus search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const s = $('input[type="search"], input.search, input[placeholder*="ค้นหา"], input[name="search"]');
        if (s) { s.focus(); e.preventDefault(); }
        return;
      }
      if (e.key === '/' && !isTyping) {
        const s = $('input[type="search"], input.search, input[placeholder*="ค้นหา"], input[name="search"]');
        if (s) { s.focus(); e.preventDefault(); }
        return;
      }
      // Cmd+/ → toggle delegation panel
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        if (window.MoacDelegate && typeof window.MoacDelegate.toggle === 'function') {
          window.MoacDelegate.toggle();
          e.preventDefault();
        }
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // (J) AUTOSAVE DRAFTS
  // ────────────────────────────────────────────────────────────────────────
  function setupAutosave(state) {
    const key = (el) => 'moac-draft:' + state.roleId + ':' + (el.id || el.name || el.placeholder || el.className);
    function bind(el) {
      if (el.__moacBound) return;
      el.__moacBound = true;
      // restore
      try {
        const v = localStorage.getItem(key(el));
        if (v && !el.value) el.value = v;
      } catch (_) {}
      // save (debounced 2s)
      let t = null;
      el.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          try { localStorage.setItem(key(el), el.value || ''); } catch (_) {}
        }, 2000);
      });
      // clear on submit / click of nearest button.moac-btn (best-effort)
      const form = el.closest('form, .moac-modal, .card');
      if (form) {
        const btn = form.querySelector('button.moac-btn, button[type="submit"]');
        if (btn) {
          btn.addEventListener('click', () => {
            try { localStorage.removeItem(key(el)); } catch (_) {}
          });
        }
      }
    }
    const scan = () => $$('.lp-auto, textarea.lp-auto, input.lp-auto').forEach(bind);
    scan();
    // re-scan when modals open (MutationObserver)
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ────────────────────────────────────────────────────────────────────────
  // INIT
  // ────────────────────────────────────────────────────────────────────────
  async function init() {
    injectStyle();
    const roleId = detectRoleId();
    if (!roleId || !ROLE_MAP[roleId]) {
      console.log('[MoacApp] no role detected for', location.pathname, '(skipping enhancer)');
      return;
    }
    const cfg = ROLE_MAP[roleId];
    const state = {
      roleId,
      roleName: cfg.roleName,
      level: cfg.level,
      reportsTo: cfg.reportsTo,
      canAssignTo: cfg.canAssignTo
    };
    window.MoacAppState = state;

    // K. bootstrap log
    console.log('[MoacApp] role=' + roleId + ' level=' + state.level +
      ' assignTo=' + (state.canAssignTo || []).length +
      ' reports→' + state.reportsTo);

    // Wait briefly for the page's #app to become visible (post-login), then
    // run injections. We don't *require* login — we just run when DOM is stable.
    setTimeout(async () => {
      await autoInitDelegate(state);
      injectActionBar(state);
      injectProfileBar(state);
      injectSidebarChain(state);
      setupShortcuts(state);
      setupAutosave(state);

      // Initial loads
      refreshLiveKpis(state);
      refreshNotifications(state);

      // Periodic refresh
      setInterval(() => refreshNotifications(state), 45000);
      setInterval(() => refreshLiveKpis(state), 5 * 60 * 1000);

      // Re-inject if topbar/sidebar appears later (post-login)
      const mo = new MutationObserver(() => {
        if ($('.topbar') && !$('#moac-app-bar'))   injectActionBar(state);
        if ($('.topbar') && !$('#moac-chip-wrap')) injectProfileBar(state);
        if ($('.sidebar') && !$('#moac-chain'))    injectSidebarChain(state);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose a tiny API for debugging
  window.MoacApp = {
    state: () => window.MoacAppState,
    refresh: () => {
      if (window.MoacAppState) {
        refreshLiveKpis(window.MoacAppState);
        refreshNotifications(window.MoacAppState);
      }
    },
    openAssign: () => window.MoacAppState && openAssignModal(window.MoacAppState),
    openReport: () => window.MoacAppState && openReportModal(window.MoacAppState),
    openTasks:  () => window.MoacAppState && openMyTasksModal(window.MoacAppState),
    roleMap: ROLE_MAP
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// MoacDirectives — Top-down Directive (คำสั่ง/นโยบาย) Cascade UI
//   Appended as a separate IIFE so it can't break existing MoacApp features.
//   Reads state from window.MoacAppState (set by the main MoacApp IIFE).
//   Adds:
//     1. Quick-Action buttons (📜 ออกคำสั่ง / 📥 คำสั่งที่ค้าง / 🌳 สายงานคำสั่ง)
//     2. Issue-Directive modal (รมว./ปลัด เท่านั้น)
//     3. Pending-Directives panel (3 tabs: รับทราบ · กระจาย · รายงานผล)
//     4. Cascade-Tree visualization
//     5. Auto-refresh pending badge every 60s
//   Gracefully hides itself when /api/moac/directives endpoints return 404.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  if (window.__MoacDirectivesLoaded) return;
  window.__MoacDirectivesLoaded = true;

  const API = (location.origin || '') + '/api/moac';
  const REFRESH_MS = 60 * 1000;
  let endpointsAvailable = null; // null = unknown, true/false after first probe
  let pendingCount = 0;

  // Format Buddhist year date (พ.ศ.)
  function fmtBE(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const be = d.getFullYear() + 543;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${dd}/${mm}/${be}`;
  }
  function fmtBEDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const be = d.getFullYear() + 543;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${be} ${hh}:${mi} น.`;
  }
  function daysUntil(iso) {
    if (!iso) return null;
    const d = new Date(iso).getTime();
    if (!d) return null;
    return Math.round((d - Date.now()) / (24 * 3600 * 1000));
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Network helpers (mirror MoacApp pattern; 404 = graceful disable)
  async function apiGet(path) {
    try {
      const r = await fetch(API + path, { headers: { Accept: 'application/json' } });
      if (r.status === 404) { endpointsAvailable = false; return null; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      endpointsAvailable = true;
      return await r.json();
    } catch (e) {
      console.warn('[MoacDirectives] GET ' + path + ' failed:', e.message);
      return null;
    }
  }
  async function apiPost(path, body) {
    try {
      const r = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'moac2026' },
        body: JSON.stringify(body || {})
      });
      if (r.status === 404) { endpointsAvailable = false; return { ok: false, error: '404' }; }
      return await r.json();
    } catch (e) {
      console.warn('[MoacDirectives] POST ' + path + ' failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // ── Style additions (namespaced to avoid clash with .moac-* in MoacApp)
  function injectStyle() {
    if (document.getElementById('moac-dir-style')) return;
    const css = `
      .moacdir-btn{background:#fff;border:1px solid #cfe3d4;color:#0b3d2e;padding:5px 11px;
        border-radius:18px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;
        display:inline-flex;align-items:center;gap:4px;transition:.15s;position:relative}
      .moacdir-btn:hover{background:#e6f4ea;border-color:#0b3d2e}
      .moacdir-btn.alert{background:linear-gradient(135deg,#7c2d12,#991b1b);color:#fff;border-color:#c9a227}
      .moacdir-btn .ct{background:#ef4444;color:#fff;font-size:10px;font-weight:700;border-radius:9px;
        min-width:16px;height:16px;padding:0 4px;display:inline-flex;align-items:center;justify-content:center;margin-left:3px}

      .moacdir-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:none;
        align-items:center;justify-content:center;font-family:Sarabun,sans-serif}
      .moacdir-modal-bg.open{display:flex}
      .moacdir-modal{background:#fff;border-radius:14px;width:min(720px,96vw);max-height:92vh;
        overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.4);border-top:4px solid #c9a227}
      .moacdir-modal .hd{padding:14px 18px;background:linear-gradient(90deg,#0b3d2e,#2d6a4f);color:#fff;
        font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;border-radius:14px 14px 0 0;position:sticky;top:0;z-index:2}
      .moacdir-modal .hd .x{margin-left:auto;background:none;border:none;color:#fff;font-size:18px;cursor:pointer}
      .moacdir-modal .bd{padding:16px 18px}

      .moacdir-fld{margin-bottom:11px}
      .moacdir-fld label{display:block;font-size:11.5px;font-weight:600;color:#444;margin-bottom:4px}
      .moacdir-fld input[type=text],.moacdir-fld input[type=date],.moacdir-fld select,.moacdir-fld textarea{width:100%;padding:8px 10px;
        border:1px solid #cfe3d4;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;box-sizing:border-box}
      .moacdir-fld textarea{resize:vertical;min-height:90px}
      .moacdir-radios{display:flex;gap:14px;flex-wrap:wrap;padding-top:2px}
      .moacdir-radios label{font-size:12.5px;color:#0b3d2e;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
      .moacdir-checks{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px}
      .moacdir-checks label{font-size:12.5px;color:#0b3d2e;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .moacdir-kpi-row{display:grid;grid-template-columns:2fr 1fr 1fr 28px;gap:6px;margin-bottom:5px;align-items:center}
      .moacdir-kpi-row input{padding:6px 8px;font-size:12px;border:1px solid #cfe3d4;border-radius:6px}
      .moacdir-kpi-row .rm{background:#fee2e2;color:#991b1b;border:none;width:24px;height:24px;border-radius:6px;cursor:pointer;font-weight:700}
      .moacdir-addkpi{background:#0b3d2e;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11.5px;cursor:pointer;font-weight:600;margin-top:4px}

      .moacdir-btn-primary{background:linear-gradient(135deg,#0b3d2e,#2d6a4f);color:#fff;border:none;
        padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
      .moacdir-btn-ghost{background:#fff;color:#0b3d2e;border:1px solid #cfe3d4;padding:9px 16px;
        border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}

      .moacdir-tabs{display:flex;gap:2px;border-bottom:1px solid #cfe3d4;margin-bottom:12px}
      .moacdir-tab{background:transparent;border:none;padding:9px 14px;font-size:12.5px;font-weight:600;
        color:#666;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
      .moacdir-tab.active{color:#0b3d2e;border-bottom-color:#c9a227}

      .moacdir-card{border:1px solid #cfe3d4;border-left:4px solid #c9a227;border-radius:10px;
        padding:11px 14px;margin-bottom:9px;background:#fff}
      .moacdir-card .code{font-size:11px;color:#666;font-family:monospace;font-weight:600}
      .moacdir-card .ttl{font-size:13.5px;font-weight:700;color:#0b3d2e;margin-top:2px}
      .moacdir-card .meta{font-size:11px;color:#666;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .moacdir-card .row{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}
      .moacdir-pri{display:inline-block;padding:1px 8px;border-radius:9px;font-size:10.5px;font-weight:700}
      .moacdir-pri.urgent{background:#fee2e2;color:#991b1b}
      .moacdir-pri.high{background:#fed7aa;color:#9a3412}
      .moacdir-pri.normal{background:#fef9c3;color:#854d0e}
      .moacdir-due-ok{color:#166534;font-weight:600}
      .moacdir-due-warn{color:#9a3412;font-weight:600}
      .moacdir-due-late{color:#991b1b;font-weight:700}
      .moacdir-mini{font-size:11px;padding:5px 11px;border-radius:6px;border:none;cursor:pointer;font-weight:600;font-family:inherit}
      .moacdir-mini.b1{background:#3b82f6;color:#fff}
      .moacdir-mini.b2{background:#22c55e;color:#fff}
      .moacdir-mini.b3{background:#c9a227;color:#fff}
      .moacdir-mini.b4{background:#7c2d12;color:#fff}

      .moacdir-empty{padding:30px;text-align:center;color:#999;font-size:13px}

      /* Cascade tree */
      .moacdir-tree-meta{padding:10px 14px;background:#f9f9f9;border-radius:10px;margin-bottom:12px;font-size:12px}
      .moacdir-tree-meta b{color:#0b3d2e}
      .moacdir-pct{font-size:22px;font-weight:700;color:#0b3d2e}
      .moacdir-tree{padding:8px 0}
      .moacdir-tree ul{list-style:none;padding-left:24px;margin:0;position:relative}
      .moacdir-tree ul::before{content:'';position:absolute;left:8px;top:0;bottom:14px;border-left:2px dashed #cfe3d4}
      .moacdir-tree li{position:relative;padding:6px 0 6px 18px;font-size:12px}
      .moacdir-tree li::before{content:'';position:absolute;left:0;top:14px;width:16px;border-top:2px dashed #cfe3d4}
      .moacdir-tree li:first-child::before{display:block}
      .moacdir-node{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:14px;
        border:1px solid #cfe3d4;background:#fff;font-weight:600;cursor:pointer;font-size:12px}
      .moacdir-node.s-pending{background:#f3f4f6;color:#444}
      .moacdir-node.s-in_progress{background:#dbeafe;color:#1e40af;border-color:#bfdbfe}
      .moacdir-node.s-achieved{background:#dcfce7;color:#166534;border-color:#bbf7d0}
      .moacdir-node.s-failed{background:#fee2e2;color:#991b1b;border-color:#fecaca}
      .moacdir-node.s-overdue{background:#fef3c7;color:#92400e;border-color:#fde68a}
      .moacdir-node .dot{width:8px;height:8px;border-radius:50%;background:currentColor}
      .moacdir-node .ack{font-size:10.5px;font-weight:500;color:#666;margin-left:2px}

      .moacdir-detail{border:1px solid #cfe3d4;border-radius:10px;padding:11px 14px;margin-top:10px;background:#f9f9f9;font-size:12.5px;display:none}
      .moacdir-detail.open{display:block}
    `;
    const s = document.createElement('style');
    s.id = 'moac-dir-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── Compute subordinates from MoacApp role map (for "กระจายคำสั่ง" target list)
  function subordinatesOf(state) {
    return (state.canAssignTo || []).slice();
  }

  // ── Role-level capabilities
  function canIssueDirective(level) {
    return level === 'minister' || level === 'ps' || level === 'dep-minister';
  }
  function canSeeDirectivePanels(level) {
    return level !== 'staff'; // staff can still see pending list (it's their inbox)
  }

  // ── Inject Quick-Action buttons into existing #moac-app-bar
  function injectButtons(state) {
    const bar = document.getElementById('moac-app-bar');
    if (!bar || document.getElementById('moacdir-buttons')) return;
    if (endpointsAvailable === false) return; // hidden after 404

    const span = document.createElement('span');
    span.id = 'moacdir-buttons';
    span.style.cssText = 'display:inline-flex;gap:6px;margin-left:8px;padding-left:8px;border-left:1px solid rgba(11,61,46,.18)';

    let html = '';
    if (canIssueDirective(state.level)) {
      html += '<button class="moacdir-btn alert" data-mdir="issue">📜 ออกคำสั่ง/นโยบายใหม่</button>';
    }
    // Pending (everyone — staff included so they see directives that landed on them)
    html += '<button class="moacdir-btn" data-mdir="pending">📥 คำสั่งที่ค้าง<span class="ct" id="moacdir-pending-ct" style="display:none">0</span></button>';
    // Cascade tree (everyone)
    html += '<button class="moacdir-btn" data-mdir="tree">🌳 สายงานคำสั่ง</button>';

    span.innerHTML = html;
    bar.appendChild(span);
    span.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mdir]');
      if (!b) return;
      const act = b.dataset.mdir;
      if (act === 'issue') openIssueModal(state);
      else if (act === 'pending') openPendingPanel(state);
      else if (act === 'tree') openCascadeTreeBrowser(state);
    });
  }

  // ── Modal infrastructure
  function ensureModalRoot() {
    let m = document.getElementById('moacdir-modal-bg');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'moacdir-modal-bg';
    m.className = 'moacdir-modal-bg';
    m.innerHTML = '<div class="moacdir-modal" role="dialog"></div>';
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
    document.body.appendChild(m);
    return m;
  }
  function openModal(titleHtml, bodyHtml) {
    const m = ensureModalRoot();
    m.querySelector('.moacdir-modal').innerHTML =
      '<div class="hd">' + titleHtml + '<button class="x" onclick="window.__moacdirCloseModal()">×</button></div>' +
      '<div class="bd">' + bodyHtml + '</div>';
    m.classList.add('open');
    return m;
  }
  function closeModal() {
    const m = document.getElementById('moacdir-modal-bg');
    if (m) m.classList.remove('open');
  }
  window.__moacdirCloseModal = closeModal;
  function toast(msg) {
    let el = document.getElementById('moacdir-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'moacdir-flash';
      el.style.cssText = 'position:fixed;bottom:84px;right:24px;background:#0b3d2e;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.3);z-index:10001;font-family:Sarabun,sans-serif;opacity:0;transition:.2s;transform:translateY(8px)';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, 2600);
  }

  // ── Issue Directive Modal ─────────────────────────────────────────────────
  async function openIssueModal(state) {
    // Pre-fetch policies for the dropdown
    let policies = [];
    try {
      const r = await fetch(API + '/policies');
      const j = await r.json();
      policies = (j && j.policies) || [];
    } catch (_) {}

    const TARGETS = [
      { v: 'ps',           t: 'ปลัดกระทรวง' },
      { v: 'deputy-ps',    t: 'รองปลัดกระทรวง' },
      { v: 'dept-head',    t: 'อธิบดี' },
      { v: 'dept-deputy',  t: 'รองอธิบดี' },
      { v: 'dept-staff',   t: 'นักวิชาการ/เจ้าหน้าที่กรม' },
      { v: 'provincial',   t: 'หน่วยงานระดับจังหวัด' }
    ];
    const policiesOpts = '<option value="">— ไม่เชื่อมโยง —</option>' +
      policies.map((p, i) => `<option value="${esc(p.code || ('P' + (i + 1)))}">${esc(p.name || p.title || ('นโยบาย ' + (i + 1)))}</option>`).join('');

    const html = `
      <form id="moacdir-issue-form" autocomplete="off">
        <div class="moacdir-fld">
          <label>หัวข้อคำสั่ง <span style="color:#991b1b">*</span></label>
          <input type="text" name="title" required placeholder="ตัวอย่าง: ลดราคาปุ๋ยให้เกษตรกรร้อยละ 30 ภายในไตรมาส 3">
        </div>
        <div class="moacdir-fld">
          <label>ระดับความสำคัญ</label>
          <div class="moacdir-radios">
            <label><input type="radio" name="priority" value="normal" checked> ปกติ</label>
            <label><input type="radio" name="priority" value="high"> สูง</label>
            <label><input type="radio" name="priority" value="urgent"> ด่วน</label>
          </div>
        </div>
        <div class="moacdir-fld">
          <label>หมวดคำสั่ง</label>
          <div class="moacdir-radios">
            <label><input type="radio" name="category" value="policy" checked> นโยบาย</label>
            <label><input type="radio" name="category" value="regulation"> กฎระเบียบ</label>
            <label><input type="radio" name="category" value="urgent_order"> คำสั่งด่วน</label>
            <label><input type="radio" name="category" value="cabinet_resolution"> มติคณะรัฐมนตรี</label>
          </div>
        </div>
        <div class="moacdir-fld">
          <label>เนื้อหาคำสั่ง / รายละเอียดประกอบ</label>
          <textarea name="body" placeholder="กล่าวถึงเจตนารมณ์ ขอบเขต และแนวทางการดำเนินงาน…"></textarea>
        </div>
        <div class="moacdir-fld">
          <label>กำหนดผลภายใน</label>
          <input type="date" name="dueDate">
        </div>
        <div class="moacdir-fld">
          <label>ระดับชั้นที่ต้องรับทราบและถือปฏิบัติ (เลือกได้มากกว่าหนึ่ง) <span style="color:#991b1b">*</span></label>
          <div class="moacdir-checks">
            ${TARGETS.map(t => `<label><input type="checkbox" name="targetLevel" value="${t.v}"> ${t.t}</label>`).join('')}
          </div>
        </div>
        <div class="moacdir-fld">
          <label>ตัวชี้วัด (KPI) สำหรับวัดผลความสำเร็จ</label>
          <div id="moacdir-kpis"></div>
          <button type="button" class="moacdir-addkpi" id="moacdir-addkpi">+ เพิ่ม KPI</button>
        </div>
        <div class="moacdir-fld">
          <label>เชื่อมโยงนโยบายกระทรวง</label>
          <select name="relatedPolicyId">${policiesOpts}</select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;border-top:1px solid #eee;padding-top:14px">
          <button type="button" class="moacdir-btn-ghost" onclick="window.__moacdirCloseModal()">ยกเลิก</button>
          <button type="submit" class="moacdir-btn-primary">📜 ออกคำสั่งและกระจายไปยังผู้รับ</button>
        </div>
      </form>
    `;
    openModal('📜 ออกคำสั่ง/นโยบายใหม่ — ' + esc(state.roleName), html);

    const kpiBox = document.getElementById('moacdir-kpis');
    function addKpiRow(k) {
      const row = document.createElement('div');
      row.className = 'moacdir-kpi-row';
      row.innerHTML = `
        <input type="text" placeholder="หัวข้อ KPI" data-k="name" value="${esc((k && k.name) || '')}">
        <input type="text" placeholder="ค่าเป้าหมาย" data-k="target" value="${esc((k && k.target) || '')}">
        <input type="text" placeholder="หน่วย" data-k="unit" value="${esc((k && k.unit) || '')}">
        <button type="button" class="rm" title="ลบ">×</button>
      `;
      row.querySelector('.rm').onclick = () => row.remove();
      kpiBox.appendChild(row);
    }
    addKpiRow();
    document.getElementById('moacdir-addkpi').onclick = () => addKpiRow();

    document.getElementById('moacdir-issue-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const targetLevel = fd.getAll('targetLevel');
      if (!targetLevel.length) { toast('กรุณาเลือกระดับชั้นที่ต้องรับทราบ'); return; }
      const kpis = Array.from(kpiBox.querySelectorAll('.moacdir-kpi-row')).map(r => ({
        name: r.querySelector('[data-k=name]').value.trim(),
        target: r.querySelector('[data-k=target]').value.trim(),
        unit: r.querySelector('[data-k=unit]').value.trim()
      })).filter(k => k.name);
      const payload = {
        issuedBy: state.roleId,
        issuedByName: state.roleName,
        title: fd.get('title'),
        body: fd.get('body'),
        category: fd.get('category'),
        priority: fd.get('priority'),
        dueDate: fd.get('dueDate') || null,
        targetLevel,
        kpis,
        relatedPolicyId: fd.get('relatedPolicyId') || null,
        attachments: []
      };
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
      const r = await apiPost('/directives', payload);
      if (r && r.ok) {
        toast('ออกคำสั่ง ' + (r.code || '') + ' เรียบร้อย');
        closeModal();
        refreshPendingBadge(state);
      } else {
        btn.disabled = false; btn.textContent = '📜 ออกคำสั่งและกระจายไปยังผู้รับ';
        toast('ไม่สามารถบันทึกได้: ' + ((r && r.error) || 'ไม่ทราบสาเหตุ'));
      }
    });
  }

  // ── Pending Directives Panel ──────────────────────────────────────────────
  async function openPendingPanel(state) {
    const data = await apiGet('/directives/active-for/' + encodeURIComponent(state.roleId));
    if (!data) { toast('ระบบคำสั่งยังไม่พร้อมใช้งาน'); return; }
    const _ack = data.need_ack || [];
    const _cas = data.need_cascade || [];
    const _rep = data.need_report || [];

    const tabBtn = (id, label, n) => `<button class="moacdir-tab${id==='ack'?' active':''}" data-tab="${id}">${label}${n ? ` (${n})` : ''}</button>`;
    const head = `
      <div class="moacdir-tabs">
        ${tabBtn('ack',  '📥 รอรับทราบ', _ack.length)}
        ${tabBtn('cas',  '⚙️ ต้องกระจายต่อ', _cas.length)}
        ${tabBtn('rep',  '✅ ต้องรายงานผล', _rep.length)}
      </div>
      <div id="moacdir-tabbody"></div>
    `;
    openModal('📥 คำสั่งที่ค้าง — ' + esc(state.roleName), head);

    const body = document.getElementById('moacdir-tabbody');
    function render(tab) {
      let arr = [], renderer = renderAckItem;
      if (tab === 'ack') { arr = _ack; renderer = renderAckItem; }
      else if (tab === 'cas') { arr = _cas; renderer = renderCascadeItem; }
      else if (tab === 'rep') { arr = _rep; renderer = renderReportItem; }
      if (!arr.length) { body.innerHTML = '<div class="moacdir-empty">— ไม่มีคำสั่งในหมวดนี้ —</div>'; return; }
      body.innerHTML = arr.map(renderer).join('');
      // Wire per-card buttons
      body.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', () => handleCardAction(btn.dataset.act, btn.dataset.id, state));
      });
      // Wire 🤖 AI badges → click opens detail modal jumped to AI tab; also lazy-probe status
      body.querySelectorAll('[data-aibadge]').forEach(b => {
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openDirectiveDetail(b.dataset.aibadge, state, { tab: 'ai' });
        });
      });
      if (window.MoacDirectiveAI && typeof window.MoacDirectiveAI.refreshBadges === 'function') {
        window.MoacDirectiveAI.refreshBadges(body);
      }
    }
    function renderAckItem(d) { return directiveCard(d, ['ack']); }
    function renderCascadeItem(d) { return directiveCard(d, ['cascade']); }
    function renderReportItem(d) { return directiveCard(d, ['report']); }

    document.querySelector('#moacdir-modal-bg .moacdir-tabs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      document.querySelectorAll('#moacdir-modal-bg .moacdir-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      render(t.dataset.tab);
    });
    render('ack');
  }

  function directiveCard(d, actions) {
    const due = daysUntil(d.dueDate);
    let dueLabel = '—', dueCls = 'moacdir-due-ok';
    if (d.overdue) { dueLabel = 'เลยกำหนดแล้ว'; dueCls = 'moacdir-due-late'; }
    else if (due == null) { dueLabel = 'ไม่กำหนด'; dueCls = ''; }
    else if (due < 0) { dueLabel = 'ครบกำหนด ' + Math.abs(due) + ' วันที่แล้ว'; dueCls = 'moacdir-due-late'; }
    else if (due <= 7) { dueLabel = 'อีก ' + due + ' วัน'; dueCls = 'moacdir-due-warn'; }
    else { dueLabel = 'อีก ' + due + ' วัน (กำหนด ' + fmtBE(d.dueDate) + ')'; }

    let btns = '';
    if (actions.includes('ack')) btns += `<button class="moacdir-mini b2" data-act="ack" data-id="${esc(d.id)}">รับทราบคำสั่ง</button>`;
    if (actions.includes('cascade')) btns += `<button class="moacdir-mini b1" data-act="cascade" data-id="${esc(d.id)}">กระจายคำสั่งให้ผู้ใต้บังคับบัญชา</button>`;
    if (actions.includes('report')) btns += `<button class="moacdir-mini b3" data-act="report" data-id="${esc(d.id)}">รายงานผลการปฏิบัติ</button>`;
    btns += `<button class="moacdir-mini b4" data-act="view" data-id="${esc(d.id)}">ดูรายละเอียด</button>`;

    return `
      <div class="moacdir-card" data-dirid="${esc(d.id)}">
        <div class="code">${esc(d.code || d.id)}</div>
        <div class="ttl">${esc(d.title)}</div>
        <div class="meta">
          <span class="moacdir-pri ${esc(d.priority || 'normal')}">${({urgent:'⚠️ ด่วน',high:'⚡ สูง',normal:'ปกติ'})[d.priority] || 'ปกติ'}</span>
          <span>ออกโดย: <b>${esc(d.issuedByName || '')}</b></span>
          <span>วันที่: ${esc(fmtBE(d.issuedAt))}</span>
          <span class="${dueCls}">กำหนด: ${esc(dueLabel)}</span>
          <span class="moacdir-aibadge" data-aibadge="${esc(d.id)}" title="คลิกเพื่อดู AI แนะนำ">🤖 <span class="lbl">กำลังตรวจ AI…</span></span>
        </div>
        <div class="row">${btns}</div>
      </div>
    `;
  }

  async function handleCardAction(act, id, state) {
    if (act === 'ack') return doAcknowledge(id, state);
    if (act === 'cascade') return openCascadeModal(id, state);
    if (act === 'report') return openComplianceModal(id, state);
    if (act === 'view') return openDirectiveDetail(id, state);
  }

  async function doAcknowledge(id, state) {
    const note = window.prompt('บันทึกการรับทราบ (ไม่บังคับ):', '') || '';
    const r = await apiPost('/directives/' + encodeURIComponent(id) + '/acknowledge', {
      roleId: state.roleId, roleName: state.roleName, note
    });
    if (r && r.ok) {
      toast('รับทราบคำสั่งเรียบร้อย');
      closeModal();
      setTimeout(() => openPendingPanel(state), 200);
      refreshPendingBadge(state);
    } else {
      toast('ไม่สำเร็จ: ' + ((r && r.error) || ''));
    }
  }

  function openCascadeModal(id, state) {
    const subs = subordinatesOf(state);
    if (!subs.length) {
      toast('ไม่มีผู้ใต้บังคับบัญชาที่จะกระจายคำสั่งต่อ');
      return;
    }
    const html = `
      <p style="font-size:12.5px;color:#444;margin:0 0 10px">เลือกผู้ใต้บังคับบัญชาที่จะกระจายคำสั่งให้ — ทุกคนที่เลือกจะต้องรับทราบและรายงานผลกลับ</p>
      <div class="moacdir-checks" id="moacdir-cas-list" style="grid-template-columns:1fr">
        ${subs.map(s => `<label><input type="checkbox" value="${esc(s.id)}" data-name="${esc(s.name)}"> ${esc(s.name)} <span style="color:#999;font-size:11px">(${esc(s.id)})</span></label>`).join('')}
      </div>
      <div class="moacdir-fld" style="margin-top:12px">
        <label>บันทึกประกอบการกระจายคำสั่ง</label>
        <textarea id="moacdir-cas-note" placeholder="เช่น ให้ดำเนินการตามเขตพื้นที่รับผิดชอบ…"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button class="moacdir-btn-ghost" onclick="window.__moacdirCloseModal()">ยกเลิก</button>
        <button class="moacdir-btn-primary" id="moacdir-cas-submit">📤 กระจายคำสั่ง</button>
      </div>
    `;
    openModal('⚙️ กระจายคำสั่งให้ผู้ใต้บังคับบัญชา', html);
    document.getElementById('moacdir-cas-submit').onclick = async () => {
      const checks = Array.from(document.querySelectorAll('#moacdir-cas-list input:checked'));
      if (!checks.length) { toast('กรุณาเลือกอย่างน้อยหนึ่งราย'); return; }
      const toRoleIds = checks.map(c => c.value);
      const toRoleNames = checks.map(c => c.dataset.name);
      const note = document.getElementById('moacdir-cas-note').value.trim();
      const r = await apiPost('/directives/' + encodeURIComponent(id) + '/cascade', {
        fromRoleId: state.roleId, fromRoleName: state.roleName,
        toRoleIds, toRoleNames, note
      });
      if (r && r.ok) {
        toast('กระจายคำสั่งสำเร็จ → ' + toRoleIds.length + ' ราย');
        closeModal();
        refreshPendingBadge(state);
      } else {
        toast('ไม่สำเร็จ: ' + ((r && r.error) || ''));
      }
    };
  }

  function openComplianceModal(id, state) {
    const html = `
      <div class="moacdir-fld">
        <label>สถานะการปฏิบัติ</label>
        <div class="moacdir-radios">
          <label><input type="radio" name="comp" value="in_progress" checked> กำลังดำเนินการ</label>
          <label><input type="radio" name="comp" value="achieved"> บรรลุผลแล้ว</label>
          <label><input type="radio" name="comp" value="failed"> ไม่สามารถดำเนินการได้</label>
        </div>
      </div>
      <div class="moacdir-fld">
        <label>ร้อยละความคืบหน้า (0–100)</label>
        <input type="text" id="moacdir-comp-pct" value="50" inputmode="numeric">
      </div>
      <div class="moacdir-fld">
        <label>บันทึกหลักฐาน/รายละเอียดประกอบการรายงาน</label>
        <textarea id="moacdir-comp-note" placeholder="เช่น แจ้งหน่วยงานในเขตพื้นที่ ดำเนินการแล้ว 7 จาก 12 จังหวัด…"></textarea>
      </div>
      <div class="moacdir-fld">
        <label>ลิงก์เอกสารแนบ (URL)</label>
        <input type="text" id="moacdir-comp-url" placeholder="https://…">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button class="moacdir-btn-ghost" onclick="window.__moacdirCloseModal()">ยกเลิก</button>
        <button class="moacdir-btn-primary" id="moacdir-comp-submit">📨 ส่งรายงานความก้าวหน้า</button>
      </div>
    `;
    openModal('✅ รายงานความก้าวหน้า / ผลการปฏิบัติตามคำสั่ง', html);
    document.getElementById('moacdir-comp-submit').onclick = async () => {
      const comp = document.querySelector('input[name=comp]:checked').value;
      const pct = Math.max(0, Math.min(100, parseInt(document.getElementById('moacdir-comp-pct').value, 10) || 0));
      const note = document.getElementById('moacdir-comp-note').value.trim();
      const url = document.getElementById('moacdir-comp-url').value.trim();
      const evidence = [];
      if (note || url) evidence.push({ type: url ? 'link' : 'note', url: url || null, note });
      const r = await apiPost('/directives/' + encodeURIComponent(id) + '/compliance', {
        roleId: state.roleId, compliance: comp, compliancePct: pct, evidence
      });
      if (r && r.ok) {
        toast('รายงานความก้าวหน้าเรียบร้อย');
        closeModal();
        refreshPendingBadge(state);
      } else {
        toast('ไม่สำเร็จ: ' + ((r && r.error) || ''));
      }
    };
  }

  // ── Cascade Tree Visualization ────────────────────────────────────────────
  async function openCascadeTreeBrowser(state) {
    // List recent directives so the user can pick one to visualize
    const data = await apiGet('/directives?limit=50');
    if (!data) { toast('ระบบคำสั่งยังไม่พร้อมใช้งาน'); return; }
    const list = (data.directives || []);
    if (!list.length) {
      openModal('🌳 สายงานคำสั่ง', '<div class="moacdir-empty">— ยังไม่มีคำสั่งในระบบ —</div>');
      return;
    }
    const opts = list.map(d => `<option value="${esc(d.id)}">${esc(d.code)} · ${esc(d.title)}</option>`).join('');
    openModal('🌳 สายงานคำสั่ง — เลือกคำสั่งเพื่อดูแผนภาพการกระจาย', `
      <div class="moacdir-fld">
        <label>คำสั่งที่ต้องการแสดง</label>
        <select id="moacdir-tree-pick">${opts}</select>
      </div>
      <div id="moacdir-tree-host"></div>
    `);
    const sel = document.getElementById('moacdir-tree-pick');
    sel.onchange = () => renderCascadeTree(sel.value);
    renderCascadeTree(sel.value);
  }

  async function renderCascadeTree(directiveId) {
    const host = document.getElementById('moacdir-tree-host');
    if (!host) return;
    host.innerHTML = '<div class="moacdir-empty">กำลังโหลด…</div>';
    const data = await apiGet('/directives/' + encodeURIComponent(directiveId));
    if (!data || !data.ok) { host.innerHTML = '<div class="moacdir-empty">โหลดไม่สำเร็จ</div>'; return; }
    const d = data.directive;
    const s = data.summary || {};
    const cascades = d.cascades || [];
    const acks = d.acknowledgements || [];

    // Build child map: fromRoleId → [{toRoleId,toRoleName}]
    const children = {};
    cascades.forEach(c => {
      if (!children[c.fromRoleId]) children[c.fromRoleId] = [];
      c.toRoleIds.forEach((rid, i) => {
        if (!children[c.fromRoleId].some(x => x.id === rid)) {
          children[c.fromRoleId].push({ id: rid, name: (c.toRoleNames && c.toRoleNames[i]) || rid });
        }
      });
    });
    function ackOf(rid) { return acks.find(a => a.roleId === rid); }
    function stateClass(rid) {
      const a = ackOf(rid);
      if (!a) return 's-pending';
      if (a.compliance === 'achieved') return 's-achieved';
      if (a.compliance === 'failed') return 's-failed';
      if (a.compliance === 'in_progress') return 's-in_progress';
      if (s.overdue && !a.acknowledgedAt) return 's-overdue';
      return 's-pending';
    }
    function buildNode(rid, name) {
      const a = ackOf(rid);
      const cls = stateClass(rid);
      const ackTxt = a && a.acknowledgedAt ? '✓ รับทราบแล้ว' : 'รอรับทราบ';
      const pct = a && typeof a.compliancePct === 'number' ? a.compliancePct + '%' : '';
      const kids = children[rid] || [];
      let html = `<li><span class="moacdir-node ${cls}" data-rid="${esc(rid)}"><span class="dot"></span>${esc(name)} <span class="ack">${esc(ackTxt)} ${pct ? '· ' + pct : ''}</span></span>`;
      if (kids.length) {
        html += '<ul>' + kids.map(k => buildNode(k.id, k.name)).join('') + '</ul>';
      }
      html += '</li>';
      return html;
    }

    const summary = s || {};
    host.innerHTML = `
      <div class="moacdir-tree-meta">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div><div style="font-size:11px;color:#666">ภาพรวมความสำเร็จ</div><div class="moacdir-pct">${summary.overallCompliancePct || 0}%</div></div>
          <div style="font-size:11.5px">
            <div><b>${esc(d.code)}</b> · ${esc(d.title)}</div>
            <div style="color:#666;margin-top:2px">ออกโดย: ${esc(d.issuedByName || '')} · ออกเมื่อ ${esc(fmtBEDateTime(d.issuedAt))}</div>
            <div style="color:#666">กำหนดผลภายใน: ${esc(d.dueDate ? fmtBE(d.dueDate) : '—')} ${summary.overdue ? '<span style="color:#991b1b;font-weight:700">· เลยกำหนด</span>' : ''}</div>
            <div style="color:#666;margin-top:2px">รับทราบแล้ว ${summary.counts ? (summary.counts.achieved + summary.counts.in_progress) : 0} / ${summary.totalEntries || acks.length} · บรรลุผล ${summary.counts ? summary.counts.achieved : 0} · ค้าง ${summary.stragglerCount || 0}</div>
          </div>
        </div>
      </div>
      <div class="moacdir-tree"><ul>${buildNode(d.issuedBy, d.issuedByName || d.issuedBy)}</ul></div>
      <div class="moacdir-detail" id="moacdir-tree-detail"></div>
    `;
    // Click any node → drill in
    host.querySelectorAll('.moacdir-node').forEach(n => {
      n.addEventListener('click', () => {
        const rid = n.dataset.rid;
        const a = ackOf(rid) || { roleId: rid, roleName: rid };
        const det = document.getElementById('moacdir-tree-detail');
        det.classList.add('open');
        det.innerHTML = `
          <div style="font-weight:700;color:#0b3d2e;margin-bottom:4px">${esc(a.roleName || rid)}</div>
          <div>สถานะรับทราบ: <b>${a.acknowledgedAt ? 'รับทราบแล้ว ' + esc(fmtBEDateTime(a.acknowledgedAt)) : 'ยังไม่รับทราบ'}</b></div>
          <div>การปฏิบัติ: <b>${esc(({pending:'รอเริ่ม',in_progress:'กำลังดำเนินการ',achieved:'บรรลุผล',failed:'ไม่สามารถดำเนินการได้'})[a.compliance] || a.compliance || '—')}</b> · ${typeof a.compliancePct === 'number' ? esc(a.compliancePct) + '%' : '—'}</div>
          ${a.acknowledgmentNote ? `<div style="margin-top:4px">บันทึกการรับทราบ: ${esc(a.acknowledgmentNote)}</div>` : ''}
          ${a.reportedAt ? `<div>รายงานล่าสุด: ${esc(fmtBEDateTime(a.reportedAt))}</div>` : ''}
          ${(a.evidence || []).length ? `<div style="margin-top:4px"><b>หลักฐาน:</b><ul style="margin:4px 0 0 18px">${a.evidence.map(e => `<li>${esc(e.note || '')} ${e.url ? `· <a href="${esc(e.url)}" target="_blank">เปิดเอกสาร</a>` : ''}</li>`).join('')}</ul></div>` : ''}
        `;
      });
    });
  }

  async function openDirectiveDetail(id, state, opts) {
    opts = opts || {};
    closeModal();
    const data = await apiGet('/directives/' + encodeURIComponent(id));
    if (!data || !data.ok) { toast('โหลดรายละเอียดไม่สำเร็จ'); return; }
    const d = data.directive;
    const s = data.summary || {};
    const kpis = (d.kpis || []).map(k => `<li>${esc(k.name)} <b>${esc(k.target)}</b> ${esc(k.unit || '')}</li>`).join('');

    // Tabbed layout: 📋 รายละเอียด · 🤖 AI แนะนำ · 🌳 สายงาน · 📊 สถานะการปฏิบัติ
    const initialTab = opts.tab || 'detail';
    const tabBtn = (id, label) =>
      `<button class="moacdir-tab${id===initialTab?' active':''}" data-dtab="${id}">${label}</button>`;

    openModal('📜 ' + esc(d.code) + ' — ' + esc(d.title), `
      <div class="moacdir-tabs">
        ${tabBtn('detail',     '📋 รายละเอียดคำสั่ง')}
        ${tabBtn('ai',         '🤖 AI แนะนำ')}
        ${tabBtn('cascade',    '🌳 สายงาน')}
        ${tabBtn('compliance', '📊 สถานะการปฏิบัติ')}
      </div>
      <div id="moacdir-detail-tabbody" style="margin-top:10px"></div>
    `);

    const body = document.getElementById('moacdir-detail-tabbody');

    function renderDetail() {
      body.innerHTML = `
        <div style="font-size:12.5px;line-height:1.7">
          <div><b>หมวด:</b> ${esc(d.category)} · <b>ระดับความสำคัญ:</b> ${esc(d.priority)} · <b>สถานะ:</b> ${esc(d.status)}</div>
          <div><b>ออกโดย:</b> ${esc(d.issuedByName)} · เมื่อ ${esc(fmtBEDateTime(d.issuedAt))}</div>
          <div><b>กำหนดผลภายใน:</b> ${esc(d.dueDate ? fmtBE(d.dueDate) : '—')} ${s.overdue ? '<span style="color:#991b1b;font-weight:700">· เลยกำหนด</span>' : ''}</div>
          <div><b>ระดับชั้นเป้าหมาย:</b> ${(d.targetLevel || []).map(esc).join(', ')}</div>
          <div style="margin-top:8px;white-space:pre-wrap">${esc(d.body || '')}</div>
          ${kpis ? `<div style="margin-top:10px"><b>ตัวชี้วัด (KPI):</b><ul style="margin:4px 0 0 18px">${kpis}</ul></div>` : ''}
          <div style="margin-top:10px"><b>ผลรวมการปฏิบัติ:</b> <span class="moacdir-pct" style="font-size:16px">${s.overallCompliancePct || 0}%</span> · บรรลุ ${(s.counts && s.counts.achieved) || 0} / ${s.totalEntries || 0}</div>
        </div>
      `;
    }
    function renderCascadeInline() {
      body.innerHTML = '<div id="moacdir-tree-host" class="moacdir-empty">กำลังโหลดแผนภาพสายงาน…</div>';
      // Re-use the existing tree renderer
      renderCascadeTree(d.id);
    }
    function renderCompliance() {
      const lvls = s.byLevel || {};
      const levelRows = Object.keys(lvls).map(lv => {
        const b = lvls[lv];
        return `<tr><td>${esc(lv)}</td><td>${b.total}</td><td>${b.achieved||0}</td><td>${b.in_progress||0}</td><td>${b.pending||0}</td><td>${b.avgPct||0}%</td></tr>`;
      }).join('');
      const stragRows = (s.stragglers || []).map(x =>
        `<tr><td>${esc(x.roleName || x.roleId)}</td><td>${esc(x.level || '-')}</td><td>${esc(x.reason)}</td><td>${x.compliancePct != null ? esc(x.compliancePct) + '%' : '—'}</td></tr>`
      ).join('');
      body.innerHTML = `
        <div style="font-size:12.5px;line-height:1.7">
          <div><b>ผลรวมการปฏิบัติ:</b> <span class="moacdir-pct" style="font-size:18px">${s.overallCompliancePct || 0}%</span></div>
          <div style="margin-top:4px;color:#444">บรรลุ ${(s.counts && s.counts.achieved) || 0} · กำลังดำเนินการ ${(s.counts && s.counts.in_progress) || 0} · ค้าง ${(s.counts && s.counts.pending) || 0} · ไม่สามารถดำเนินการ ${(s.counts && s.counts.failed) || 0} · รวม ${s.totalEntries || 0} ราย</div>
          <h4 style="margin:14px 0 4px;font-size:13px;color:#0b3d2e">สถานะแยกตามระดับ</h4>
          <table style="width:100%;border-collapse:collapse;font-size:11.5px">
            <thead><tr style="background:#f1f8f4"><th style="text-align:left;padding:5px">ระดับ</th><th>ทั้งหมด</th><th>บรรลุ</th><th>กำลังทำ</th><th>ค้าง</th><th>เฉลี่ย%</th></tr></thead>
            <tbody>${levelRows || '<tr><td colspan="6" style="text-align:center;color:#999;padding:8px">— ยังไม่มีข้อมูล —</td></tr>'}</tbody>
          </table>
          <h4 style="margin:14px 0 4px;font-size:13px;color:#0b3d2e">รายชื่อค้างปฏิบัติ (${(s.stragglers || []).length})</h4>
          <table style="width:100%;border-collapse:collapse;font-size:11.5px">
            <thead><tr style="background:#fff7ed"><th style="text-align:left;padding:5px">ผู้รับผิดชอบ</th><th>ระดับ</th><th>สาเหตุ</th><th>%</th></tr></thead>
            <tbody>${stragRows || '<tr><td colspan="4" style="text-align:center;color:#999;padding:8px">— ไม่มีรายการค้าง —</td></tr>'}</tbody>
          </table>
        </div>
      `;
    }

    function pick(t) {
      Array.from(document.querySelectorAll('#moacdir-modal-bg [data-dtab]')).forEach(b =>
        b.classList.toggle('active', b.dataset.dtab === t));
      if (t === 'detail') return renderDetail();
      if (t === 'cascade') return renderCascadeInline();
      if (t === 'compliance') return renderCompliance();
      if (t === 'ai') return window.MoacDirectiveAI && window.MoacDirectiveAI.renderInto(body, d, state);
    }
    document.querySelector('#moacdir-modal-bg .moacdir-tabs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-dtab]');
      if (t) pick(t.dataset.dtab);
    });
    pick(initialTab);
  }

  // ── Auto-refresh badge
  async function refreshPendingBadge(state) {
    if (endpointsAvailable === false) return;
    const data = await apiGet('/directives/active-for/' + encodeURIComponent(state.roleId));
    if (!data) return;
    pendingCount = (data.need_ack_count || 0) + (data.need_cascade_count || 0) + (data.need_report_count || 0);
    const ct = document.getElementById('moacdir-pending-ct');
    if (ct) {
      if (pendingCount > 0) { ct.style.display = 'inline-flex'; ct.textContent = pendingCount; }
      else { ct.style.display = 'none'; }
    }
  }

  // ── Boot
  function boot() {
    if (!window.MoacAppState) {
      // Wait for MoacApp to initialize first
      setTimeout(boot, 400);
      return;
    }
    const state = window.MoacAppState;
    injectStyle();
    injectButtons(state);
    refreshPendingBadge(state);

    // Print bootstrap line per spec
    console.log('[MoacDirectives] role=' + state.roleId + ' pendingCount=' + pendingCount);

    // Auto-refresh every 60s
    setInterval(() => refreshPendingBadge(state), REFRESH_MS);

    // Re-inject buttons if action bar gets rebuilt by MoacApp
    const mo = new MutationObserver(() => {
      if (document.getElementById('moac-app-bar') && !document.getElementById('moacdir-buttons')) {
        injectButtons(state);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Public mini-API
    window.MoacDirectives = {
      openIssue: () => openIssueModal(state),
      openPending: () => openPendingPanel(state),
      openTree: () => openCascadeTreeBrowser(state),
      refresh: () => refreshPendingBadge(state)
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// MoacDirectiveAI — AI advisory tab (🤖 AI แนะนำ) inside directive detail modal
//   Adds rendering for the new "ai" tab, polls server when advisory is still
//   being generated, paints quick-glance badges in pending list cards.
//   Exposes window.MoacDirectiveAI = { renderInto(host, directive, state),
//                                      refreshBadges(scopeEl) }
//   Endpoints used:
//     GET  /api/moac/directives/:id/advisory
//     POST /api/moac/directives/:id/refresh-advisory   (x-api-key: moac2026)
//     POST /api/moac/directives/:id/role-advisory      ({ roleId })
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__MoacDirectiveAILoaded) return;
  window.__MoacDirectiveAILoaded = true;

  const API = (location.origin || '') + '/api/moac';
  const POLL_MS = 10000;
  const LVL_TH = {
    ps: 'ปลัดกระทรวง',
    'deputy-ps': 'รองปลัดกระทรวง',
    'dept-head': 'อธิบดี (หัวหน้ากรม)',
    'dept-deputy': 'รองอธิบดี',
    'dept-staff': 'นักวิชาการ',
    provincial: 'ระดับจังหวัด',
    staff: 'นักวิชาการ'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtBEDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const be = d.getFullYear() + 543;
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${be} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`;
  }
  function levelOfRoleId(roleId) {
    if (!roleId) return null;
    if (roleId === 'moac-ps') return 'ps';
    if (roleId === 'moac-deputy-ps') return 'deputy-ps';
    const m = roleId.match(/^moac-([a-z]+)$/i);
    if (m && !['minister','dep-minister','dep-minister-2','minister-sec','dep-minister-sec','dep-minister-2-sec','ps','deputy-ps','ps-sec','ps-advisor','deputy-ps-sec'].includes(m[1])) return 'dept-head';
    if (/-deputy$/.test(roleId)) return 'dept-deputy';
    if (/-staff$/.test(roleId))  return 'dept-staff';
    if (/^prov(ince|incial)?-/.test(roleId)) return 'provincial';
    return null;
  }
  function sevColor(sev) {
    if (sev === 'high')   return { bg:'#fee2e2', color:'#991b1b', label:'สูง' };
    if (sev === 'medium') return { bg:'#fef3c7', color:'#92400e', label:'ปานกลาง' };
    return { bg:'#dcfce7', color:'#166534', label:'ต่ำ' };
  }

  function injectStyle() {
    if (document.getElementById('moacdir-ai-style')) return;
    const css = `
      .moacdir-ai-card{background:#f7fbf8;border:1px solid #cfe3d4;border-radius:10px;padding:11px 13px;margin-bottom:12px}
      .moacdir-ai-card.my{background:linear-gradient(135deg,#fffbe6,#fef3c7);border:2px solid #c9a227;border-left:6px solid #c9a227}
      .moacdir-ai-card h4{margin:0 0 6px;font-size:13px;color:#0b3d2e;font-weight:700}
      .moacdir-ai-card .lbl{display:inline-block;font-size:10.5px;padding:2px 8px;border-radius:8px;background:#0b3d2e;color:#fff;font-weight:600;margin-right:6px;letter-spacing:.3px}
      .moacdir-ai-card ul, .moacdir-ai-card ol{margin:6px 0 0 18px;padding:0;font-size:12.5px;line-height:1.7;color:#222}
      .moacdir-ai-acc{border:1px solid #cfe3d4;border-radius:8px;background:#fff;margin-bottom:6px;overflow:hidden}
      .moacdir-ai-acc summary{cursor:pointer;padding:9px 12px;font-size:12.5px;font-weight:600;color:#0b3d2e;background:#f1f8f4;list-style:none}
      .moacdir-ai-acc summary::-webkit-details-marker{display:none}
      .moacdir-ai-acc summary::before{content:'▸ ';color:#2d6a4f;font-weight:700;margin-right:4px}
      .moacdir-ai-acc[open] summary::before{content:'▾ '}
      .moacdir-ai-acc .inn{padding:8px 14px 12px;font-size:12px;line-height:1.7;color:#222}
      .moacdir-ai-tbl{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:4px}
      .moacdir-ai-tbl th{text-align:left;padding:5px 7px;background:#f1f8f4;font-weight:600;color:#0b3d2e}
      .moacdir-ai-tbl td{padding:5px 7px;vertical-align:top;border-top:1px solid #eef3ef}
      .moacdir-ai-sev{display:inline-block;font-size:10.5px;padding:1px 8px;border-radius:8px;font-weight:700}
      .moacdir-ai-time{display:flex;flex-direction:column;gap:6px;border-left:2px solid #cfe3d4;padding-left:14px;margin-top:6px}
      .moacdir-ai-time .ms{position:relative;padding:5px 0 5px 4px}
      .moacdir-ai-time .ms::before{content:'';position:absolute;left:-19px;top:11px;width:10px;height:10px;border-radius:50%;background:#c9a227;border:2px solid #fff;box-shadow:0 0 0 1px #c9a227}
      .moacdir-ai-time .ms .w{display:inline-block;font-size:10.5px;font-weight:700;color:#854d0e;background:#fef9c3;padding:1px 7px;border-radius:7px;margin-right:6px}
      .moacdir-ai-foot{margin-top:14px;padding-top:10px;border-top:1px dashed #cfe3d4;font-size:11px;color:#666;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
      .moacdir-ai-srcs li{margin-bottom:3px}
      .moacdir-ai-srcs a{color:#1d4ed8;text-decoration:none;font-size:11.5px;word-break:break-all}
      .moacdir-ai-srcs a:hover{text-decoration:underline}
      .moacdir-ai-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:8px;font-size:12px;margin-bottom:10px}
      .moacdir-ai-refresh{background:#0b3d2e;color:#fff;border:none;padding:7px 14px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;margin-top:6px}
      .moacdir-ai-refresh:hover{background:#2d6a4f}
      .moacdir-ai-refresh[disabled]{opacity:.6;cursor:not-allowed}
      .moacdir-ai-loading{padding:30px 20px;text-align:center;color:#666;font-size:13px}
      .moacdir-ai-spin{display:inline-block;width:18px;height:18px;border:2px solid #cfe3d4;border-top-color:#0b3d2e;border-radius:50%;animation:moacdirSpin .8s linear infinite;vertical-align:middle;margin-right:6px}
      @keyframes moacdirSpin{to{transform:rotate(360deg)}}
      .moacdir-aibadge{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;padding:1px 7px;border-radius:9px;background:#e5e7eb;color:#374151;font-weight:600;cursor:pointer;border:1px solid #d1d5db;user-select:none}
      .moacdir-aibadge:hover{background:#d1d5db}
      .moacdir-aibadge.ready{background:#dcfce7;color:#166534;border-color:#86efac}
      .moacdir-aibadge.pending{background:#fef3c7;color:#92400e;border-color:#fcd34d}
      .moacdir-aibadge.pending .lbl::after{content:'';display:inline-block;width:9px;height:9px;margin-left:4px;border:2px solid #92400e;border-top-color:transparent;border-radius:50%;animation:moacdirSpin .8s linear infinite;vertical-align:middle}
      .moacdir-aibadge.err{background:#fee2e2;color:#991b1b;border-color:#fca5a5}
    `;
    const s = document.createElement('style');
    s.id = 'moacdir-ai-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  async function apiGet(path) {
    try {
      const r = await fetch(API + path, { headers: { Accept: 'application/json' } });
      if (r.status === 404) return { __notfound: true };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      console.warn('[MoacDirectiveAI] GET ' + path, e.message);
      return null;
    }
  }
  async function apiPost(path, body) {
    try {
      const r = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'moac2026' },
        body: JSON.stringify(body || {})
      });
      return await r.json();
    } catch (e) {
      console.warn('[MoacDirectiveAI] POST ' + path, e.message);
      return { ok: false, error: e.message };
    }
  }

  // Cache per-directive advisory status to avoid hammering the server
  const badgeCache = new Map(); // dirId → {status, ts}

  async function refreshBadges(scopeEl) {
    const badges = (scopeEl || document).querySelectorAll('[data-aibadge]');
    badges.forEach(async (el) => {
      const id = el.dataset.aibadge;
      const cached = badgeCache.get(id);
      let st;
      if (cached && (Date.now() - cached.ts) < 30000) {
        st = cached.status;
      } else {
        const r = await apiGet('/directives/' + encodeURIComponent(id) + '/advisory');
        if (!r) { st = 'err'; }
        else if (r.__notfound) { st = 'err'; }
        else if (r.advisory) { st = 'ready'; }
        else { st = (r.status === 'error') ? 'err' : 'pending'; }
        badgeCache.set(id, { status: st, ts: Date.now() });
      }
      el.classList.remove('ready','pending','err');
      el.classList.add(st);
      const lbl = el.querySelector('.lbl');
      if (lbl) {
        lbl.textContent = st === 'ready' ? 'AI พร้อม' : st === 'pending' ? 'AI กำลังวิเคราะห์' : 'AI ไม่พร้อม';
      }
    });
  }

  // Render the AI tab body
  async function renderInto(host, directive, state) {
    if (!host) return;
    injectStyle();
    host.innerHTML = `<div class="moacdir-ai-loading"><span class="moacdir-ai-spin"></span>กำลังโหลด AI แนะนำ…</div>`;

    let pollTimer = null;
    let stopped = false;
    function stop() { stopped = true; if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }
    // If host is removed from DOM (modal close / tab switch), stop polling.
    const obs = new MutationObserver(() => {
      if (!document.body.contains(host)) stop();
    });
    obs.observe(document.body, { childList: true, subtree: true });

    async function load(attempt) {
      if (stopped) return;
      const r = await apiGet('/directives/' + encodeURIComponent(directive.id) + '/advisory');
      if (!r) {
        host.innerHTML = `<div class="moacdir-ai-err">เชื่อมต่อระบบ AI ไม่สำเร็จ</div>
          <button class="moacdir-ai-refresh" id="moacdir-ai-retry">ลองใหม่</button>`;
        document.getElementById('moacdir-ai-retry').onclick = () => load(0);
        return;
      }
      if (r.__notfound) {
        host.innerHTML = `<div class="moacdir-ai-err">ยังไม่มี AI วิเคราะห์ กดปุ่ม "ขอ AI วิเคราะห์ใหม่" ที่ด้านล่าง</div>
          <button class="moacdir-ai-refresh" id="moacdir-ai-gen">🔄 ขอ AI วิเคราะห์</button>`;
        document.getElementById('moacdir-ai-gen').onclick = () => triggerRefresh(directive, host, state);
        return;
      }
      if (!r.advisory) {
        // Still pending — poll
        host.innerHTML = `<div class="moacdir-ai-loading">
          <span class="moacdir-ai-spin"></span>🔄 AI กำลังวิเคราะห์... รออีกประมาณ ${Math.max(5, 30 - attempt*10)} วินาที
          <div style="font-size:11px;color:#888;margin-top:6px">ระบบจะอัปเดตอัตโนมัติทุก 10 วินาที</div>
          <button class="moacdir-ai-refresh" id="moacdir-ai-gen" style="margin-top:14px">🔄 ขอ AI วิเคราะห์ใหม่</button>
        </div>`;
        document.getElementById('moacdir-ai-gen').onclick = () => triggerRefresh(directive, host, state);
        pollTimer = setTimeout(() => load(attempt + 1), POLL_MS);
        return;
      }
      paint(r.advisory, r.aiAdvisoryAt);
      badgeCache.set(directive.id, { status: r.advisory?.analysis ? 'ready' : 'err', ts: Date.now() });
    }

    function paint(advisory, generatedAt) {
      const a = advisory.analysis || {};
      const myLevel = levelOfRoleId(state.roleId) || state.level || null;
      const myPlan = (a.action_plans || {})[myLevel];
      const otherLevels = Object.keys(a.action_plans || {}).filter(l => l !== myLevel);

      // Build sections
      const summaryHtml = `
        <div class="moacdir-ai-card">
          <h4>📌 บริบทและความสำคัญ</h4>
          <div style="font-size:12.5px;line-height:1.7;color:#222">${esc(a.context_summary || '—')}</div>
        </div>`;

      const dataPointsHtml = (a.key_data_points && a.key_data_points.length) ? `
        <div class="moacdir-ai-card">
          <h4>📊 ข้อมูลสำคัญที่ต้องทราบ</h4>
          <ul>${a.key_data_points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>` : '';

      const myPlanHtml = myPlan ? `
        <div class="moacdir-ai-card my">
          <span class="lbl">🎯 บทบาทของท่าน</span>
          <span style="font-size:12px;color:#666">ระดับ: ${esc(LVL_TH[myLevel] || myLevel || 'ไม่สามารถระบุ')}</span>
          <h4 style="margin-top:6px">${esc(myPlan.summary || 'แนวทางปฏิบัติของท่าน')}</h4>
          ${myPlan.deadline_hint ? `<div style="font-size:11.5px;color:#854d0e;margin-bottom:4px">⏱️ กรอบเวลา: ${esc(myPlan.deadline_hint)}</div>` : ''}
          <ol>${(myPlan.steps || []).map(s => `<li>${esc(s)}</li>`).join('') || '<li><i>— ไม่มีขั้นตอน —</i></li>'}</ol>
        </div>` : `
        <div class="moacdir-ai-card" style="background:#fef9c3;border-color:#fbbf24">
          <h4>ℹ️ ไม่สามารถจับคู่บทบาทของท่านได้</h4>
          <div style="font-size:12px">ระบบไม่ทราบระดับของ ${esc(state.roleId)} — ดูแนวทางทั้งหมดด้านล่าง</div>
        </div>`;

      const otherPlansHtml = otherLevels.length ? `
        <div class="moacdir-ai-card">
          <h4>🚀 แนวทางปฏิบัติทุกระดับ</h4>
          ${otherLevels.map(lv => {
            const pl = a.action_plans[lv] || {};
            return `<details class="moacdir-ai-acc">
              <summary>${esc(LVL_TH[lv] || lv)}: ${esc(pl.summary || '—')}</summary>
              <div class="inn">
                ${pl.deadline_hint ? `<div style="color:#854d0e">⏱️ ${esc(pl.deadline_hint)}</div>` : ''}
                <ol>${(pl.steps || []).map(s => `<li>${esc(s)}</li>`).join('') || '<li><i>— ไม่มีขั้นตอน —</i></li>'}</ol>
              </div>
            </details>`;
          }).join('')}
        </div>` : '';

      const risksHtml = (a.risks && a.risks.length) ? `
        <div class="moacdir-ai-card">
          <h4>⚠️ ความเสี่ยง + การลดผลกระทบ</h4>
          <table class="moacdir-ai-tbl">
            <thead><tr><th style="width:34%">ความเสี่ยง</th><th style="width:50%">การลดผลกระทบ</th><th>ระดับ</th></tr></thead>
            <tbody>${a.risks.map(r => {
              const sv = sevColor(r.severity);
              return `<tr><td>${esc(r.risk)}</td><td>${esc(r.mitigation)}</td><td><span class="moacdir-ai-sev" style="background:${sv.bg};color:${sv.color}">${esc(sv.label)}</span></td></tr>`;
            }).join('')}</tbody>
          </table>
        </div>` : '';

      const bestPracticeHtml = (a.best_practices && a.best_practices.length) ? `
        <div class="moacdir-ai-card">
          <h4>🏆 แนวปฏิบัติที่ดี (Best Practices)</h4>
          <ul>${a.best_practices.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        </div>` : '';

      const milestonesHtml = (a.milestones && a.milestones.length) ? `
        <div class="moacdir-ai-card">
          <h4>📅 Milestone Roadmap</h4>
          <div class="moacdir-ai-time">
            ${a.milestones.map(m => `
              <div class="ms">
                <span class="w">สัปดาห์ที่ ${esc(m.week)}</span>
                <b>${esc(m.title)}</b>
                ${m.owner_level ? `<div style="font-size:11px;color:#666">ผู้รับผิดชอบหลัก: ${esc(LVL_TH[m.owner_level] || m.owner_level)}</div>` : ''}
              </div>`).join('')}
          </div>
        </div>` : '';

      const metricsHtml = (a.success_metrics && a.success_metrics.length) ? `
        <div class="moacdir-ai-card">
          <h4>📈 ตัวชี้วัดความสำเร็จ</h4>
          <table class="moacdir-ai-tbl">
            <thead><tr><th style="width:40%">ตัวชี้วัด</th><th style="width:30%">เป้าหมาย</th><th>ผูกกับ KPI</th></tr></thead>
            <tbody>${a.success_metrics.map(m => `<tr><td>${esc(m.metric)}</td><td>${esc(m.target)}</td><td>${esc(m.tied_to_kpi || '—')}</td></tr>`).join('')}</tbody>
          </table>
        </div>` : '';

      const sources = (advisory.research && advisory.research.sources) || [];
      const sourcesHtml = sources.length ? `
        <div class="moacdir-ai-card">
          <h4>🔍 ที่มาของข้อมูล (จาก Perplexity)</h4>
          <ol class="moacdir-ai-srcs">${sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a></li>`).join('')}</ol>
        </div>` : '';

      const errHtml = advisory.error ? `<div class="moacdir-ai-err">⚠️ การวิเคราะห์ไม่สมบูรณ์: ${esc(advisory.error)}</div>` : '';

      host.innerHTML = `
        ${errHtml}
        ${summaryHtml}
        ${dataPointsHtml}
        ${myPlanHtml}
        ${otherPlansHtml}
        ${risksHtml}
        ${bestPracticeHtml}
        ${milestonesHtml}
        ${metricsHtml}
        ${sourcesHtml}
        <div class="moacdir-ai-foot">
          <div>
            <button class="moacdir-ai-refresh" id="moacdir-ai-refresh-btn">🔄 ขอ AI วิเคราะห์ใหม่</button>
          </div>
          <div style="text-align:right">
            <div>โมเดล: <b>${esc(advisory.ai_model || '-')}</b></div>
            <div>วิเคราะห์เมื่อ: ${esc(fmtBEDateTime(generatedAt || advisory.generated_at))}</div>
            ${advisory.tokens_used ? `<div>โทเค็นที่ใช้: ${esc(advisory.tokens_used)}</div>` : ''}
            ${a.model_notes ? `<div style="margin-top:4px;font-style:italic">${esc(a.model_notes)}</div>` : ''}
          </div>
        </div>
      `;
      document.getElementById('moacdir-ai-refresh-btn').onclick = () => triggerRefresh(directive, host, state);
    }

    load(0);
  }

  async function triggerRefresh(directive, host, state) {
    host.innerHTML = `<div class="moacdir-ai-loading"><span class="moacdir-ai-spin"></span>กำลังขอให้ AI วิเคราะห์ใหม่… (ประมาณ 20-40 วินาที)</div>`;
    const r = await apiPost('/directives/' + encodeURIComponent(directive.id) + '/refresh-advisory', {});
    badgeCache.delete(directive.id);
    if (!r || !r.ok) {
      host.innerHTML = `<div class="moacdir-ai-err">ขอ AI วิเคราะห์ใหม่ไม่สำเร็จ: ${esc((r && r.error) || 'unknown')}</div>
        <button class="moacdir-ai-refresh" id="moacdir-ai-retry">ลองใหม่</button>`;
      document.getElementById('moacdir-ai-retry').onclick = () => triggerRefresh(directive, host, state);
      return;
    }
    // Re-run the load cycle so the newly-cached advisory paints right away
    renderInto(host, directive, state);
  }

  window.MoacDirectiveAI = { renderInto, refreshBadges };
  console.log('[MoacDirectives] AI Advisory enabled — model=claude-sonnet-4-6+perplexity');
})();
