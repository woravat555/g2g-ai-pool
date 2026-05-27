# G2G Province-First Ministry Expansion Template
**Pattern**: กษ. (Phase 1 ✅) → มท./ท้องถิ่น (Phase 2) → สธ. (Phase 3) → ศธ. (Phase 4)

---

## IRON RULES (Copy to every session)

1. ห้ามใส่ ธ.ก.ส. หรือ พช. เข้าโครงสร้าง กษ.
2. จ้างเหมาบริการ = หมวดค่าใช้สอย ของงบดำเนินงาน เสมอ
3. Citizen ID 13 หลัก = Universal Key ทุกกระทรวง
4. Province-First: แพร่ → 76 จว. → ชาติ → นานาชาติ
5. API Route: `/api/{province_code}/{ministry}/*` เสมอ
6. `AIRTABLE_BASE = app6keeRcHmiTMLKy` [NEVER CHANGE — MAIN BASE]
7. `PHRAE_BASE = appXQC4uFhjeBpC7T` [NEVER CHANGE — PROVINCE BASE]
8. `PHRAE_API_KEY = phrae2026`

---

## กษ. Module (Phase 1) — COMPLETED ✅

### Live URLs
- Platform: https://g2g-ai-pool.fly.dev/phrae.html
- Management: https://g2g-ai-pool.fly.dev/management.html
- Personnel Registry: https://g2g-ai-pool.fly.dev/personnel-registry.html

### Airtable Tables (PHRAE_BASE = appXQC4uFhjeBpC7T)

| Table | ID | Records | Purpose |
|-------|----|---------|---------|
| Personnel_GSA | tblyx5cH135PfTAfZ | 9 | หัวหน้าหน่วยงาน กษ. ทุกกรม |
| Budget_FY2568 | tblK5sEQcZBIm3ejr | 9 | งบประมาณปี 2568 รายหน่วยงาน |
| Projects_2568 | tbl1NgjLDz4vmhUNt | 8 | โครงการปี 2568 |
| Contracts_GSA | tblIkZp58vhCA6Ehw | 7 | สัญญาจ้างเหมาบริการ |
| Integration_Plans | tbldZ0eyLBFdPbZMQ | 4 | แผนบูรณาการ |

### Agency Codes (KST-54-xxx = กษ. แพร่)

| Code | หน่วยงาน | กรม |
|------|---------|-----|
| KST-54-001 | สำนักงานเกษตรจังหวัดแพร่ | กรมส่งเสริมการเกษตร |
| KST-54-002 | สำนักงานปศุสัตว์จังหวัดแพร่ | กรมปศุสัตว์ |
| KST-54-003 | สำนักงานประมงจังหวัดแพร่ | กรมประมง |
| KST-54-004 | การยางแห่งประเทศไทย จ.แพร่ | กยท. |
| KST-54-005 | ศูนย์วิจัยข้าวแพร่ | กรมการข้าว |
| KST-54-006 | สำนักงานสหกรณ์จังหวัดแพร่ | กรมส่งเสริมสหกรณ์ |
| KST-54-007 | สำนักงานตรวจบัญชีสหกรณ์แพร่ | กรมตรวจบัญชีสหกรณ์ |
| KST-54-008 | สำนักงาน ส.ป.ก.จังหวัดแพร่ | สำนักงานการปฏิรูปที่ดิน |
| KST-54-009 | สสก.ที่ 6 จ.เชียงใหม่ | กรมส่งเสริมการเกษตร (เขต) |

### API Routes (server.js)
```
GET  /api/phrae/management/summary
GET  /api/phrae/management/personnel
POST /api/phrae/management/personnel
GET  /api/phrae/management/budget
GET  /api/phrae/management/projects
POST /api/phrae/management/projects
GET  /api/phrae/management/contracts
POST /api/phrae/management/contracts
GET  /api/phrae/management/integration
POST /api/phrae/management/integration
PUT  /api/phrae/management/projects/:id/progress
```

### Static Data Fallback (Critical Pattern)
- File: `public/management-data.json`
- Used when: Fly.io `AIRTABLE_TOKEN` lacks PHRAE_BASE scope
- Pattern: Each GET route tries Airtable, catches any error, falls back to JSON
- **To enable live Airtable sync**: `fly secrets set AIRTABLE_TOKEN=<token-with-PHRAE_BASE-scope>`

### Budget Field Names (Frontend ↔ API)
```javascript
// API returns / Frontend reads:
personnel_budget  // งบบุคลากร
operating_budget  // งบดำเนินงาน (จ้างเหมา อยู่นี่!)
capital_budget    // งบลงทุน
subsidy_budget    // งบเงินอุดหนุน
other_budget      // งบรายจ่ายอื่น
budget_total      // รวมทั้งหมด
disbursed_total   // เบิกจ่ายแล้ว
disbursed_pct     // % เบิกจ่าย
```

---

## Expansion Pattern — New Ministry

