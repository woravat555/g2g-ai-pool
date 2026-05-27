/**
 * G2G Common Components — IIFE Module
 * Injects: Font Size Controller, AI Chat Panel, Token Power Meter, Help Button
 * Version: 2.0 — 2026-05-24
 */
(function () {
  "use strict";

  // ─── Constants ─────────────────────────────────────────────────
  const LS_FONT = "g2g_font_size";
  const LS_VOICE = "g2g_voice_mode";
  const FONT_SIZES = [14, 16, 18, 22];
  const FONT_LABELS = ["A-", "A", "A+", "A++"];

  // ─── Inject CSS ─────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    /* ── Token Bar ─────────────────────────── */
    #g2g-token-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9990;
      height: 36px; background: #0a1f3f;
      display: flex; align-items: center; justify-content: flex-end;
      padding: 0 16px; gap: 12px; font-family: 'Sarabun', sans-serif;
      font-size: 13px; color: rgba(255,255,255,0.85);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      pointer-events: none;
    }
    #g2g-token-bar .g2g-token-label { font-weight: 600; }
    #g2g-token-bar .g2g-token-track {
      width: 120px; height: 10px; background: rgba(255,255,255,0.2);
      border-radius: 5px; overflow: hidden;
    }
    #g2g-token-bar .g2g-token-fill {
      height: 100%; border-radius: 5px;
      background: #27a263; transition: width 0.5s, background 0.5s;
    }
    #g2g-token-bar .g2g-token-pct { min-width: 40px; text-align: right; }

    /* ── Font Controller ───────────────────── */
    #g2g-font-ctrl {
      position: fixed; bottom: 80px; right: 16px; z-index: 9980;
      display: flex; flex-direction: column; gap: 4px; align-items: flex-end;
    }
    .g2g-font-btn {
      background: #1a4f8a; color: #fff; border: none; cursor: pointer;
      font-family: 'Sarabun', sans-serif; font-weight: 700; font-size: 13px;
      padding: 6px 12px; border-radius: 6px; min-height: 36px; min-width: 44px;
      transition: background 0.15s; text-align: center;
    }
    .g2g-font-btn:hover { background: #2e6db8; }
    .g2g-font-btn.active { background: #c8991e; }

    /* ── AI Chat Panel ─────────────────────── */
    #g2g-chat-toggle {
      position: fixed; right: 0; top: 50%; transform: translateY(-50%);
      z-index: 9970; writing-mode: vertical-rl; text-orientation: mixed;
      background: linear-gradient(180deg, #1a4f8a 0%, #6d28d9 100%);
      color: #fff; border: none; cursor: pointer;
      font-family: 'Sarabun', sans-serif; font-weight: 700; font-size: 14px;
      padding: 14px 10px; border-radius: 8px 0 0 8px;
      box-shadow: -2px 0 12px rgba(0,0,0,0.3);
      transition: background 0.2s;
      min-height: 120px;
    }
    #g2g-chat-toggle:hover { background: linear-gradient(180deg, #2e6db8 0%, #7c3aed 100%); }

    #g2g-chat-panel {
      position: fixed; right: -400px; top: 0; bottom: 0; width: 380px;
      z-index: 9960; background: #0d1b2a; color: #e2e8f0;
      box-shadow: -4px 0 24px rgba(0,0,0,0.5);
      display: flex; flex-direction: column;
      font-family: 'Sarabun', sans-serif;
      transition: right 0.3s ease;
    }
    #g2g-chat-panel.open { right: 0; }

    .g2g-chat-header {
      background: linear-gradient(135deg, #0a1f3f, #1a4f8a);
      padding: 14px 16px; display: flex; align-items: center;
      justify-content: space-between; flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .g2g-chat-header-title { font-size: 15px; font-weight: 700; }
    .g2g-chat-close {
      background: rgba(255,255,255,0.15); border: none; color: #fff;
      cursor: pointer; border-radius: 6px; padding: 4px 10px; font-size: 16px;
    }
    .g2g-chat-close:hover { background: rgba(255,255,255,0.25); }

    .g2g-voice-toggle {
      display: flex; gap: 6px; padding: 10px 14px; flex-shrink: 0;
      background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .g2g-voice-btn {
      flex: 1; padding: 6px 0; border: 1.5px solid rgba(255,255,255,0.2);
      background: transparent; color: rgba(255,255,255,0.7); border-radius: 6px;
      cursor: pointer; font-family: 'Sarabun', sans-serif; font-size: 12px;
      font-weight: 600; transition: all 0.15s;
    }
    .g2g-voice-btn.active { background: #6d28d9; border-color: #6d28d9; color: #fff; }
    .g2g-voice-btn:hover:not(.active) { background: rgba(255,255,255,0.1); }

    .g2g-chat-messages {
      flex: 1; overflow-y: auto; padding: 14px; display: flex;
      flex-direction: column; gap: 10px;
    }
    .g2g-chat-messages::-webkit-scrollbar { width: 4px; }
    .g2g-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

    .g2g-msg {
      max-width: 90%; padding: 10px 14px; border-radius: 10px;
      font-size: 14px; line-height: 1.6; word-break: break-word;
    }
    .g2g-msg.user {
      align-self: flex-end; background: #1a4f8a; color: #fff;
      border-bottom-right-radius: 3px;
    }
    .g2g-msg.ai {
      align-self: flex-start; background: rgba(255,255,255,0.1); color: #e2e8f0;
      border-bottom-left-radius: 3px;
    }
    .g2g-msg.typing { color: rgba(255,255,255,0.5); font-style: italic; }

    .g2g-chat-input-area {
      padding: 12px 14px; background: rgba(0,0,0,0.3);
      border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;
      display: flex; flex-direction: column; gap: 8px;
    }
    .g2g-chat-textarea {
      width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px; color: #e2e8f0; padding: 10px 12px;
      font-family: 'Sarabun', sans-serif; font-size: 14px; resize: none; outline: none;
      min-height: 70px; transition: border-color 0.15s;
    }
    .g2g-chat-textarea:focus { border-color: rgba(109,40,217,0.7); }
    .g2g-chat-textarea::placeholder { color: rgba(255,255,255,0.35); }
    .g2g-chat-btn-row { display: flex; gap: 8px; }
    .g2g-chat-send {
      flex: 1; background: #1a4f8a; color: #fff; border: none; cursor: pointer;
      border-radius: 7px; padding: 9px 14px; font-family: 'Sarabun', sans-serif;
      font-size: 14px; font-weight: 600; transition: background 0.15s;
    }
    .g2g-chat-send:hover { background: #2e6db8; }
    .g2g-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
    .g2g-mic-btn {
      background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 7px; padding: 9px 14px; cursor: pointer; font-size: 16px;
      transition: background 0.15s; min-width: 44px;
    }
    .g2g-mic-btn:hover { background: rgba(255,255,255,0.2); }
    .g2g-mic-btn.recording { background: #c0392b; border-color: #c0392b; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }

    /* ── Help Button ───────────────────────── */
    #g2g-help-btn {
      position: fixed; bottom: 16px; left: 16px; z-index: 9980;
      background: #1a4f8a; color: #fff; border: none; cursor: pointer;
      width: 44px; height: 44px; border-radius: 50%;
      font-size: 20px; font-weight: 800;
      box-shadow: 0 2px 12px rgba(26,79,138,0.4);
      transition: background 0.15s;
    }
    #g2g-help-btn:hover { background: #2e6db8; }

    #g2g-help-modal {
      display: none; position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,0.6); align-items: center; justify-content: center;
    }
    #g2g-help-modal.open { display: flex; }
    .g2g-help-box {
      background: #fff; border-radius: 12px; max-width: 540px; width: 90%;
      max-height: 80vh; overflow-y: auto; padding: 28px;
      font-family: 'Sarabun', sans-serif; color: #1e293b;
      box-shadow: 0 8px 40px rgba(0,0,0,0.4);
    }
    .g2g-help-box h2 { font-size: 20px; font-weight: 800; color: #1a4f8a; margin-bottom: 14px; }
    .g2g-help-box p, .g2g-help-box li { font-size: 15px; line-height: 1.7; margin-bottom: 8px; }
    .g2g-help-close {
      display: block; margin-top: 18px; background: #1a4f8a; color: #fff;
      border: none; cursor: pointer; border-radius: 7px; padding: 10px 24px;
      font-family: 'Sarabun', sans-serif; font-size: 14px; font-weight: 600;
    }
    .g2g-help-close:hover { background: #2e6db8; }

    /* ── Toast Notification ────────────────── */
    #g2g-toast-common {
      position: fixed; bottom: 24px; right: 24px; z-index: 10010;
      background: #1a4f8a; color: #fff; padding: 12px 20px; border-radius: 10px;
      font-family: 'Sarabun', sans-serif; font-size: 14px; font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transform: translateY(80px); opacity: 0;
      transition: all 0.3s; pointer-events: none;
    }
    #g2g-toast-common.show { transform: translateY(0); opacity: 1; }
    #g2g-toast-common.warn { background: #c8991e; }
    #g2g-toast-common.error { background: #c0392b; }

    /* ── Body padding for token bar ────────── */
    body { padding-top: 36px !important; }
  `;
  document.head.appendChild(style);

  // ─── Build DOM ──────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", init);
  // Also try immediately if DOM already loaded
  if (document.readyState !== "loading") init();

  function init() {
    injectTokenBar();
    injectFontController();
    injectChatPanel();
    injectHelpButton();
    injectToast();
    applyStoredFontSize();
    startTokenPolling();
  }

  // ─── Token Bar ─────────────────────────────────────────────────
  function injectTokenBar() {
    const bar = document.createElement("div");
    bar.id = "g2g-token-bar";
    bar.innerHTML = `
      <span class="g2g-token-label">Token เหลือ:</span>
      <div class="g2g-token-track"><div class="g2g-token-fill" id="g2g-tf" style="width:85%"></div></div>
      <span class="g2g-token-pct" id="g2g-tp">85%</span>
    `;
    document.body.prepend(bar);
  }

  function startTokenPolling() {
    fetchTokenStatus();
    setInterval(fetchTokenStatus, 30000);
  }

  async function fetchTokenStatus() {
    try {
      const r = await fetch("/api/system/token-status");
      const d = await r.json();
      const pct = d.remaining_percent || 85;
      const fill = document.getElementById("g2g-tf");
      const label = document.getElementById("g2g-tp");
      if (fill) {
        fill.style.width = pct + "%";
        fill.style.background = pct > 50 ? "#27a263" : pct > 20 ? "#c8991e" : "#c0392b";
      }
      if (label) label.textContent = pct + "%";
      if (pct < 20) {
        showCommonToast("Token ใกล้หมด กรุณาเติม", "warn", 5000);
      }
    } catch (_) {}
  }

  // ─── Font Size Controller ───────────────────────────────────────
  function injectFontController() {
    const ctrl = document.createElement("div");
    ctrl.id = "g2g-font-ctrl";
    FONT_LABELS.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.className = "g2g-font-btn";
      btn.textContent = label;
      btn.dataset.size = FONT_SIZES[i];
      btn.title = `ขนาดตัวอักษร ${FONT_SIZES[i]}px`;
      btn.onclick = () => applyFontSize(FONT_SIZES[i]);
      ctrl.appendChild(btn);
    });
    document.body.appendChild(ctrl);
  }

  function applyFontSize(size) {
    document.body.style.fontSize = size + "px";
    localStorage.setItem(LS_FONT, size);
    document.querySelectorAll(".g2g-font-btn").forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.dataset.size) === size);
    });
  }

  function applyStoredFontSize() {
    const stored = parseInt(localStorage.getItem(LS_FONT)) || 18;
    applyFontSize(stored);
  }

  // ─── AI Chat Panel ──────────────────────────────────────────────
  let chatHistory = [];
  let recognition = null;
  let isRecording = false;

  function injectChatPanel() {
    // Toggle button on right edge
    const toggle = document.createElement("button");
    toggle.id = "g2g-chat-toggle";
    toggle.innerHTML = "🤖 คุยกับ AI";
    toggle.title = "เปิดผู้ช่วย AI";
    toggle.onclick = openChatPanel;
    document.body.appendChild(toggle);

    // Panel
    const panel = document.createElement("div");
    panel.id = "g2g-chat-panel";
    panel.innerHTML = `
      <div class="g2g-chat-header">
        <div>
          <div class="g2g-chat-header-title">🤖 ผู้ช่วย AI ภาครัฐ</div>
          <div style="font-size:11px;opacity:0.7;margin-top:2px;">ระบบบริหารภาครัฐ G2G</div>
        </div>
        <button class="g2g-chat-close" onclick="document.getElementById('g2g-chat-panel').classList.remove('open')" title="ปิด">✕</button>
      </div>
      <div class="g2g-voice-toggle">
        <button class="g2g-voice-btn active" id="g2g-vbtn-browser" onclick="setVoiceMode('browser')">🎙️ G2G Voice</button>
        <button class="g2g-voice-btn" id="g2g-vbtn-chatgpt" onclick="setVoiceMode('chatgpt')">🔊 ChatGPT Voice</button>
      </div>
      <div class="g2g-chat-messages" id="g2g-chat-msgs">
        <div class="g2g-msg ai">สวัสดีครับ ผมคือผู้ช่วย AI ของระบบบริหารภาครัฐ G2G<br>มีอะไรให้ช่วยไหมครับ?</div>
      </div>
      <div class="g2g-chat-input-area">
        <textarea class="g2g-chat-textarea" id="g2g-chat-input" placeholder="พิมพ์คำถาม หรือกดไมค์เพื่อพูด..." rows="3"></textarea>
        <div class="g2g-chat-btn-row">
          <button class="g2g-chat-send" id="g2g-send-btn" onclick="g2gSendChat()">ส่ง</button>
          <button class="g2g-mic-btn" id="g2g-mic-btn" onclick="g2gToggleMic()" title="พูดด้วยเสียง">🎙️</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Enter to send (Shift+Enter for newline)
    document.getElementById("g2g-chat-input").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); g2gSendChat(); }
    });

    // Restore voice mode preference
    const savedMode = localStorage.getItem(LS_VOICE) || "browser";
    setVoiceMode(savedMode);
  }

  function openChatPanel() {
    document.getElementById("g2g-chat-panel").classList.add("open");
  }

  function setVoiceMode(mode) {
    localStorage.setItem(LS_VOICE, mode);
    document.getElementById("g2g-vbtn-browser").classList.toggle("active", mode === "browser");
    document.getElementById("g2g-vbtn-chatgpt").classList.toggle("active", mode === "chatgpt");
    if (mode === "chatgpt") {
      setTimeout(() => {
        if (confirm("เปิด ChatGPT Voice ใน tab ใหม่ แล้วกลับมาใช้ G2G ได้เลยครับ")) {
          window.open("https://chat.openai.com", "_blank");
        }
        // Revert selection back to browser since ChatGPT Voice is external
        setVoiceMode("browser");
      }, 100);
    }
  }

  window.g2gSendChat = async function () {
    const input = document.getElementById("g2g-chat-input");
    const msg = input.value.trim();
    if (!msg) return;
    input.value = "";
    appendMsg("user", msg);
    chatHistory.push({ role: "user", content: msg });
    const btn = document.getElementById("g2g-send-btn");
    btn.disabled = true; btn.textContent = "กำลังคิด...";
    const typingEl = appendMsg("ai", "...", "typing");
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context: window.location.pathname }),
      });
      const d = await r.json();
      const reply = d.reply || d.response || d.message || "ขออภัย ไม่สามารถตอบได้ในขณะนี้";
      typingEl.textContent = reply;
      typingEl.className = "g2g-msg ai";
      chatHistory.push({ role: "assistant", content: reply });
      // Read aloud if browser voice mode
      if (localStorage.getItem(LS_VOICE) !== "chatgpt" && window.speechSynthesis) {
        const utter = new SpeechSynthesisUtterance(reply);
        utter.lang = "th-TH";
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {
      typingEl.textContent = "เกิดข้อผิดพลาด กรุณาลองใหม่";
      typingEl.className = "g2g-msg ai";
    } finally {
      btn.disabled = false; btn.textContent = "ส่ง";
    }
    scrollChatBottom();
  };

  window.g2gToggleMic = function () {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      showCommonToast("เบราว์เซอร์นี้ไม่รองรับการรับเสียง", "warn");
      return;
    }
    if (isRecording) { stopRecording(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "th-TH";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = e => {
      const text = e.results[0][0].transcript;
      document.getElementById("g2g-chat-input").value = text;
      stopRecording();
      g2gSendChat();
    };
    recognition.onerror = () => { stopRecording(); showCommonToast("ไม่สามารถรับเสียงได้", "warn"); };
    recognition.onend = () => stopRecording();
    recognition.start();
    isRecording = true;
    document.getElementById("g2g-mic-btn").classList.add("recording");
    document.getElementById("g2g-mic-btn").textContent = "⏹️";
  };

  function stopRecording() {
    isRecording = false;
    if (recognition) { try { recognition.stop(); } catch (_) {} }
    const btn = document.getElementById("g2g-mic-btn");
    if (btn) { btn.classList.remove("recording"); btn.textContent = "🎙️"; }
  }

  function appendMsg(role, text, extraClass) {
    const el = document.createElement("div");
    el.className = "g2g-msg " + role + (extraClass ? " " + extraClass : "");
    el.textContent = text;
    document.getElementById("g2g-chat-msgs").appendChild(el);
    scrollChatBottom();
    return el;
  }

  function scrollChatBottom() {
    const msgs = document.getElementById("g2g-chat-msgs");
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  // ─── Help Button ────────────────────────────────────────────────
  function injectHelpButton() {
    const btn = document.createElement("button");
    btn.id = "g2g-help-btn";
    btn.textContent = "?";
    btn.title = "คำแนะนำการใช้งาน";
    btn.onclick = openHelp;
    document.body.appendChild(btn);

    const modal = document.createElement("div");
    modal.id = "g2g-help-modal";
    modal.innerHTML = `
      <div class="g2g-help-box">
        <h2>📖 คำแนะนำการใช้งาน</h2>
        <div id="g2g-help-content"></div>
        <button class="g2g-help-close" onclick="document.getElementById('g2g-help-modal').classList.remove('open')">ปิด</button>
      </div>
    `;
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
    document.body.appendChild(modal);
  }

  function openHelp() {
    const content = document.getElementById("g2g-help-content");
    const custom = window.G2G_HELP_CONTENT;
    content.innerHTML = custom || `
      <p>ระบบบริหารภาครัฐ G2G — คำแนะนำทั่วไป</p>
      <ul>
        <li>ใช้แท็บด้านบนเพื่อสลับระหว่างส่วนต่างๆ</li>
        <li>กดปุ่ม <strong>A- / A / A+ / A++</strong> มุมขวาล่างเพื่อปรับขนาดตัวอักษร</li>
        <li>กด <strong>🤖 คุยกับ AI</strong> ด้านขวาเพื่อเรียกผู้ช่วย AI</li>
        <li>แถบบนสุดแสดงสถานะ Token ที่ใช้งานได้</li>
        <li>หากพบปัญหา กรุณาติดต่อผู้ดูแลระบบ</li>
      </ul>
    `;
    document.getElementById("g2g-help-modal").classList.add("open");
  }

  // ─── Common Toast ───────────────────────────────────────────────
  function injectToast() {
    const el = document.createElement("div");
    el.id = "g2g-toast-common";
    document.body.appendChild(el);
  }

  function showCommonToast(msg, type, ms = 3500) {
    const el = document.getElementById("g2g-toast-common");
    if (!el) return;
    el.textContent = msg;
    el.className = "show" + (type ? " " + type : "");
    setTimeout(() => { el.className = ""; }, ms);
  }

  // Expose globally for pages that need it
  window.G2G_Common = { showToast: showCommonToast, openChatPanel };

})();
