/**
 * MHESI Platform — Shared Delegation & Reporting Component
 * เพิ่ม <script src="/mhesi-delegate.js"></script> ในทุก platform
 * แล้วเรียก MhesiDelegate.init(config) ตอน load
 */
const MhesiDelegate = {
  API: 'https://g2g-ai-pool.fly.dev/api/mhesi',
  config: {},

  init(config) {
    this.config = config;
    // {role, roleName, level, canAssignTo:[], reportsTo, myId}
    this._injectPanel();
    this._loadIncoming();
    setInterval(() => this._loadIncoming(), 30000);
  },

  // ===== ASSIGN TASK (down) =====
  async assignTask(toId, toName, title, detail, priority) {
    const res = await fetch(`${this.API}/assign`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        from: this.config.myId, fromName: this.config.roleName,
        to: toId, toName, title, detail, priority
      })
    });
    return res.json();
  },

  // ===== REPORT UP =====
  async submitReport(title, summary, data) {
    const res = await fetch(`${this.API}/report`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        from: this.config.myId, fromName: this.config.roleName,
        fromLevel: this.config.level, toLevel: this.config.reportsTo,
        title, summary, data
      })
    });
    return res.json();
  },

  // ===== LOAD INCOMING (tasks assigned to me + reports from below) =====
  async _loadIncoming() {
    try {
      const [tasksR, reportsR] = await Promise.all([
        fetch(`${this.API}/tasks?assignee=${this.config.myId}`).then(r=>r.json()),
        fetch(`${this.API}/reports?toLevel=${this.config.level}`).then(r=>r.json())
      ]);
      this._renderInbox(tasksR.tasks || [], reportsR.reports || []);
    } catch(e) { console.warn('MHESI delegate load:', e); }
  },

  _renderInbox(tasks, reports) {
    const inbox = document.getElementById('mhesi-inbox');
    if (!inbox) return;
    const pending = tasks.filter(t => t.status === 'pending');
    const badge = document.getElementById('mhesi-inbox-badge');
    if (badge) badge.textContent = pending.length + reports.length || '';

    inbox.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--p1);margin-bottom:10px">
        📥 กล่องรับงาน (${pending.length} งาน) + รายงานจากลูกน้อง (${reports.length})
      </div>
      ${pending.length === 0 && reports.length === 0 ? '<div style="color:#999;font-size:12px;text-align:center;padding:20px">ไม่มีรายการ</div>' : ''}
      ${pending.map(t=>`
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #f97316;border-radius:8px;padding:10px 12px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;color:#c2410c">📋 งานจาก ${t.fromName}</div>
          <div style="font-size:13px;font-weight:600;margin:4px 0">${t.title}</div>
          <div style="font-size:11px;color:#666">${t.detail||''}</div>
          <div style="margin-top:6px;display:flex;gap:6px">
            <button onclick="MhesiDelegate._updateTask('${t.id}','in_progress')" style="font-size:11px;padding:3px 10px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">รับงาน</button>
            <button onclick="MhesiDelegate._updateTask('${t.id}','done')" style="font-size:11px;padding:3px 10px;background:#22c55e;color:#fff;border:none;border-radius:6px;cursor:pointer">เสร็จแล้ว</button>
          </div>
        </div>`).join('')}
      ${reports.map(r=>`
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #22c55e;border-radius:8px;padding:10px 12px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;color:#15803d">📤 รายงานจาก ${r.fromName}</div>
          <div style="font-size:13px;font-weight:600;margin:4px 0">${r.title}</div>
          <div style="font-size:11px;color:#666">${r.summary||''}</div>
          <div style="font-size:10px;color:#999;margin-top:4px">${new Date(r.created).toLocaleString('th-TH')}</div>
        </div>`).join('')}
    `;
  },

  async _updateTask(id, status) {
    await fetch(`${this.API}/tasks/${id}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status })
    });
    this._loadIncoming();
  },

  // ===== INJECT PANEL =====
  _injectPanel() {
    const css = `
    #mhesi-fab{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
    #mhesi-fab-btn{width:52px;height:52px;background:linear-gradient(135deg,var(--p1,#5b0ea6),var(--p3,#9c4de0));border-radius:50%;border:none;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
    #mhesi-fab-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700}
    #mhesi-panel{display:none;width:360px;max-height:80vh;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.25);overflow:hidden;flex-direction:column}
    #mhesi-panel.open{display:flex}
    #mhesi-panel-header{background:linear-gradient(90deg,var(--p1,#5b0ea6),var(--p2,#7b2fc0));color:#fff;padding:12px 16px;display:flex;align-items:center;gap:8px}
    #mhesi-panel-tabs{display:flex;border-bottom:1px solid #e0e0e0;background:#f9f9f9}
    .mhesi-tab{flex:1;padding:9px;text-align:center;font-size:12px;cursor:pointer;border-bottom:3px solid transparent;color:#666}
    .mhesi-tab.active{border-bottom-color:var(--p1,#5b0ea6);color:var(--p1,#5b0ea6);font-weight:700}
    #mhesi-panel-body{flex:1;overflow-y:auto;padding:14px}
    .mhesi-form-row{margin-bottom:10px}
    .mhesi-form-row label{display:block;font-size:11px;font-weight:600;color:#666;margin-bottom:3px}
    .mhesi-form-row input,.mhesi-form-row select,.mhesi-form-row textarea{width:100%;padding:8px 10px;border:1px solid #e0e0e0;border-radius:8px;font-size:12px;font-family:Sarabun,sans-serif}
    .mhesi-btn{width:100%;padding:10px;background:linear-gradient(135deg,var(--p1,#5b0ea6),var(--p3,#9c4de0));color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun,sans-serif;margin-top:6px}
    `;
    const style = document.createElement('style'); style.textContent = css;
    document.head.appendChild(style);

    const assignOpts = (this.config.canAssignTo||[])
      .map(p=>`<option value="${p.id}">${p.name}</option>`).join('');

    const panel = document.createElement('div');
    panel.id = 'mhesi-fab';
    panel.innerHTML = `
      <div id="mhesi-panel">
        <div id="mhesi-panel-header">
          <span style="font-size:18px">🏢</span>
          <span style="flex:1;font-size:14px;font-weight:700">ศูนย์บริหารงาน — ${this.config.roleName}</span>
          <button onclick="MhesiDelegate.toggle()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button>
        </div>
        <div id="mhesi-panel-tabs">
          <div class="mhesi-tab active" onclick="MhesiDelegate.switchTab(0,this)">📥 กล่องรับ</div>
          <div class="mhesi-tab" onclick="MhesiDelegate.switchTab(1,this)">📋 มอบหมาย</div>
          <div class="mhesi-tab" onclick="MhesiDelegate.switchTab(2,this)">📤 รายงาน</div>
        </div>
        <div id="mhesi-panel-body">
          <!-- TAB 0: INBOX -->
          <div id="mhesi-tab-0">
            <div id="mhesi-inbox"><div style="text-align:center;padding:20px;color:#999;font-size:12px">กำลังโหลด...</div></div>
          </div>
          <!-- TAB 1: ASSIGN -->
          <div id="mhesi-tab-1" style="display:none">
            <div class="mhesi-form-row"><label>มอบหมายให้</label>
              <select id="mhesi-assign-to">${assignOpts||'<option value="">ไม่มีลูกน้อง</option>'}</select>
            </div>
            <div class="mhesi-form-row"><label>หัวข้องาน</label>
              <input id="mhesi-task-title" type="text" placeholder="ระบุหัวข้องาน...">
            </div>
            <div class="mhesi-form-row"><label>รายละเอียด</label>
              <textarea id="mhesi-task-detail" rows="3" placeholder="รายละเอียดงาน กำหนดส่ง ผลที่คาดหวัง..."></textarea>
            </div>
            <div class="mhesi-form-row"><label>ความสำคัญ</label>
              <select id="mhesi-task-priority">
                <option value="urgent">🔴 ด่วนมาก</option>
                <option value="high">🟠 สูง</option>
                <option value="normal" selected>🟡 ปกติ</option>
                <option value="low">🟢 ต่ำ</option>
              </select>
            </div>
            <button class="mhesi-btn" onclick="MhesiDelegate._doAssign()">📋 มอบหมายงาน</button>
            <div id="mhesi-assign-result" style="margin-top:8px;font-size:12px;color:green"></div>
          </div>
          <!-- TAB 2: REPORT UP -->
          <div id="mhesi-tab-2" style="display:none">
            <div style="font-size:12px;color:#666;margin-bottom:10px">รายงานถึง: <strong>${this.config.reportsTo||'ศูนย์กลาง'}</strong></div>
            <div class="mhesi-form-row"><label>หัวข้อรายงาน</label>
              <input id="mhesi-report-title" type="text" placeholder="หัวข้อรายงาน...">
            </div>
            <div class="mhesi-form-row"><label>สรุปประเด็นสำคัญ</label>
              <textarea id="mhesi-report-summary" rows="4" placeholder="สรุปผลงาน ปัญหา ข้อเสนอแนะ..."></textarea>
            </div>
            <button class="mhesi-btn" onclick="MhesiDelegate._doReport()">📤 ส่งรายงานขึ้น</button>
            <div id="mhesi-report-result" style="margin-top:8px;font-size:12px;color:green"></div>
          </div>
        </div>
      </div>
      <div style="position:relative">
        <button id="mhesi-fab-btn" onclick="MhesiDelegate.toggle()">🏢</button>
        <span id="mhesi-inbox-badge"></span>
      </div>
    `;
    document.body.appendChild(panel);
  },

  toggle() {
    const p = document.getElementById('mhesi-panel');
    p.classList.toggle('open');
  },

  switchTab(i, el) {
    [0,1,2].forEach(j => {
      document.getElementById('mhesi-tab-'+j).style.display = j===i?'':'none';
    });
    document.querySelectorAll('.mhesi-tab').forEach((t,j)=>t.classList.toggle('active',j===i));
  },

  async _doAssign() {
    const sel = document.getElementById('mhesi-assign-to');
    const selectedOpt = sel.options[sel.selectedIndex];
    const toId = sel.value;
    const toName = selectedOpt ? selectedOpt.text : '';
    const title = document.getElementById('mhesi-task-title').value.trim();
    const detail = document.getElementById('mhesi-task-detail').value.trim();
    const priority = document.getElementById('mhesi-task-priority').value;
    if (!toId || !title) { alert('กรุณาเลือกผู้รับและระบุหัวข้องาน'); return; }
    const res = await this.assignTask(toId, toName, title, detail, priority);
    document.getElementById('mhesi-assign-result').textContent = res.ok ? `✅ มอบหมายงาน "${title}" ถึง ${toName} สำเร็จ (ID: ${res.taskId})` : '❌ '+res.error;
    if (res.ok) { document.getElementById('mhesi-task-title').value=''; document.getElementById('mhesi-task-detail').value=''; }
  },

  async _doReport() {
    const title = document.getElementById('mhesi-report-title').value.trim();
    const summary = document.getElementById('mhesi-report-summary').value.trim();
    if (!title) { alert('กรุณาระบุหัวข้อรายงาน'); return; }
    const res = await this.submitReport(title, summary, {});
    document.getElementById('mhesi-report-result').textContent = res.ok ? `✅ ส่งรายงาน "${title}" สำเร็จ (ID: ${res.reportId})` : '❌ '+res.error;
    if (res.ok) { document.getElementById('mhesi-report-title').value=''; document.getElementById('mhesi-report-summary').value=''; }
  }
};