### Step 1: กำหนด Agency Code Prefix
```
Pattern: {MINISTRY_CODE}{PROVINCE_CODE}-{AGENCY_SEQ}
Example:
  กษ. แพร่  = KST-54-001..009
  มท. แพร่  = MOI-54-001..N   (N = จำนวน อปท. หรือที่ว่าการอำเภอ)
  สธ. แพร่  = MOP-54-001..N
  ศธ. แพร่  = MOE-54-001..N
```

### Step 2: สร้าง Airtable Tables ใน PHRAE_BASE
สร้าง 5 ตารางตาม pattern นี้ (ปรับ field names ตามกระทรวง):

```
{Ministry}Personnel_FY2568  — บุคลากร
{Ministry}Budget_FY2568     — งบประมาณ
{Ministry}Projects_FY2568   — โครงการ
{Ministry}Contracts_FY2568  — จ้างเหมา
{Ministry}Integration_FY2568 — บูรณาการ
```

**Minimum required fields for Personnel table:**
```
full_name        (text)    — ชื่อ-นามสกุล
agency_id        (text)    — รหัสหน่วยงาน เช่น MOI-54-001
agency_name      (text)    — ชื่อหน่วยงาน
dept_name        (text)    — ชื่อกรม/กระทรวง
employee_type    (select)  — ข้าราชการ / พนักงาน / จ้างเหมา
position_title   (text)    — ตำแหน่ง
position_level   (text)    — ระดับ
district         (text)    — อำเภอ
phone            (text)    — โทรศัพท์
citizen_id       (text)    — เลขบัตรประชาชน 13 หลัก ← Universal Key
status           (select)  — ปฏิบัติงาน / ลาออก / โอนย้าย
```

**Minimum required fields for Budget table:**
```
agency_id         (text)   — รหัสหน่วยงาน
agency_name       (text)   — ชื่อหน่วยงาน
dept_name         (text)   — ชื่อกรม
personnel_budget  (number) — งบบุคลากร
operating_budget  (number) — งบดำเนินงาน
capital_budget    (number) — งบลงทุน
subsidy_budget    (number) — งบเงินอุดหนุน
other_budget      (number) — งบรายจ่ายอื่น
budget_total      (number) — รวมทั้งหมด (= sum of above)
disbursed_total   (number) — เบิกจ่ายแล้ว
disbursed_pct     (number) — % เบิกจ่าย
fiscal_year       (text)   — "2568"
```

### Step 3: เพิ่ม Server Routes ใน server.js

```javascript
// ─── {MINISTRY} Management Routes ─────────────────────────
const {MINISTRY}_BASE_TABLES = {
  personnel:   "{Ministry}Personnel_FY2568",
  budget:      "{Ministry}Budget_FY2568",
  projects:    "{Ministry}Projects_FY2568",
  contracts:   "{Ministry}Contracts_FY2568",
  integration: "{Ministry}Integration_FY2568",
};

// GET /api/phrae/{ministry}/summary
app.get("/api/phrae/{ministry}/summary", phraeCors, async (req, res) => {
  // Same pattern as /api/phrae/management/summary
  // Use phraeGet() for Airtable, mgmtStatic('{ministry}') for fallback
});

// ... same pattern for all 5 GET + 5 POST routes
```

### Step 4: สร้าง Static Fallback JSON
```
File: public/{ministry}-data.json
Structure: { "personnel": [...], "budget": [...], "projects": [...], "contracts": [...], "integration": [...] }
```
Seed initial data manually using Airtable MCP (since PHRAE_TOKEN may not have write scope).

### Step 5: Update mgmtStatic() to handle multiple ministries
```javascript
let _STATIC_CACHE = {};
function ministryStatic(ministry, key) {
  if (!_STATIC_CACHE[ministry]) {
    try {
      const _file = join(__dirname, "public", `${ministry}-data.json`);
      _STATIC_CACHE[ministry] = JSON.parse(readFileSync(_file, "utf8"));
    } catch (e) {
      _STATIC_CACHE[ministry] = { personnel: [], budget: [], projects: [], contracts: [], integration: [] };
    }
  }
  return key ? (_STATIC_CACHE[ministry][key] || []) : _STATIC_CACHE[ministry];
}
```

### Step 6: สร้าง Frontend HTML Page
```
public/{ministry}.html     — Main ministry overview page
```
Clone `management.html` structure, adjust:
- Agency codes and names
- Budget categories specific to ministry
- Project types and KPI templates
- Integration partner agencies

### Step 7: Deploy
```bash
cd /Users/maew/Desktop/g2g-ai-pool && fly deploy --app g2g-ai-pool
```

### Step 8: ทดสอบ
```bash
curl https://g2g-ai-pool.fly.dev/api/phrae/{ministry}/summary
curl https://g2g-ai-pool.fly.dev/api/phrae/{ministry}/personnel
curl https://g2g-ai-pool.fly.dev/api/phrae/{ministry}/budget
```

---

## Phase 2: มหาดไทย ท้องถิ่น — Ready to Start

