# G2G Gov Platform — Session Memory Update
**Date**: 2026-05-25
**Session**: เพิ่มจังหวัดเชียงราย + อุดรธานี + Refactor เป็น Province Template
**Status**: ✅ COMPLETE (รอ test live + commit)

---

## What's NEW (added this session)

### 1. Province Template System (Data-Driven)
```
public/province-template.html    — Template page (25.4 KB)
public/province-data/
  ├── phrae.json      (4 KB)     — แพร่ (Phase 1 — existing data)
  ├── chiangrai.json  (11.4 KB)  — เชียงราย (NEW) ลำไย 94,671 ตัน/ปี + กาแฟ Top1 ของไทย
  └── udonthani.json  (12.8 KB)  — อุดรธานี (NEW) อ้อย 6.17M ตัน + โคขุน + ผ้าหมี่ขิด GI

public/chiangrai.html   — Wrapper page (redirects to template)
public/udonthani.html   — Wrapper page (redirects to template)
public/phrae.html       — UNCHANGED (production, 1753 lines, full feature)
```

### 2. Ministry of Agriculture Module
```
ministry_modules/agriculture.json     — Source of truth (9.5 KB)
public/ministry-data/agriculture.json — Browser-fetchable copy
public/ministry-agriculture.html      — Ministry overview dashboard (17.8 KB)
```

Contains: 16 departments, 8 policy priorities 2568, 10 KPIs, 4-phase rollout plan to 76 provinces.

---

## Province Data Details

### เชียงราย (CHIANGRAI / 57)
- 18 อำเภอ, 124 ตำบล, 1,751 หมู่บ้าน
- เกษตรกร 230,000 ครัวเรือน, พื้นที่ 4.25M ไร่
- Top crops (12 ชนิด):
  - **ลำไย** Rank 1 (94,671 ตัน/ปี +11% YoY — แม่สรวย 30,120 ไร่, ป่าแดด 70%)
  - **กาแฟอราบิก้า** Rank 2 (อันดับ 1 ของไทย — 60% Arabica แห่งชาติ, ดอยช้าง+ดอยตุง GI)
  - ข้าวนาปี 1.24M ไร่, ข้าวนาปรัง 365K ไร่
  - ชา ดอยแม่สลอง, ลิ้นจี่, สับปะรดภูแล+นางแล GI, ส้มสายน้ำผึ้ง
- 12 หน่วยงาน กษ. (KST-57-001..012) + เพิ่ม ศูนย์วิจัยข้าวเชียงราย + กยท.เชียงราย
- 8 โครงการสำคัญ

### อุดรธานี (UDONTHANI / 41)
- 20 อำเภอ, 156 ตำบล, 1,843 หมู่บ้าน
- เกษตรกร 285,000 ครัวเรือน, พื้นที่ 4.87M ไร่
- Strategic position: ประตูสู่ลาว-เวียดนาม-จีนตอนใต้ (R12)
- Top crops/livestock (13 ชนิด):
  - **ข้าวนาปี** Rank 1 (2M ไร่ ผลผลิต 707,989 ตัน)
  - **อ้อยโรงงาน** Rank 2 (648K ไร่ ผลผลิต 6.17M ตัน +4.5% YoY — Bio-Sugar Hub)
  - **ยางพารา** Rank 3 (575K ไร่, 134K ตัน — กยท.)
  - มันสำปะหลัง, **มะม่วงน้ำดอกไม้สีทอง หนองวัวซอ** (ส่งออกญี่ปุ่น/เกาหลี)
  - โคขุน 380K ตัว ('Udon Beef Premium' ส่งเวียดนาม-จีน)
  - **ผ้าหมี่ขิดบ้านนาข่า GI** + พืชสมุนไพร
- 13 หน่วยงาน กษ. (KST-41-001..013) + เพิ่มศูนย์หม่อนไหม

---

## Files Created (this session)

