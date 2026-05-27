# 🔒 IRON RULES — G2G AgriTech Project
**Last updated**: 2026-05-25 (by CEO directive)
**Severity**: ABSOLUTE — ห้ามฝ่าฝืนทุกกรณี

---

## RULE #1: ระบบที่ใช้งานได้จริง ไม่ใช่ Demo / หน้ากาก
> **CEO Directive (2026-05-25)**: "ในการทำงานทั้งหมด คุณต้องระดมเอไอทำระบบที่ใช้การได้จริง ไม่เอาแค่หน้ากากหรือ Demo"

**ห้าม:**
- ❌ ทำหน้า HTML ที่แสดงข้อมูล static อย่างเดียว (ไม่มี CRUD)
- ❌ ทำ mockup / wireframe / placeholder
- ❌ Skip backend integration (ต้องเชื่อม Airtable + server.js routes จริง)
- ❌ Ship ระบบที่ "ดูเหมือนใช้ได้" แต่ปุ่มกดไม่ทำงาน
- ❌ ส่งงานที่ยังไม่ได้ test ผ่าน live URL

**ต้อง:**
- ✅ ทุก feature มี POST/PUT/DELETE endpoint รองรับ (CRUD complete)
- ✅ บันทึกข้อมูลลง Airtable ได้จริง (fallback static OK แต่ต้องมี write path)
- ✅ Test ผ่าน live URL (https://g2g-ai-pool.fly.dev/) ก่อนรายงาน CEO
- ✅ ระดม AI agents (Task tool) ทำงานคู่ขนานเมื่อ scope ใหญ่

---

## RULE #2: ห้ามใส่ ธ.ก.ส. / พช. เข้าโครงสร้าง กษ.
- ธ.ก.ส. เป็น **รัฐวิสาหกิจ** ไม่ใช่กรมในกระทรวงเกษตร
- พช. (พัฒนาชุมชน) อยู่ภายใต้ มท. ไม่ใช่ กษ.

## RULE #3: Universal Citizen Key
- Citizen ID 13 หลัก = Universal Key เชื่อมทุกกระทรวง
- ห้ามใช้ field อื่นเป็น primary key ระหว่างระบบ

## RULE #4: Province-First Architecture
- พัฒนาตามลำดับ: แพร่ → เชียงราย → อุดร → 76 จังหวัด → ชาติ → นานาชาติ
- API pattern: `/api/{province_code}/{ministry}/*` เสมอ

## RULE #5: Static Fallback Required
- ทุก GET route ต้องมี fallback ไป static JSON (public/*-data.json)
- ใช้ pattern: try Airtable → catch any error → fall back to JSON
- เหตุผล: AIRTABLE_TOKEN อาจไม่มี scope สำหรับ base ใหม่

## RULE #6: Bracket-Tagged Memory Categories
- บันทึกความจำใช้ tag เช่น `[FruitClip]`, `[FarmerMgmt]`, `[GovAdmin]`
- ดู skill: `g2g-category-memory`

## RULE #7: Airtable Bases (NEVER CHANGE)
- `AIRTABLE_BASE = app6keeRcHmiTMLKy` — MAIN BASE (platform config)
- `PHRAE_BASE = appXQC4uFhjeBpC7T` — PROVINCE BASE (Phrae data)
- `PHRAE_API_KEY = phrae2026`

## RULE #8: จ้างเหมาบริการ = หมวดค่าใช้สอย ของงบดำเนินงาน
- ไม่ใช่งบบุคลากร / ไม่ใช่งบลงทุน
- field name: `operating_budget`

## RULE #9: ห้าม Deploy โดยไม่ Test
- รัน `fly deploy --app g2g-ai-pool` แล้วต้อง curl test endpoints ทันที
- เปิด live URL ตรวจ console error
- ถ้าเปิด local file:// ไม่ได้ — ต้อง embed inline หรือชี้แจง

## RULE #10: 76 จังหวัด Display Policy
- ใน UI ทุกหน้าที่แสดงรายชื่อจังหวัด ให้แสดง **ครบ 76 จังหวัด** เสมอ
- จังหวัด active (เปิดได้): กดได้
- จังหวัดที่ยังไม่พร้อม: **ปุ่มสีเทา + tooltip "Coming Soon"** (ไม่ใช่ซ่อน)

---

## CEO Directives Log
| Date | Directive |
|------|-----------|
| 2026-05-24 | Phase 1 กษ. แพร่ — Done |
| 2026-05-25 | Add เชียงราย + อุดรธานี |
| 2026-05-25 | "ลำไยเชียงรายเยอะ ให้ศึกษาสินค้าให้ละเอียด" |
| 2026-05-25 | Add อุดรธานี (จังหวัดที่ 3) |
| 2026-05-25 | "งานไม่เรียบร้อยเลย ของแพร่ก็ไม่มี" → file:// fetch bug → embed inline |
| 2026-05-25 | "เอาแพลตฟอร์มกระทรวงและจังหวัดขึ้นหน้าเดสก์ท็อป ทำโลโก้กดปุ่มเดียวเข้าได้" |
| 2026-05-25 | "มีแต่โครง ยังไม่มีระบบบริหาร ให้ระดมเอไอรีบทำเลย" |
| 2026-05-25 | "ทำระบบกระทรวงและกรมให้มีทุกจังหวัด แต่กดได้ 3 จังหวัด ที่เหลือสีเทา" |
| 2026-05-25 | **🔒 IRON RULE #1**: "ทำระบบที่ใช้การได้จริง ไม่เอาหน้ากากหรือ Demo" |