### หน่วยงาน มท. จ.แพร่ที่ต้องครอบคลุม
```
MOI-54-001  ที่ทำการปกครองจังหวัดแพร่
MOI-54-002  เทศบาลเมืองแพร่
MOI-54-003..N  อปท. 84 แห่ง (เทศบาล + อบต.)
MOI-54-101..8  ที่ว่าการอำเภอ 8 อำเภอ
```

**Key difference from กษ.:**
- ท้องถิ่น (อปท.) มีงบประมาณเอง (รายได้ท้องถิ่น + อุดหนุน)
- มีสภาท้องถิ่น (Council) + ฝ่ายบริหาร
- อ้างอิง พ.ร.บ.กระจายอำนาจ 2542 มาตรา 30-35
- ไม่ใช่สายงานราชการส่วนกลาง — เป็นราชการส่วนท้องถิ่น

**Extra tables needed:**
```
LocalAdmin_Revenue     — รายได้ อปท. (ภาษี + อุดหนุน)
LocalAdmin_Council     — สมาชิกสภา อปท.
LocalAdmin_Services    — บริการสาธารณะ (น้ำ ไฟ ถนน)
```

---

## Phase 3: สาธารณสุข (สธ.)

**Agency pattern:**
```
MOP-54-001  สำนักงานสาธารณสุขจังหวัดแพร่ (สสจ.)
MOP-54-002  โรงพยาบาลแพร่ (รพ.แพร่)
MOP-54-003..N  สสอ. 8 อำเภอ
MOP-54-101..N  รพ.สต. ทุกแห่ง
```

**Extra citizen-level data (CitizenID 13 หลัก joins):**
```
HealthRecord    — โรคประจำตัว วัคซีน การตรวจ
Epidemic_Alert  — โรคระบาด ประจำพื้นที่
Maternal_Child  — แม่และเด็ก
```

---

## Phase 4: ศึกษาธิการ (ศธ.)

**Agency pattern:**
```
MOE-54-001  สำนักงานศึกษาธิการจังหวัดแพร่
MOE-54-002  สพป.แพร่ เขต 1
MOE-54-003  สพป.แพร่ เขต 2
MOE-54-101..N  โรงเรียน (ประถม/มัธยม)
```

**CitizenID links:**
- นักเรียน (อายุ < 18) → CitizenID = สิทธิการศึกษา
- ครู → CitizenID = บันทึกวิทยฐานะ

---

## Cross-Ministry Integration Points

### Universal Citizen Link
```sql
-- ทุกกระทรวง JOIN กันผ่าน citizen_id
SELECT * FROM Personnel_GSA    WHERE citizen_id = '{13-digit}'
SELECT * FROM MOP_HealthRecord WHERE citizen_id = '{13-digit}'
SELECT * FROM MOE_StudentRecord WHERE citizen_id = '{13-digit}'
```

### Province-Level Dashboard Query
```javascript
// Summary across all ministries for province governor
const provinceSummary = await Promise.allSettled([
  fetch(`/api/phrae/management/summary`),   // กษ.
  fetch(`/api/phrae/localadmin/summary`),   // มท.
  fetch(`/api/phrae/health/summary`),       // สธ.
  fetch(`/api/phrae/education/summary`),    // ศธ.
]);
```

---

## Deployment Architecture Reference

```
Fly.io App: g2g-ai-pool
├── server.js          — Hono/Express router (ES modules)
├── public/
│   ├── phrae.html          — กษ. main platform
│   ├── management.html     — กษ. 4-dimension management
│   ├── management-data.json — กษ. static cache
│   ├── [ministry].html     — New ministry pages (follow pattern)
│   └── [ministry]-data.json — New ministry static caches
└── phrae-agri/
    ├── ARCHITECTURE-ROADMAP.md
    ├── GOVLAW-FOUNDATION.md
    └── MINISTRY-EXPANSION-TEMPLATE.md ← this file

Secrets (fly secrets):
  AIRTABLE_TOKEN  — Needs scope for ALL bases used
  PHRAE_API_KEY   — phrae2026

Airtable Bases:
  app6keeRcHmiTMLKy  — MAIN BASE (platform config)
  appXQC4uFhjeBpC7T  — PHRAE BASE (province data)
```

---

## Quick Start Checklist — Adding New Ministry

```
□ 1. กำหนด ministry code (e.g., MOI, MOP, MOE)
□ 2. List all agencies with codes (MOI-54-001..N)
□ 3. สร้าง 5 tables ใน PHRAE_BASE ผ่าน Airtable MCP
□ 4. Seed initial personnel data (head of each agency)
□ 5. Seed budget data (งบประมาณปีปัจจุบัน)
□ 6. Export static cache: public/{ministry}-data.json
□ 7. Add 10 API routes ใน server.js (5 GET + 5 POST)
□ 8. Create public/{ministry}-management.html
□ 9. fly deploy --app g2g-ai-pool
□ 10. curl test all endpoints
□ 11. Update gov-admin-platform skill (ministry expansion protocol)
□ 12. Save to [GovAdmin] category memory
```

---

*Template version: 1.0 | Created: 2026-05-24 | Based on กษ. แพร่ Phase 1 implementation*
