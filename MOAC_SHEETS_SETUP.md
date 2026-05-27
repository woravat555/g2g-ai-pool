# MOAC Sheets Sync — Setup Guide

ระบบ mirror ข้อมูล MOAC Platform (tasks / reports / kpis / audit_log) ขึ้น Google Sheet
เพื่อให้ทีมงานที่ไม่ใช่ developer เปิดดู/แก้ผ่าน Google One Drive ได้

สถาปัตยกรรม: Fly.io (server.js) → POST → Apps Script Web App → Google Sheet

---

## 1. Create the Google Sheet

1. ไปที่ <https://sheets.google.com> ด้วย account `woravat.a@gmail.com` (เจ้าของ G2G AgriTech)
2. กด **Blank spreadsheet** → ตั้งชื่อ `MOAC Platform Sync`
3. คัดลอก link ของ Sheet เก็บไว้ (ไม่ต้องสร้าง tab เอง — Apps Script จะสร้าง 4 tab ให้อัตโนมัติ:
   `Tasks`, `Reports`, `KPIs`, `AuditLog`)

---

## 2. Open Apps Script and paste code

1. ใน Sheet ที่เพิ่งสร้าง → เมนู **Extensions → Apps Script**
2. ลบโค้ดเริ่มต้นใน `Code.gs` ทั้งหมด
3. เปิดไฟล์ `scripts/moac-sheets-apps-script.gs` ใน repo
4. **Copy ทั้งไฟล์** → paste ใส่ใน `Code.gs`
5. กด **Save** (icon รูป disk หรือ Ctrl/Cmd+S)
6. ตั้งชื่อโปรเจกต์เป็น `MOAC Sheets Sync`

> ถ้าอยากเปลี่ยน API key ให้แก้ค่า `const API_KEY` ที่บรรทัดบนสุด —
> ต้องเปลี่ยน secret `MOAC_SYNC_KEY` บน Fly ให้ตรงกันด้วย

---

## 3. Deploy as Web App

1. มุมขวาบน กด **Deploy → New deployment**
2. กดไอคอนเฟือง → เลือก **Web app**
3. กรอกค่า:
   - **Description**: `MOAC Sheets Sync v1`
   - **Execute as**: `Me (woravat.a@gmail.com)` — สำคัญ! ต้องเป็น "Me" ไม่ใช่ "User accessing the web app"
   - **Who has access**: `Anyone` — **ห้ามเลือก "Only myself" หรือ "Anyone with Google account"** ไม่งั้น Fly จะ POST ไม่ได้
4. กด **Deploy**
5. ครั้งแรกจะมีหน้า **Authorize access** ขึ้นมา → กด **Review permissions**
   - เลือก account `woravat.a@gmail.com`
   - หน้า "Google hasn't verified this app" → กด **Advanced → Go to MOAC Sheets Sync (unsafe)**
   - กด **Allow** ให้สิทธิ์ Spreadsheet
6. **คัดลอก Web app URL** ที่ขึ้นมา — รูปแบบ:
   `https://script.google.com/macros/s/AKfycb.../exec`

> ในหน้า Deploy ให้เลือก **"Anyone"** ใน Access dropdown — ห้ามเลือก **"Only myself"** หรือ **"Anyone with Google account"** ไม่งั้นจะเจอ error "Authorization required" ตอน Fly call เข้ามา

---

## 4. Set Fly.io secrets

```bash
fly secrets set SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/AKfycb.../exec \
                MOAC_SYNC_KEY=MOAC_SYNC_KEY_2026 \
                --app g2g-ai-pool
```

> ถ้าใช้ key default (`MOAC_SYNC_KEY_2026`) ไม่ต้องตั้ง `MOAC_SYNC_KEY` ก็ได้

---

## 5. Restart Fly app

```bash
fly deploy --strategy immediate --app g2g-ai-pool
```

หรือถ้าไม่ได้แก้ code แค่ปรับ secret อย่างเดียว:

```bash
fly machines restart --app g2g-ai-pool
```

---

## 6. Test the endpoint

```bash
curl -X POST https://g2g-ai-pool.fly.dev/api/moac/sheets-sync \
  -H 'content-type: application/json' \
  -d '{"action":"append","table":"audit_log","record":{"ts":"now","action":"test","actor":"me"}}'
```

ผลลัพธ์ที่คาดหวัง:

```json
{"ok":true,"action":"append","table":"audit_log","row":2}
```

---

## 7. Verify in the Sheet

1. กลับไปดู Google Sheet `MOAC Platform Sync`
2. ตรวจว่ามี tab ใหม่ชื่อ **AuditLog** ถูกสร้างขึ้น
3. แถวที่ 1 = header (`ts | action | actor | target | payload`)
4. แถวที่ 2 = ข้อมูลที่ส่งจาก curl

ถ้าเห็นข้อมูลถูกต้อง → setup complete

---

## 8. Test list endpoint

```bash
curl 'https://g2g-ai-pool.fly.dev/api/moac/sheets/audit_log?limit=10'
```

จะได้:

```json
{"ok":true,"table":"audit_log","count":1,"rows":[{"ts":"now","action":"test","actor":"me","target":"","payload":""}]}
```

