# MOAC Directive (คำสั่ง/นโยบาย) Cascade System

ระบบสั่งการตามลำดับชั้น (Top-down Command-and-Control) สำหรับกระทรวงเกษตรและสหกรณ์
ทำงานคู่ขนานกับระบบมอบหมายงาน (Task) และระบบรายงาน (Report) ที่มีอยู่เดิม

## 1. ความแตกต่างของแนวคิด

| ประเภท | ลักษณะ | ทิศทาง | ตัวอย่าง |
|---|---|---|---|
| **Task (งาน)** | งานชิ้นเดียวที่มอบหมายให้บุคคลหนึ่ง | บนลงล่าง (เป็นคู่) | "ทำรายงานยางพารา ภายในศุกร์" |
| **Report (รายงาน)** | สรุปผลการดำเนินงาน | **ล่างขึ้นบน** | "ผลงานเดือน พ.ค. 2569" |
| **Directive (คำสั่ง/นโยบาย)** | นโยบายที่ต้องกระจายลงตามสายบังคับบัญชา พร้อมการรับทราบและรายงานผลปฏิบัติทุกระดับ | **บนลงล่างทั้งสายงาน** | "ลดราคาปุ๋ยร้อยละ 30 ภายในไตรมาส 3" |

Directive แตกต่างจาก Task ตรงที่ **ต้องผ่านโซ่การรับทราบ** (acknowledgement chain) และมี **การติดตามความสำเร็จเชิงนโยบาย** (compliance tracking) ในทุกระดับ ไม่ใช่แค่คนเดียว

## 2. โครงสร้างของหนึ่งคำสั่ง

```jsonc
{
  "id": "MD1716700000000",
  "code": "MOAC-DIR-2569-0001",        // auto-generated, sequential per Thai year
  "title": "ลดราคาปุ๋ยให้เกษตรกรร้อยละ 30",
  "body": "...",
  "category": "policy",                 // policy / regulation / urgent_order / cabinet_resolution
  "issuedBy": "moac-minister",
  "issuedByName": "รัฐมนตรีว่าการกระทรวงเกษตรและสหกรณ์",
  "issuedAt": "2026-05-26T...",
  "targetLevel": ["ps","dept-head","provincial"],
  "dueDate": "2026-09-30",
  "priority": "urgent",                 // normal / high / urgent
  "kpis": [{ "name":"ราคาปุ๋ยเฉลี่ย", "target":"-30%", "unit":"%" }],
  "relatedPolicyId": "POLICY-LOWER-COST",
  "attachments": [],
  "status": "in_progress",              // draft / issued / in_progress / completed / cancelled
  "acknowledgements": [
    { "roleId":"moac-ps", "roleName":"ปลัดกระทรวง", "acknowledgedAt":"…",
      "compliance":"in_progress", "compliancePct":40, "evidence":[], "reportedAt":"…" }
  ],
  "cascades": [
    { "fromRoleId":"moac-minister", "toRoleIds":["moac-ps"], "note":"…", "ts":"…" },
    { "fromRoleId":"moac-ps", "toRoleIds":["moac-doae","moac-rid"], "ts":"…" }
  ]
}
```

## 3. 9 Endpoints (curl examples)

ทุก endpoint อยู่ภายใต้ prefix `/api/moac` และเขียนข้อมูลต้องใส่ `x-api-key: moac2026` หรือ `phrae2026`.

```bash
# 3.1 ออกคำสั่งใหม่
curl -X POST https://HOST/api/moac/directives \
  -H "x-api-key: moac2026" -H "Content-Type: application/json" \
  -d '{"issuedBy":"moac-minister","issuedByName":"รมว.กษ.",
       "title":"ลดราคาปุ๋ยร้อยละ 30","body":"…",
       "category":"urgent_order","priority":"urgent","dueDate":"2026-09-30",
       "targetLevel":["ps","dept-head","provincial"],
       "kpis":[{"name":"ราคาปุ๋ย","target":"-30","unit":"%"}]}'

# 3.2 รายการคำสั่ง (ค้นหา/กรอง)
curl "https://HOST/api/moac/directives?status=in_progress&priority=urgent&limit=20"

# 3.3 ดูคำสั่งหนึ่งรายการ + acknowledgement chain + cascade tree
curl https://HOST/api/moac/directives/MD1716700000000

# 3.4 รับทราบคำสั่ง
curl -X POST https://HOST/api/moac/directives/MD1716700000000/acknowledge \
  -H "x-api-key: moac2026" -H "Content-Type: application/json" \
  -d '{"roleId":"moac-ps","roleName":"ปลัดกระทรวง","note":"รับทราบและจะดำเนินการ"}'

# 3.5 กระจายคำสั่งให้ผู้ใต้บังคับบัญชา
curl -X POST https://HOST/api/moac/directives/MD1716700000000/cascade \
  -H "x-api-key: moac2026" -H "Content-Type: application/json" \
  -d '{"fromRoleId":"moac-ps","toRoleIds":["moac-doae","moac-rid"],
       "toRoleNames":["อธิบดี DOAE","อธิบดี RID"],"note":"…"}'

# 3.6 รายงานความก้าวหน้า
curl -X POST https://HOST/api/moac/directives/MD1716700000000/compliance \
  -H "x-api-key: moac2026" -H "Content-Type: application/json" \
  -d '{"roleId":"moac-doae","compliance":"in_progress","compliancePct":40,
       "evidence":[{"type":"link","url":"https://…","note":"รายงาน Q3"}]}'

# 3.7 สรุปผลปฏิบัติ
curl https://HOST/api/moac/directives/MD1716700000000/compliance-summary

# 3.8 คำสั่งที่ค้างปฏิบัติของบุคคลหนึ่ง (สำหรับ inbox)
curl https://HOST/api/moac/directives/active-for/moac-doae

# 3.9 ยกเลิกคำสั่ง (เฉพาะผู้ออกหรือ รมว./ปลัด)
curl -X POST https://HOST/api/moac/directives/MD1716700000000/cancel \
  -H "x-api-key: moac2026" -H "Content-Type: application/json" \
  -d '{"roleId":"moac-minister","reason":"ปรับเปลี่ยนแนวทาง"}'
```

