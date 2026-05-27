/**
 * MOAC Platform — Shared Delegation & Reporting Component
 * เพิ่ม <script src="/moac-delegate.js"></script> ในทุก platform
 * แล้วเรียก MoacDelegate.init(config) ตอน load
 * Theme: Navy + Gold (กระทรวงเกษตรและสหกรณ์)
 */
const MoacDelegate = {
  API: 'https://g2g-ai-pool.fly.dev/api/moac',
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
    } catch(e) { console.warn('MOAC delegate load:', e); }
  },

  _renderInbox(tasks, reports) {
    const inbox = document.getElementById('moac-inbox');
    if (!inbox) return;
    const pending = tasks.filter(t => t.status === 'pending');
    const badge = document.getElementById('moac-inbox-badge');
    if (badge) badge.textContent = pending.length + reports.length || '';

    inbox.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--p1,#0b3d2e);margin-bottom:10px">
        📥 กล่องรับงาน (${pending.length} งาน) + รายงานจากลูกน้อง (${reports.length})
      </div>
      ${pending.length === 0 && reports.length === 0 ? '<div style="color:#999;font-size:12px;text-align:center;padding:20px">ไม่มีรายการ</div>' : ''}
      ${pending.map(t=>`
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #f97316;border-radius:8px;padding:10px 12px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;color:#c2410c">📋 งานจาก ${t.fromName}</div>
          <div style="font-size:13px;font-weight:600;margin:4px 0">${t.title}</div>
          <div style="font-size:11px;color:#666">${t.detail||''}</div>
          <div style="margin-top:6px;display:flex;gap:6px">
            <button onclick="MoacDelegate._updateTask('${t.id}','in_progress')" style="font-size:11px;padding:3px 10px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">รับงาน</button>
            <button onclick="MoacDelegate._updateTask('${t.id}','done')" style="font-size:11px;padding:3px 10px;background:#22c55e;color:#fff;border:none;border-radius:6px;cursor:pointer">เสร็จแล้ว</button>
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
    #moac-fab{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
    #moac-fab-btn{width:52px;height:52px;background:linear-gradient(135deg,var(--p1,#0b3d2e),var(--p3,#2d6a4f));border-radius:50%;border:2px solid var(--gold,#c9a227);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
    #moac-fab-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700}
    #moac-panel{display:none;width:360px;max-height:80vh;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.25);overflow:hidden;flex-direction:column}
    #moac-panel.open{display:flex}
    #moac-panel-header{background:linear-gradient(90deg,var(--p1,#0b3d2e),var(--p2,#1b4332));color:#fff;padding:12px 16px;display:flex;align-items:center;gap:8px;border-bottom:2px solid var(--gold,#c9a227)}
    #moac-panel-tabs{display:flex;border-bottom:1px solid #e0e0e0;background:#f9f9f9}
    .moac-tab{flex:1;padding:9px;text-align:center;font-size:12px;cursor:pointer;border-bottom:3px solid transparent;color:#666}
    .moac-tab.active{border-bottom-color:var(--gold,#c9a227);color:var(--p1,#0b3d2e);font-weight:700}
    #moac-panel-body{flex:1;overflow-y:auto;padding:14px}
    .moac-form-row{margin-bottom:10px}
    .moac-form-row label{display:block;font-size:11px;font-weight:600;color:#666;margin-bottom:3px}
    .moac-form-row input,.moac-form-row select,.moac-form-row textarea{width:100%;padding:8px 10px;border:1px solid #e0e0e0;border-radius:8px;font-size:12px;font-family:Sarabun,sans-serif}
    .moac-btn{width:100%;padding:10px;background:linear-gradient(135deg,var(--p1,#0b3d2e),var(--p3,#2d6a4f));color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun,sans-serif;margin-top:6px}
    `;
    const style = document.createElement('style'); style.textContent = css;
    document.head.appendChild(style);

    const assignOpts = (this.config.canAssignTo||[])
      .map(p=>`<option value="${p.id}">${p.name}</option>`).join('');

    const panel = document.createElement('div');
    panel.id = 'moac-fab';
    panel.innerHTML = `
      <div id="moac-panel">
        <div id="moac-panel-header">
          <span style="font-size:18px">🌾</span>
          <span style="flex:1;font-size:14px;font-weight:700">ศูนย์บริหารงาน กษ. — ${this.config.roleName}</span>
          <button onclick="MoacDelegate.toggle()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button>
        </div>
        <div id="moac-panel-tabs">
          <div class="moac-tab active" onclick="MoacDelegate.switchTab(0,this)">📥 กล่องรับ</div>
          <div class="moac-tab" onclick="MoacDelegate.switchTab(1,this)">📋 มอบหมาย</div>
          <div class="moac-tab" onclick="MoacDelegate.switchTab(2,this)">📤 รายงาน</div>
        </div>
        <div id="moac-panel-body">
          <!-- TAB 0: INBOX -->
          <div id="moac-tab-0">
            <div id="moac-inbox"><div style="text-align:center;padding:20px;color:#999;font-size:12px">กำลังโหลด...</div></div>
          </div>
          <!-- TAB 1: ASSIGN -->
          <div id="moac-tab-1" style="display:none">
            <div class="moac-form-row"><label>มอบหมายให้</label>
              <select id="moac-assign-to">${assignOpts||'<option value="">ไม่มีลูกน้อง</option>'}</select>
            </div>
            <div class="moac-form-row"><label>หัวข้องาน</label>
              <input id="moac-task-title" type="text" placeholder="ระบุหัวข้องาน...">
            </div>
            <div class="moac-form-row"><label>รายละเอียด</label>
              <textarea id="moac-task-detail" rows="3" placeholder="รายละเอียดงาน กำหนดส่ง ผลที่คาดหวัง..."></textarea>
            </div>
            <div class="moac-form-row"><label>ความสำคัญ</label>
              <select id="moac-task-priority">
                <option value="urgent">🔴 ด่วนมาก</option>
                <option value="high">🟠 สูง</option>
                <option value="normal" selected>🟡 ปกติ</option>
                <option value="low">🟢 ต่ำ</option>
              </select>
            </div>
            <button class="moac-btn" onclick="MoacDelegate._doAssign()">📋 มอบหมายงาน</button>
            <div id="moac-assign-result" style="margin-top:8px;font-size:12px;color:green"></div>
          </div>
          <!-- TAB 2: REPORT UP -->
          <div id="moac-tab-2" style="display:none">
            <div style="font-size:12px;color:#666;margin-bottom:10px">รายงานถึง: <strong>${this.config.reportsTo||'ศูนย์กลาง'}</strong></div>
            <div class="moac-form-row"><label>หัวข้อรายงาน</label>
              <input id="moac-report-title" type="text" placeholder="หัวข้อรายงาน...">
            </div>
            <div class="moac-form-row"><label>สรุปประเด็นสำคัญ</label>
              <textarea id="moac-report-summary" rows="4" placeholder="สรุปผลงาน ปัญหา ข้อเสนอแนะ..."></textarea>
            </div>
            <button class="moac-btn" onclick="MoacDelegate._doReport()">📤 ส่งรายงานขึ้น</button>
            <div id="moac-report-result" style="margin-top:8px;font-size:12px;color:green"></div>
          </div>
        </div>
      </div>
      <div style="position:relative">
        <button id="moac-fab-btn" onclick="MoacDelegate.toggle()">🌾</button>
        <span id="moac-inbox-badge"></span>
      </div>
    `;
    document.body.appendChild(panel);
  },

  toggle() {
    const p = document.getElementById('moac-panel');
    p.classList.toggle('open');
  },

  switchTab(i, el) {
    [0,1,2].forEach(j => {
      document.getElementById('moac-tab-'+j).style.display = j===i?'':'none';
    });
    document.querySelectorAll('.moac-tab').forEach((t,j)=>t.classList.toggle('active',j===i));
  },

  async _doAssign() {
    const sel = document.getElementById('moac-assign-to');
    const selectedOpt = sel.options[sel.selectedIndex];
    const toId = sel.value;
    const toName = selectedOpt ? selectedOpt.text : '';
    const title = document.getElementById('moac-task-title').value.trim();
    const detail = document.getElementById('moac-task-detail').value.trim();
    const priority = document.getElementById('moac-task-priority').value;
    if (!toId || !title) { alert('กรุณาเลือกผู้รับและระบุหัวข้องาน'); return; }
    const res = await this.assignTask(toId, toName, title, detail, priority);
    document.getElementById('moac-assign-result').textContent = res.ok ? `✅ มอบหมายงาน "${title}" ถึง ${toName} สำเร็จ (ID: ${res.taskId})` : '❌ '+res.error;
    if (res.ok) { document.getElementById('moac-task-title').value=''; document.getElementById('moac-task-detail').value=''; }
  },

  async _doReport() {
    const title = document.getElementById('moac-report-title').value.trim();
    const summary = document.getElementById('moac-report-summary').value.trim();
    if (!title) { alert('กรุณาระบุหัวข้อรายงาน'); return; }
    const res = await this.submitReport(title, summary, {});
    document.getElementById('moac-report-result').textContent = res.ok ? `✅ ส่งรายงาน "${title}" สำเร็จ (ID: ${res.reportId})` : '❌ '+res.error;
    if (res.ok) { document.getElementById('moac-report-title').value=''; document.getElementById('moac-report-summary').value=''; }
  }
};
