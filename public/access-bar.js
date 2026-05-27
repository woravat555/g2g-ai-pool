// G2G Platform — Shared Accessibility Bar v1.0
// Inject with: <script src="/access-bar.js"></script>
// Per-page config: window.G2G_PAGE_CONFIG = { manualText: '...', pageName: '...' }
(function() {
'use strict';

// ── CONFIG ──
const DEFAULT_CONFIG = {
  pageName: document.title || 'G2G Platform',
  manualText: 'ระบบนี้ใช้สำหรับบริหารจัดการข้อมูลหน่วยงานราชการ...',
  manualSteps: [
    '1. เลือกเมนูด้านซ้ายเพื่อดูข้อมูลแต่ละส่วน',
    '2. กดปุ่มเพิ่ม/แก้ไข เพื่อจัดการข้อมูล',
    '3. กดปุ่ม 🤖 เพื่อคุยกับ AI ผู้ช่วย',
    '4. กด 📤 ส่งรายงาน เพื่อส่งข้อมูลขึ้นกระทรวง'
  ],
  aiApiUrl: '/api/management/chat',
  hubReportUrl: '/api/hub/report',
  agencyId: 'unknown',
  ministryId: 'unknown'
};
const cfg = Object.assign({}, DEFAULT_CONFIG, window.G2G_PAGE_CONFIG || {});

// ── STATE ──
let fontSize = parseFloat(localStorage.getItem('g2g_fontSize') || '16');
let speechRate = parseFloat(localStorage.getItem('g2g_speechRate') || '1.0');
let selectedVoiceIdx = parseInt(localStorage.getItem('g2g_voiceIdx') || '0');
let barCollapsed = localStorage.getItem('g2g_barCollapsed') === '1';
let currentUtterance = null;

// ── APPLY FONT SIZE ──
function applyFontSize(sz) {
  fontSize = Math.max(12, Math.min(24, sz));
  localStorage.setItem('g2g_fontSize', fontSize);
  document.documentElement.style.fontSize = fontSize + 'px';
  const lbl = document.getElementById('g2g-fontsize-lbl');
  if(lbl) lbl.textContent = fontSize + 'px';
}

// ── MICROSOFT AZURE NEURAL VOICE FINDER ──
// th-TH-NiwatNeural (ชาย) / th-TH-PreamwadeeNeural (หญิง)
// ใช้งานได้ใน Microsoft Edge โดยไม่ต้องมี API key
// ชื่อเสียงใน Edge: "Microsoft Niwat Online (Natural) - Thai (Thailand)"
let _cachedNiwat = null, _cachedPreamwadee = null;

function findMicrosoftThaiVoices() {
  if (!window.speechSynthesis) return;
  const voices = speechSynthesis.getVoices();
  _cachedNiwat = voices.find(v =>
    v.name.toLowerCase().includes('niwat') ||
    v.voiceURI.toLowerCase().includes('niwat')
  ) || null;
  _cachedPreamwadee = voices.find(v =>
    v.name.toLowerCase().includes('preamwadee') ||
    v.voiceURI.toLowerCase().includes('preamwadee')
  ) || null;
  if (_cachedNiwat || _cachedPreamwadee) {
    window.G2G_TTS_MODE = 'microsoft-edge';
    console.log('[G2G TTS] ✅ พบเสียง Microsoft Azure Neural —',
      (_cachedNiwat ? 'Niwat ✓' : 'Niwat ✗'),
      (_cachedPreamwadee ? 'Preamwadee ✓' : 'Preamwadee ✗'));
  } else {
    // Try any Thai voice
    const anyThai = voices.find(v => v.lang && v.lang.startsWith('th'));
    if (anyThai) {
      window.G2G_TTS_MODE = 'browser-thai';
      console.log('[G2G TTS] ใช้เสียง Thai:', anyThai.name);
    } else {
      window.G2G_TTS_MODE = 'browser-fallback';
      console.log('[G2G TTS] ไม่พบเสียง Thai — ลองเปิดใน Microsoft Edge');
    }
  }
  // Update voice badge in bar if open
  _updateVoiceLabel();
}

function _updateVoiceLabel() {
  const el = document.getElementById('g2g-voice-label');
  if (!el) return;
  if (_cachedNiwat || _cachedPreamwadee) {
    el.textContent = selectedVoiceIdx === 0
      ? (_cachedNiwat ? '🎙 นิวัฒน์' : '🎙 Niwat (ไม่พบ)')
      : (_cachedPreamwadee ? '🎙 เปรมวดี' : '🎙 Preamwadee (ไม่พบ)');
  } else {
    el.textContent = '🎙 Thai Voice';
  }
}

// โหลด voices เมื่อ browser พร้อม (Chrome โหลด async, Edge โหลดทันที)
if (window.speechSynthesis) {
  if (speechSynthesis.getVoices().length > 0) {
    findMicrosoftThaiVoices();
  } else {
    speechSynthesis.addEventListener('voiceschanged', findMicrosoftThaiVoices, { once: true });
    setTimeout(findMicrosoftThaiVoices, 1500); // fallback timeout
  }
}

// ── AUTO-FETCH VAJA CONFIG (ถ้ามี NECTEC key ใน server) ──
(async function fetchTTSConfig() {
  try {
    const r = await fetch('/api/config/tts');
    const d = await r.json();
    if (d.ok && d.key) {
      window.G2G_VAJA_KEY = d.key;
      window.G2G_TTS_MODE = 'vaja';
      console.log('[G2G TTS] NECTEC VAJA พร้อม — เสียง Niwat & Preamwadee (VAJA)');
    }
  } catch(e) { /* ใช้ Microsoft Edge voices แทน */ }
})();

// ── TTS CORE ──
function getThaiVoices() {
  const all = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return all.filter(v => v.lang && v.lang.toLowerCase().startsWith('th'));
}

function speakText(text) {
  if (!text) return;
  stopSpeech();
  // Priority 1: NECTEC VAJA API
  if (window.G2G_VAJA_KEY) { speakVAJA(text); return; }
  // Priority 2: Microsoft Azure Neural (Edge built-in)
  if (_cachedNiwat || _cachedPreamwadee) { speakMicrosoft(text); return; }
  // Priority 3: Any browser Thai voice
  speakBrowser(text);
}

function speakMicrosoft(text) {
  if (!window.speechSynthesis) return;
  const voice = selectedVoiceIdx === 0
    ? (_cachedNiwat || _cachedPreamwadee)
    : (_cachedPreamwadee || _cachedNiwat);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'th-TH';
  utter.rate = speechRate;
  utter.voice = voice;
  currentUtterance = utter;
  speechSynthesis.speak(utter);
  const label = voice && voice.name.includes('Niwat') ? '🔊 นิวัฒน์' : '🔊 เปรมวดี';
  updateVoiceBadge(label);
  utter.onend = () => updateVoiceBadge('');
  utter.onerror = () => speakBrowser(text); // fallback
}

function speakBrowser(text) {
  if (!window.speechSynthesis) { alert('เบราว์เซอร์ไม่รองรับเสียง — กรุณาใช้ Microsoft Edge'); return; }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'th-TH';
  utter.rate = speechRate;
  const thVoices = getThaiVoices();
  if (thVoices.length > 0) utter.voice = thVoices[selectedVoiceIdx % thVoices.length];
  currentUtterance = utter;
  speechSynthesis.speak(utter);
  updateVoiceBadge('🔊 กำลังอ่าน...');
  utter.onend = () => updateVoiceBadge('');
  utter.onerror = () => updateVoiceBadge('❌ ไม่มีเสียง Thai — เปิดใน Edge');
}

async function speakVAJA(text) {
  try {
    const speaker = selectedVoiceIdx === 0 ? 'Niwat' : 'Preamwadee';
    const resp = await fetch('https://vaja.nectec.or.th/api/tts', {
      method: 'POST',
      headers: {'Content-Type':'application/json','X-API-Key': window.G2G_VAJA_KEY},
      body: JSON.stringify({ text, speaker, speed: speechRate })
    });
    if (!resp.ok) throw new Error('VAJA '+resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = speechRate;
    audio.play();
    updateVoiceBadge('🔊 ' + speaker + ' (VAJA)');
    audio.onended = () => { URL.revokeObjectURL(url); updateVoiceBadge(''); };
  } catch(e) {
    speakMicrosoft(text); // fallback to Edge
  }
}

function stopSpeech() {
  if(window.speechSynthesis) speechSynthesis.cancel();
  currentUtterance = null;
  updateVoiceBadge('');
}

function readPageManual() {
  const txt = cfg.pageName + '. ' + cfg.manualText + '. ' + cfg.manualSteps.join('. ');
  speakText(txt);
}

function updateVoiceBadge(msg) {
  const el = document.getElementById('g2g-voice-badge');
  if(el) el.textContent = msg;
}

// ── VOICE SELECTION (Niwat=0 / Preamwadee=1) ──
function setVoice(idx) {
  selectedVoiceIdx = idx;
  localStorage.setItem('g2g_voiceIdx', idx);
  document.querySelectorAll('.g2g-voice-btn').forEach((b,i) => {
    b.style.fontWeight = i===idx ? '700' : '400';
    b.style.background = i===idx ? 'var(--g2g-accent,#1565c0)' : 'transparent';
    b.style.color = i===idx ? '#fff' : 'inherit';
  });
}

function setRate(r) {
  speechRate = r;
  localStorage.setItem('g2g_speechRate', r);
  document.querySelectorAll('.g2g-rate-btn').forEach(b => {
    b.style.fontWeight = parseFloat(b.dataset.rate) === r ? '700' : '400';
    b.style.background = parseFloat(b.dataset.rate) === r ? 'var(--g2g-accent,#1565c0)' : 'transparent';
    b.style.color = parseFloat(b.dataset.rate) === r ? '#fff' : 'inherit';
  });
}

// ── MANUAL MODAL ──
function openManual() {
  document.getElementById('g2g-manual-overlay').style.display = 'flex';
  readPageManual();
}
function closeManual() {
  document.getElementById('g2g-manual-overlay').style.display = 'none';
  stopSpeech();
}

// ── PAYMENT ALERT ──
function checkPaymentAlerts() {
  const pending = window.G2G_PAYMENT_PENDING || [];
  if(pending.length === 0) return;
  const badge = document.getElementById('g2g-payment-badge');
  if(badge) { badge.textContent = pending.length; badge.style.display = 'inline-flex'; }
}

function openPaymentAlerts() {
  const pending = window.G2G_PAYMENT_PENDING || [
    { id:'INV-001', desc:'ค่าวัสดุสำนักงาน', amount:15400, due:'2026-06-01', status:'ค้างชำระ' },
    { id:'INV-002', desc:'ค่าจ้างเหมา IT Support', amount:45000, due:'2026-05-30', status:'ใกล้ครบกำหนด' }
  ];
  const rows = pending.map(p =>
    '<tr><td>'+p.id+'</td><td>'+p.desc+'</td>' +
    '<td style="text-align:right;font-weight:600">'+Number(p.amount).toLocaleString('th-TH')+'</td>' +
    '<td>'+p.due+'</td>' +
    '<td><span style="padding:2px 8px;border-radius:10px;font-size:11px;background:'+(p.status==='ค้างชำระ'?'#ffcdd2':'#fff9c4')+'">'+p.status+'</span></td>' +
    '<td><button onclick="g2gApprovePayment(\''+p.id+'\')" style="font-size:11px;padding:3px 10px;border:none;background:#2e7d32;color:#fff;border-radius:10px;cursor:pointer">อนุมัติ</button></td></tr>'
  ).join('');
  document.getElementById('g2g-payment-tbody').innerHTML = rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999">ไม่มีรายการค้างชำระ</td></tr>';
  document.getElementById('g2g-payment-overlay').style.display = 'flex';
}

function closePaymentModal() {
  document.getElementById('g2g-payment-overlay').style.display = 'none';
}

window.g2gApprovePayment = function(id) {
  alert('อนุมัติรายการ '+id+' แล้ว — ระบบจะส่งใบสำคัญไปยัง GFMIS');
  closePaymentModal();
};

// ── COLLAPSE BAR ──
function toggleBar() {
  barCollapsed = !barCollapsed;
  localStorage.setItem('g2g_barCollapsed', barCollapsed ? '1' : '0');
  const body = document.getElementById('g2g-bar-body');
  const icon = document.getElementById('g2g-collapse-icon');
  if(body) body.style.display = barCollapsed ? 'none' : 'flex';
  if(icon) icon.textContent = barCollapsed ? '▲' : '▼';
}

// ── BUILD DOM ──
function buildAccessBar() {
  applyFontSize(fontSize);

  const style = `
  #g2g-access-bar{position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#1a237e;color:#fff;font-family:'Sarabun',sans-serif;font-size:13px;box-shadow:0 -2px 12px rgba(0,0,0,0.3)}
  #g2g-bar-header{display:flex;align-items:center;padding:4px 12px;gap:8px;background:#0d47a1;cursor:pointer;border-top:2px solid #42a5f5}
  #g2g-bar-body{display:${barCollapsed?'none':'flex'};align-items:center;flex-wrap:wrap;gap:8px;padding:8px 14px;border-top:1px solid rgba(255,255,255,0.15)}
  .g2g-section{display:flex;align-items:center;gap:4px;padding:0 10px;border-right:1px solid rgba(255,255,255,0.2)}
  .g2g-section:last-child{border-right:none}
  .g2g-lbl{font-size:11px;color:rgba(255,255,255,0.6);margin-right:3px;white-space:nowrap}
  .g2g-btn{background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:#fff;padding:4px 10px;border-radius:20px;cursor:pointer;font-size:12px;font-family:inherit;transition:all 0.2s}
  .g2g-btn:hover{background:rgba(255,255,255,0.25)}
  .g2g-voice-btn,.g2g-rate-btn{background:transparent;border:1px solid rgba(255,255,255,0.25);color:#fff;padding:3px 8px;border-radius:12px;cursor:pointer;font-size:11px;font-family:inherit}
  #g2g-voice-badge{font-size:11px;color:#90caf9;margin-left:4px;min-width:80px}
  #g2g-payment-badge{background:#ef5350;color:#fff;border-radius:50%;width:16px;height:16px;display:none;align-items:center;justify-content:center;font-size:10px;font-weight:700;position:absolute;top:-4px;right:-4px}
  #g2g-fontsize-lbl{font-size:11px;color:#90caf9;min-width:30px;text-align:center}

  #g2g-manual-overlay,#g2g-payment-overlay{display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.6);align-items:center;justify-content:center}
  .g2g-modal{background:#fff;color:#333;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:85vh;overflow-y:auto;font-family:'Sarabun',sans-serif}
  .g2g-modal h2{color:#1a237e;margin:0 0 12px;font-size:18px}
  .g2g-modal-footer{margin-top:16px;display:flex;justify-content:flex-end;gap:8px}
  .g2g-step{padding:8px 12px;background:#e8eaf6;border-radius:6px;margin-bottom:6px;border-left:3px solid #3f51b5;font-size:14px}
  .g2g-pay-tbl{width:100%;border-collapse:collapse;font-size:13px}
  .g2g-pay-tbl th{background:#1a237e;color:#fff;padding:8px;text-align:left;font-weight:600}
  .g2g-pay-tbl td{padding:8px;border-bottom:1px solid #eee}
  `;

  const steps = cfg.manualSteps.map(s => '<div class="g2g-step">'+s+'</div>').join('');

  const html = `
  <style>${style}</style>

  <!-- MANUAL MODAL -->
  <div id="g2g-manual-overlay" onclick="if(event.target===this)closeManual()">
    <div class="g2g-modal">
      <h2>📖 คู่มือการใช้งาน — ${cfg.pageName}</h2>
      <p style="color:#555;font-size:13px;margin-bottom:12px">${cfg.manualText}</p>
      <div>${steps}</div>
      <div style="margin-top:12px;padding:10px;background:#e3f2fd;border-radius:6px;font-size:12px">
        <strong>⚖️ ข้อมูลทางกฎหมาย:</strong> ระบบนี้ออกแบบให้สอดคล้องกับ พรบ.ระเบียบบริหารราชการแผ่นดิน 2534, พรบ.ข้าราชการพลเรือน 2551, พรบ.วิธีการงบประมาณ 2561 และ พรบ.การจัดซื้อจัดจ้าง 2560
      </div>
      <div style="margin-top:8px;padding:10px;background:#fff3e0;border-radius:6px;font-size:12px">
        <strong>🔗 การเชื่อมต่อ:</strong> แพลตฟอร์มนี้ทำงาน Stand-alone ได้ และเชื่อมต่อ Hub กลางผ่าน /api/hub/report — ส่งรายงานขึ้นกระทรวงและแดชบอร์ดรัฐมนตรี
      </div>
      <div class="g2g-modal-footer">
        <button class="g2g-btn" style="background:#1a237e;color:#fff" onclick="readPageManual()">🔊 อ่านคู่มือ</button>
        <button class="g2g-btn" style="background:#555;color:#fff" onclick="closeManual()">✕ ปิด</button>
      </div>
    </div>
  </div>

  <!-- PAYMENT MODAL -->
  <div id="g2g-payment-overlay" onclick="if(event.target===this)closePaymentModal()">
    <div class="g2g-modal" style="max-width:780px">
      <h2>💳 รายการแจ้งชำระเงิน — ตามรายการใช้จ่ายจริง</h2>
      <p style="font-size:12px;color:#666;margin-bottom:10px">รายการที่ต้องดำเนินการอนุมัติชำระเงินตาม พรบ.การจัดซื้อจัดจ้าง 2560 | GFMIS PR→PO→ตรวจรับ→ฎีกา</p>
      <table class="g2g-pay-tbl">
        <thead><tr><th>เลขที่</th><th>รายการ</th><th>จำนวน (บาท)</th><th>ครบกำหนด</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
        <tbody id="g2g-payment-tbody"><tr><td colspan="6" style="text-align:center;padding:20px">⏳ โหลด...</td></tr></tbody>
      </table>
      <div class="g2g-modal-footer">
        <button class="g2g-btn" style="background:#555;color:#fff" onclick="closePaymentModal()">✕ ปิด</button>
      </div>
    </div>
  </div>

  <!-- ACCESS BAR -->
  <div id="g2g-access-bar">
    <div id="g2g-bar-header" onclick="toggleBar()">
      <span style="font-weight:700;font-size:12px">♿ G2G Accessibility &amp; Help</span>
      <span style="font-size:10px;color:rgba(255,255,255,0.6)">${cfg.pageName}</span>
      <span id="g2g-voice-badge"></span>
      <span style="flex:1"></span>
      <span id="g2g-collapse-icon" style="font-size:11px">${barCollapsed?'▲':'▼'}</span>
    </div>
    <div id="g2g-bar-body">
      <!-- Font Size -->
      <div class="g2g-section">
        <span class="g2g-lbl">🔤 ขนาดตัวอักษร</span>
        <button class="g2g-btn" onclick="applyFontSize(fontSize-1)">A−</button>
        <span id="g2g-fontsize-lbl">${fontSize}px</span>
        <button class="g2g-btn" onclick="applyFontSize(fontSize+1)">A+</button>
      </div>
      <!-- Voice -->
      <div class="g2g-section">
        <span class="g2g-lbl">🔊 เสียง</span>
        <button class="g2g-voice-btn" onclick="setVoice(0)" style="font-weight:${selectedVoiceIdx===0?'700':'400'};background:${selectedVoiceIdx===0?'#1565c0':'transparent'}">นิวัฒน์</button>
        <button class="g2g-voice-btn" onclick="setVoice(1)" style="font-weight:${selectedVoiceIdx===1?'700':'400'};background:${selectedVoiceIdx===1?'#1565c0':'transparent'}">เปรมวดี</button>
      </div>
      <!-- Speed -->
      <div class="g2g-section">
        <span class="g2g-lbl">⚡ ความเร็ว</span>
        ${[0.5,0.75,1.0,1.25,1.5,2.0].map(r=>'<button class="g2g-rate-btn" data-rate="'+r+'" onclick="setRate('+r+')" style="font-weight:'+(speechRate===r?'700':'400')+';background:'+(speechRate===r?'#1565c0':'transparent')+'">'+r+'x</button>').join('')}
      </div>
      <!-- Actions -->
      <div class="g2g-section">
        <button class="g2g-btn" onclick="openManual()">📖 คู่มือ</button>
        <button class="g2g-btn" onclick="readPageManual()">🔊 อ่านคู่มือ</button>
        <button class="g2g-btn" onclick="stopSpeech()">⏹ หยุด</button>
      </div>
      <!-- Payment -->
      <div class="g2g-section" style="position:relative">
        <button class="g2g-btn" onclick="openPaymentAlerts()" style="background:rgba(239,83,80,0.3);border-color:#ef5350">
          💳 ชำระเงิน
          <span id="g2g-payment-badge"></span>
        </button>
      </div>
      <!-- Hub Links -->
      <div class="g2g-section">
        <a href="/minister-dashboard.html" target="_blank" class="g2g-btn" style="text-decoration:none">🏛️ รัฐมนตรี</a>
        <a href="/ministry-hub.html?ministry=${cfg.ministryId}" target="_blank" class="g2g-btn" style="text-decoration:none">📊 Hub</a>
      </div>
    </div>
  </div>
  `;

  const container = document.createElement('div');
  container.id = 'g2g-access-container';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Expose functions globally
  window.openManual = openManual;
  window.closeManual = closeManual;
  window.readPageManual = readPageManual;
  window.speakText = speakText;
  window.stopSpeech = stopSpeech;
  window.applyFontSize = applyFontSize;
  window.setVoice = setVoice;
  window.setRate = setRate;
  window.toggleBar = toggleBar;
  window.openPaymentAlerts = openPaymentAlerts;
  window.closePaymentModal = closePaymentModal;

  // Load voices async
  if(window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = () => {};
    setTimeout(() => getThaiVoices(), 500);
  }

  checkPaymentAlerts();

  // Add bottom padding to body so bar doesn't cover content
  document.body.style.paddingBottom = '80px';
}

// Wait for DOM
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildAccessBar);
} else {
  buildAccessBar();
}
})();