| Path | Type | Size | Purpose |
|------|------|------|---------|
| `public/province-template.html` | HTML | 25.4 KB | Reusable province dashboard |
| `public/chiangrai.html` | HTML | 938 B | Redirect to template?p=chiangrai |
| `public/udonthani.html` | HTML | 938 B | Redirect to template?p=udonthani |
| `public/province-data/phrae.json` | JSON | 4 KB | Phrae data (extracted) |
| `public/province-data/chiangrai.json` | JSON | 11.4 KB | Chiang Rai data (researched) |
| `public/province-data/udonthani.json` | JSON | 12.8 KB | Udon Thani data (researched) |
| `ministry_modules/agriculture.json` | JSON | 9.5 KB | Ministry source of truth |
| `public/ministry-data/agriculture.json` | JSON | 9.5 KB | Browser-fetchable copy |
| `public/ministry-agriculture.html` | HTML | 17.8 KB | Ministry-level dashboard |

---

## Key Design Decisions

1. **Did NOT modify phrae.html** — too risky to touch 1753-line production file
2. **Template uses URL param** `?p=phrae|chiangrai|udonthani` — clean DRY pattern
3. **Wrapper pages (chiangrai.html, udonthani.html)** = 1-line redirects + meta refresh fallback
4. **Province data in /public/province-data/** for static serving (no backend changes needed)
5. **Ministry data in 2 places**: `ministry_modules/` (server source) + `public/ministry-data/` (browser-fetch)
6. **Iron Rules respected**:
   - ไม่มี ธ.ก.ส./พช. ในโครงสร้างกรม (marked as ⚠️ state enterprise)
   - Citizen ID 13 หลัก = Universal Key
   - Province-First: แพร่ → 76 จว.

---

## Live URLs (after deploy)
```
https://g2g-ai-pool.fly.dev/phrae.html              — Phrae (existing full feature)
https://g2g-ai-pool.fly.dev/chiangrai.html          — Chiang Rai (new)
https://g2g-ai-pool.fly.dev/udonthani.html          — Udon Thani (new)
https://g2g-ai-pool.fly.dev/province-template.html?p=phrae       — Template view of Phrae
https://g2g-ai-pool.fly.dev/province-template.html?p=chiangrai   — Template view of Chiang Rai
https://g2g-ai-pool.fly.dev/province-template.html?p=udonthani   — Template view of Udon Thani
https://g2g-ai-pool.fly.dev/ministry-agriculture.html — Ministry of Agriculture overview
```

---

## To Deploy
```bash
cd /Users/maew/Desktop/g2g-ai-pool && fly deploy --app g2g-ai-pool
```
No server.js changes needed — all new files are static under `public/`.

---

## Validation Status
- ✅ All 4 JSON files parse correctly (Python json.load)
- ✅ All HTML files have balanced brackets in embedded JS
- ✅ Node `--check` passes on extracted JavaScript
- ⏳ Live browser test pending (after deploy)
- ⏳ Cross-province navigation flow test pending

---

## What's Next 🔄

### Immediate (post-deploy)
1. CEO test: open all 3 province pages + ministry-agriculture page
2. Verify mobile responsive
3. Check data quality, especially Chiang Rai crops (per CEO feedback on ลำไย)

### Future Sessions
- **Add Airtable tables** for chiangrai + udonthani (same 5-table pattern as Phrae)
  - Personnel_GSA_CRI, Budget_FY2568_CRI, etc.
  - Personnel_GSA_UD, Budget_FY2568_UD, etc.
- **Add server.js routes** for `/api/chiangrai/*` and `/api/udonthani/*` (clone phrae routes)
- **Phase 3 provinces**: เชียงใหม่, ขอนแก่น, นครราชสีมา, พิษณุโลก
- **Ministry expansion**: มท. (Local Admin), สธ. (Public Health), ศธ. (Education)

---

## Data Sources Used (this session)
- สำนักงานเกษตรและสหกรณ์จังหวัดเชียงราย (opsmoac.go.th/chiangrai-home)
- สำนักงานเกษตรและสหกรณ์จังหวัดอุดรธานี (opsmoac.go.th/udonthani-home)
- สศก. เขต 3 (zone3.oae.go.th) — สินค้าเกษตรอุดร
- พาณิชย์จังหวัดเชียงราย — สถานการณ์ลำไย 2567
- ChiangRai Times — Specialty Coffee article 2568
- พ.ร.บ.ปรับปรุงกระทรวง ทบวง กรม พ.ศ.2545