## 4. การไหลของงานต่อบทบาท (UI Flow)

```
รัฐมนตรี (moac-minister)
  └─[ออกคำสั่ง MOAC-DIR-2569-0001]→ targetLevel=[ps,dept-head,provincial]
       │
       ▼ (LINE / Bell notification "directive_received")
ปลัดกระทรวง (moac-ps)
  ├─[คำสั่งที่ค้าง → รอรับทราบ] → กดปุ่ม "รับทราบ" → POST /acknowledge
  ├─[คำสั่งที่ค้าง → ต้องกระจายต่อ] → เลือก 4 อธิบดี → POST /cascade
  │       │
  │       ▼
  │   อธิบดี DOAE/RID/RD/LDD (moac-doae ฯลฯ)
  │     ├─ รับทราบ (POST /acknowledge)
  │     ├─ กระจายให้ รองอธิบดี + จังหวัด (POST /cascade)
  │     └─ รายงานผลขั้นกรม (POST /compliance compliancePct=…)
  │
  └─ รวบรวมสรุป (GET /compliance-summary) → รายงานต่อ รมว.
```

ฝั่ง UI (moac-app.js append block) เพิ่ม 3 ปุ่มใน Quick-Action bar:
- **📜 ออกคำสั่ง/นโยบายใหม่** — เห็นเฉพาะ รมว. / รมช. / ปลัด
- **📥 คำสั่งที่ค้าง** — เห็นทุกระดับ พร้อม badge นับจำนวน (auto-refresh ทุก 60 วินาที) เปิดแล้วมี 3 แท็บ: รอรับทราบ · ต้องกระจายต่อ · ต้องรายงานผล
- **🌳 สายงานคำสั่ง** — เห็นทุกระดับ แสดงโครงสร้างต้นไม้การกระจายคำสั่ง พร้อมแถบสีตามสถานะ (เทา=รอ, น้ำเงิน=กำลังทำ, เขียว=บรรลุผล, แดง=ล้มเหลว, เหลือง=เลยกำหนด)

## 5. การเชื่อมโยงกับระบบ Notification

หลังออกคำสั่ง:
- ผู้รับทุกคนใน `targetLevel` จะปรากฏ event ประเภท `directive_received` ในระบบ Bell notification เดิม (`GET /api/moac/notifications/:roleId`)
- ระบบจะ derive ฟิลด์ `overdue=true` อัตโนมัติเมื่อเกิน 48 ชั่วโมงจาก `dueDate` และยังไม่บรรลุผล
- เมื่อทุก entry บรรลุ `compliance=achieved` → directive `status` เปลี่ยนเป็น `completed` อัตโนมัติ

## 6. การจัดเก็บข้อมูล (Persistence)

- เก็บใน array `moacDirectives` ใน-memory
- Persist ลง `/tmp/moac-data.json` ทุก 30 วินาที (ใช้ไฟล์เดียวกับ tasks/reports)
- Auto-hydrate ตอน server boot — รอด Fly machine restart
- Mirror ขึ้น Google Sheets (`audit_log` table) แบบ fire-and-forget เมื่อ `SHEETS_WEBHOOK_URL` ถูก set

## 7. ตัวอย่าง Lifecycle ของคำสั่ง

| เวลา | เหตุการณ์ | ผู้กระทำ | ผลต่อ directive |
|---|---|---|---|
| T+0 | ออกคำสั่ง | รมว. | status=`issued`, สร้าง ack entry 1 รายการต่อ level |
| T+1h | รับทราบ | ปลัด | status=`in_progress`, ack.acknowledgedAt=… |
| T+2h | กระจายต่อ → 4 อธิบดี | ปลัด | เพิ่ม 4 ack entries, cascades[] +=1 |
| T+1d | อธิบดี DOAE รับทราบ + รายงาน 30% | อธิบดี | compliance=`in_progress`, compliancePct=30 |
| T+2w | อธิบดี DOAE รายงาน 100% บรรลุผล | อธิบดี | compliance=`achieved` |
| T+1mo | ทุก entry achieved | ระบบ | status=`completed` อัตโนมัติ |

## 8. ข้อพิจารณาด้านการออกแบบ (Trade-offs)

- **Level vs RoleId targeting** — ตอนออกคำสั่ง ถ้าระบุ `targetRoleIds[]` ตรง ๆ ระบบจะสร้าง ack entry ทันที. ถ้าระบุแค่ `targetLevel[]` ระบบจะสร้าง entry กลาง (เช่น `level:dept-head`) แล้วให้ขั้น cascade ถัด ๆ ไประบุตัวบุคคลจริง — เหมาะกับกรณีนโยบายกว้าง
- **Cancellation authority** — ปัจจุบันให้สิทธิ์ผู้ออก + `moac-minister` + `moac-ps` เท่านั้น
- **Persistence** — ใช้ไฟล์เดียวกับ tasks/reports เพื่อความง่ายในการ deploy แต่หากข้อมูลโตเกิน 50MB ควรย้ายไป Airtable/SQLite
- **48h overdue grace** — ปรับได้ใน `isDirectiveOverdue()` ในอนาคต