---

## Tables / Schemas

Apps Script จะสร้าง tab ตามนี้ (ถ้ายังไม่มี):

| Tab        | Columns |
|------------|---------|
| Tasks      | `id, from, fromName, to, toName, title, detail, priority, status, created, updated` |
| Reports    | `id, from, fromName, fromLevel, toLevel, title, summary, dataJson, created` |
| KPIs       | `id, dept, metric, value, target, asOf, source` |
| AuditLog   | `ts, action, actor, target, payload` |

ถ้าจะเพิ่ม/แก้ column ให้แก้ที่ `SCHEMAS` ใน `moac-sheets-apps-script.gs` แล้ว redeploy

---

## Auto-sync hooks

หลัง deploy แล้ว routes ต่อไปนี้ใน `server.js` จะส่งข้อมูลเข้า Sheet อัตโนมัติ
(fire-and-forget — ไม่ block response):

- `POST /api/moac/assign` → append ไป `Tasks`
- `POST /api/moac/report` → append ไป `Reports`

routes สำหรับใช้งานตรง:

- `POST /api/moac/sheets-sync` body `{action, table, record}`
- `GET  /api/moac/sheets/:table?limit=100&status=pending&...`

---

## Troubleshooting

### 1. `Authorization required` / HTML response

อาการ: response เป็น HTML page ของ Google sign-in ไม่ใช่ JSON

แก้: deploy ใหม่โดยตั้ง **Who has access = Anyone** (ไม่ใช่ "Anyone with Google account")
และต้องกด **Authorize** ครั้งแรกตอน deploy ด้วย account เจ้าของ script

### 2. 302 redirect loop / response ว่าง

อาการ: Fly log แสดง `non_json_response` หรือ body ว่าง

แก้: ตรวจว่า `_callOnce` ใน `moac-sheets-sync.js` ใช้ `redirect: 'manual'` แล้วตามไป GET `Location` header
(โค้ดในไฟล์ทำให้แล้ว ถ้ายัง error ลองยิงจาก `curl -v` ดู Location header ตรงๆ)

### 3. `Exception: Service Spreadsheets failed`

อาการ: Apps Script return `{ok:false, error:"exception: Service Spreadsheets failed..."}`

สาเหตุ:
- Sheet ถูกลบ / move ไป Trash → กู้คืน Sheet
- Quota Spreadsheets เกิน (writes/min) → รอ 1-2 นาที หรือลด traffic
- Sheet ไม่ใช่ของ account ที่ deploy script → re-deploy ใน Sheet ใหม่ที่เป็นของเจ้าของ

### 4. `payload_too_large`

อาการ: response `{ok:false, error:"payload_too_large", bytes: ...}`

แก้: ตัด field `data` หรือ `payload` ที่ใหญ่เกินไป (>50KB) ออกก่อนส่ง
หรือเก็บ data ใหญ่ไว้ใน Drive แล้ว reference ด้วย fileId เท่านั้น

### 5. Sync route returns `{ok:false, error:"network_error"}`

- Apps Script URL อาจ deprecated หลัง redeploy → คัดลอก URL ใหม่จาก Deployment dropdown → ตั้ง `SHEETS_WEBHOOK_URL` ใหม่
- Apps Script web app มี cold-start ~3-5 วินาที → ถ้า timeout 8s ยังไม่พอให้เพิ่ม `TIMEOUT_MS` ใน `moac-sheets-sync.js`

### 6. ขึ้น `unauthorized` ใน Apps Script response

อาการ: response `{ok:false, error:"unauthorized"}`

แก้: ตรวจว่า `MOAC_SYNC_KEY` บน Fly == `API_KEY` ใน Apps Script
ถ้าเพิ่งเปลี่ยน key ต้อง redeploy Fly ด้วย

### 7. Bot ไม่ตอบ / route 404

ตรวจว่า server.js ได้ register route หรือยัง — grep หา `'/api/moac/sheets-sync'` ใน `server.js`
และดู Fly log ตอน startup ว่ามีบรรทัด `[G2G] MOAC Sheets Sync routes registered` หรือไม่

---

## Tradeoffs / Limits

- **Apps Script execution limit**: 6 นาทีต่อ request — bulk sync จำนวนมากต้อง batch
- **Quota**: free account ~20,000 URL Fetch calls/วัน — ถ้า traffic เยอะให้ใช้ workspace account
- **Cold start**: ครั้งแรกหลังว่างนาน ๆ อาจช้า 3-5s
- **Eventual consistency**: เพราะใช้ fire-and-forget ใน /assign และ /report ถ้า Sheet down อยู่ข้อมูลจะหายจาก Sheet (แต่ยังอยู่ใน in-memory ของ server.js) — ออกแบบให้ Sheet เป็น "mirror" ไม่ใช่ source of truth

---

## Files in this setup

- `scripts/moac-sheets-apps-script.gs` — paste into Apps Script
- `scripts/moac-sheets-sync.js` — Node module imported by server.js
- `MOAC_SHEETS_SETUP.md` — this file
- `server.js` — มี route `/api/moac/sheets-sync` + `/api/moac/sheets/:table` + auto-mirror hooks
