# G2G AgriTech — Airtable Schema (Farmer Management System)

> **Base name:** `G2G AgriTech`
> **Version:** v1.1 (2026-05-26) — 3-Tier Market Chain Update
> **Purpose:** Backend for `farmer-tracker.html` + `production-dashboard.html` + `crop-calendar-v2.html` + LINE bot `@phrae555`
> **Region:** Thai farmers nationwide, 12 crops, 5 regions, 76 provinces
>
> **v1.1 critical fix:** ห่วงโซ่ตลาดถูกแบ่งเป็น 3 ระดับตามความจริง — เกษตรกร → ล้ง/สหกรณ์ → ห้าง/ส่งออก/แปรรูป
> - `tbl_buyers.tier` field แยก broker (ขายให้เกษตรกรตรง) จาก retailer/exporter/processor (ซื้อจากล้งต่อ)
> - `tbl_market_chain_snapshot` ตารางใหม่ track ราคา 3 tiers + คำนวณ realized farmer share %
> - ทุก crop JSON มี `market_chain` block + market_signal แสดง 3 ราคา

---

## Table Index

| # | Table Name | Purpose | Rows expected |
|---|------------|---------|---------------|
| 1 | `tbl_farmers` | Master registry of farmers from LINE OA registration | 5,000-20,000 |
| 2 | `tbl_plots` | Each farmer's plot(s) — 1 farmer can own multiple plots | 8,000-40,000 |
| 3 | `tbl_plot_activities` | Activity log written by LINE bot when farmer posts | 100,000+/year |
| 4 | `tbl_crop_calendar` | Reference table — same content as `/crop-data/*.json` | 12 crops × 52 weeks = 624 |
| 5 | `tbl_buyers` | Buyer / off-taker registry (3-tier: broker / retailer / exporter / processor) | 200-2,000 |
| 5b | `tbl_market_chain_snapshot` ⭐ NEW | Time-series ราคา 3 tiers + margin tracking | 12 พืช × 52 สัปดาห์ × 5 ภูมิภาค = 3,120 |
| 6 | `tbl_production_estimate` | Per-plot per-month yield estimates from farmer + AI | 8,000+ rows × 12 months |
| 7 | `tbl_matches` | Pre-computed farmer × broker (Tier 1) match suggestions | 5,000+/active season |

---

## 1. `tbl_farmers`

Source of truth for farmer identity. Populated by Agent #2 (เจ้าหน้าที่ทะเบียน) from LINE OA messages.

| Field | Type | Notes / Formula | Sample |
|-------|------|------------------|--------|
| `farmer_id` | Autonumber / Primary | Auto, format `F-{YYYY}-{NNNN}` | `F-2026-0427` |
| `name_th` | Single line text | ชื่อ-นามสกุล ภาษาไทย | `นายธีระ ดวงดี` |
| `name_en` | Single line text | optional, romanized | `Theera Duangdee` |
| `line_user_id` | Single line text | LINE userId from webhook | `U1234abcd...` (33 chars) |
| `phone` | Phone number | format `0XXXXXXXXX` | `0812345678` |
| `province` | Single select | dropdown 76 provinces | `จันทบุรี` |
| `district` | Single line text | อำเภอ | `เมืองจันทบุรี` |
| `subdistrict` | Single line text | ตำบล | `วัดใหม่` |
| `address` | Long text | บ้านเลขที่ + รายละเอียด | `123/45 ม.5` |
| `gps_lat` | Number (decimal) | optional, from LIFF pinpoint | `12.6113` |
| `gps_lng` | Number (decimal) | optional | `102.1037` |
| `id_card_hash` | Single line text | SHA256 hash ของเลขบัตร (PDPA) | `a1b2c3...` |
| `registered_date` | Date | วันที่ลงทะเบียน | `2025-04-12` |
| `status` | Single select | `active` / `inactive` / `pending` | `active` |
| `total_plots` | Count (lookup) | rollup `tbl_plots` | `3` |
| `total_rai` | Rollup (lookup) | sum `tbl_plots.rai` | `47.5` |
| `lifetime_revenue` | Rollup | sum `tbl_plot_activities.revenue_thb` | `1,250,000` |
| `last_activity` | Last modified | rollup max `tbl_plot_activities.timestamp` | `2026-05-25 16:30` |
| `agent_notes` | Long text | บันทึก agent (Agent #5 ที่ปรึกษา) | `เกษตรกรรายใหม่ ต้องการความช่วยเหลือเรื่อง...` |

**Sample row:**
```
farmer_id: F-2026-0427
name_th: นายธีระ ดวงดี
line_user_id: Uabcdef1234567890abcdef1234567890
phone: 0812345678
province: จันทบุรี
district: เมืองจันทบุรี
status: active
total_plots: 3
total_rai: 47.5
```

---

## 2. `tbl_plots`

One row per plot. A farmer can own multiple plots for the same or different crops.

| Field | Type | Notes | Sample |
|-------|------|-------|--------|
| `plot_id` | Autonumber / Primary | `P-{farmer_id}-{NN}` | `P-F-2026-0427-01` |
| `farmer` | Link to `tbl_farmers` | required | → `F-2026-0427` |
| `plot_name` | Single line text | ชื่อแปลงที่เกษตรกรเรียก | `แปลงทุเรียนหลังบ้าน` |
| `crop` | Link to `tbl_crop_calendar` | crop_id reference | `durian` |
| `crop_th` | Lookup | from crop calendar | `ทุเรียน` |
| `variety` | Single line text | พันธุ์ | `หมอนทอง` |
| `rai` | Number (decimal) | ไร่ | `12.5` |
| `tree_count` | Number (integer) | จำนวนต้น (สำหรับไม้ผล) | `180` |
| `tree_age_yr` | Number (integer) | อายุต้น (ปี) | `8` |
| `province` | Lookup | from farmer | `จันทบุรี` |
| `gps_lat` | Number | จุดศูนย์กลางแปลง | `12.6125` |
| `gps_lng` | Number | | `102.1040` |
| `planted_date` | Date | วันปลูก | `2018-05-10` |
| `irrigation_type` | Single select | `น้ำหยด` / `สปริงเกอร์` / `ฝน` / `อื่นๆ` | `สปริงเกอร์` |
| `soil_type` | Single select | `ดินร่วน` / `ดินเหนียว` / `ดินทราย` | `ดินร่วน` |
| `status` | Single select | `active` / `inactive` / `harvest_done` | `active` |
| `last_activity` | Rollup | max timestamp from activities | `2026-05-24` |
| `total_activities` | Count | rollup `tbl_plot_activities` | `47` |
| `est_annual_yield_kg` | Number | คาดการณ์ผลผลิต/ปี | `28,000` |

**Sample row:**
```
plot_id: P-F-2026-0427-01
farmer: F-2026-0427 (นายธีระ ดวงดี)
plot_name: แปลงทุเรียนหลังบ้าน
crop: durian
variety: หมอนทอง
rai: 12.5
tree_count: 180
tree_age_yr: 8
province: จันทบุรี
est_annual_yield_kg: 28,000
```

---

## 3. `tbl_plot_activities`

The high-volume table. Each LINE message from farmer that contains an activity → 1 row here.

| Field | Type | Notes | Sample |
|-------|------|-------|--------|
| `activity_id` | Autonumber / Primary | `A-{YYYYMMDD}-{NNNNNN}` | `A-20260524-001234` |
| `plot` | Link to `tbl_plots` | required | → `P-F-2026-0427-01` |
| `farmer` | Lookup (from plot) | denormalized for filter speed | `นายธีระ ดวงดี` |
| `crop` | Lookup (from plot) | | `ทุเรียน` |
| `province` | Lookup (from plot) | | `จันทบุรี` |
| `timestamp` | Date+time | when LINE message was received | `2026-05-24 16:32` |
| `activity_type` | Single select | `ใส่ปุ๋ย` / `ฉีดยา` / `เก็บเกี่ยว` / `รดน้ำ` / `ตัดแต่ง` / `ปลูก` / `อื่นๆ` | `ใส่ปุ๋ย` |
| `activity_detail` | Long text | สิ่งที่ทำเฉพาะ | `ใส่ปุ๋ย 15-15-15 อัตรา 2 กก./ต้น` |
| `raw_message` | Long text | ข้อความดิบจาก LINE | `ใส่ปุ๋ย 16-16-16 ในแปลง 2 จำนวน 100 กก.` |
| `quantity` | Number | จำนวน (ปุ๋ย กก., ผลผลิต กก., ยา ลิตร) | `100` |
| `unit` | Single select | `กก.` / `ลิตร` / `ผล` / `ต้น` / `ไร่` | `กก.` |
| `product_used` | Single line text | สูตรปุ๋ย / ยี่ห้อยา | `15-15-15` |
| `cost_thb` | Currency THB | ค่าใช้จ่ายในการทำกิจกรรม | `4,500` |
| `revenue_thb` | Currency THB | รายได้ (เฉพาะ activity_type = เก็บเกี่ยว) | `0` |
| `week_iso` | Formula | `WEEKNUM(timestamp, 21)` (ISO week) | `21` |
| `expected_phase` | Lookup | from `tbl_crop_calendar[crop, week_iso].phase` | `harvest` |
| `expected_tasks` | Lookup | from `tbl_crop_calendar[crop, week_iso].tasks` | `["เก็บเกี่ยว Peak", ...]` |
| `on_schedule` | Formula | match activity_type with expected_phase mapping | `ตรง` / `ช้า` / `เร็ว` |
| `image_url` | Attachment | optional photo from LINE | `(image)` |
| `agent_review_status` | Single select | `auto-approved` / `flagged` / `reviewed` | `auto-approved` |
| `agent_notes` | Long text | optional human note | - |

**`on_schedule` formula (pseudo):**
```
IF(
  activity_type IN MAPPING[expected_phase],
  "ตรง",
  IF(
    timestamp.week_iso < earliest_week_for_activity_type,
    "เร็ว",
    "ช้า"
  )
)
```

**Sample row:**
```
activity_id: A-20260524-001234
plot: P-F-2026-0427-01 (แปลงทุเรียนหลังบ้าน)
farmer: นายธีระ ดวงดี
crop: ทุเรียน
province: จันทบุรี
timestamp: 2026-05-24 16:32
activity_type: เก็บเกี่ยว
activity_detail: เก็บทุเรียนหมอนทองคัด AA 250 กก.
raw_message: เก็บทุเรียนหมอนทอง 250 กก. ในแปลง 1
quantity: 250
unit: กก.
revenue_thb: 45,000
week_iso: 21
expected_phase: harvest
on_schedule: ตรง
```

---

## 4. `tbl_crop_calendar`

Mirrors `/public/crop-data/*.json`. One row per (crop × week). 12 × 52 = 624 rows.

| Field | Type | Notes | Sample |
|-------|------|-------|--------|
| `cw_id` | Formula | `{crop_id}-W{week}` | `durian-W25` |
| `crop_id` | Single line text | foreign key to crop registry | `durian` |
| `crop_th` | Single line text | | `ทุเรียน` |
| `week` | Number (1-52) | | `25` |
| `phase` | Single select | preparation / flowering / fruiting / harvest / recovery / seeding / tillering / grain_fill / fallow / planting / growth / tuber_dev / tapping / wintering / fertilizing / leaf_renewal / ripening / pest_control | `harvest` |
| `tasks` | Long text (JSON array) | งาน 3-5 ข้อ | `["เก็บเกี่ยว Peak", "คัด AA", "ขายล้ง"]` |
| `watch` | Long text (JSON array) | โรค/แมลงที่ระวัง | `["ผลร่วง", "แมลงวันผลไม้"]` |
| `alerts` | Long text (JSON array) | weather/special alerts | `["ฝนหลงฤดู"]` |
| `market_signal` | Long text | สัญญาณตลาด รายสัปดาห์ | `พีคของพีค ราคา 160-200 บาท/กก.` |
| `advice` | Long text | คำแนะนำ G2G | `ต่อรองราคากับล้ง 2-3 รายเทียบ` |
| `is_peak_harvest` | Checkbox | week ∈ harvest_peak_weeks | `true` |
| `last_updated` | Last modified | | `2026-05-26` |

---

## 5. `tbl_buyers` (3-Tier Market Chain)

Buyer / off-taker registry. **v1.1 update**: ผู้ซื้อแบ่งเป็น 3 ระดับตามห่วงโซ่ตลาดจริง — เกษตรกรขายตรงให้ Tier 1 (broker) เท่านั้น, Tier 2 (retailer/exporter/processor) รับซื้อจากล้งอีกทอด

| Field | Type | Notes | Sample |
|-------|------|-------|--------|
| `buyer_id` | Autonumber / Primary | `B-{NNNN}` | `BR-001` |
| `tier` ⭐ NEW | Single select | `broker` / `retailer` / `exporter` / `processor` — กำหนดว่าเกษตรกรขายให้ได้ตรง (broker) หรือไม่ | `broker` |
| `name_th` | Single line text | | `บริษัทล้งทุเรียนจันทบุรี จำกัด` |
| `name_en` | Single line text | optional | `Chanthaburi Durian Trading Co.,Ltd` |
| `buyer_subtype` | Single select | `ล้ง` / `สหกรณ์` / `ลานมัน` / `รัฐวิสาหกิจ` / `ห้างค้าปลีก` / `ห้างค้าส่ง` / `ค้าปลีกสะดวกซื้อ` / `ผู้ส่งออก` / `โรงงานแปรรูป` / `โรงงานน้ำตาล` / `โรงแป้งมัน` / `โรงงานยาง` | `ล้ง` |
| `crops_interested` | Multiple select | จากรายการ 12 พืช | `ทุเรียน`, `มังคุด` |
| `min_volume_kg` | Number | ปริมาณขั้นต่ำต่อรอบ | `5,000` |
| `max_volume_kg` | Number | ความสามารถสูงสุด | `50,000` |
| `price_range_thb` | Single line text | ราคาที่รับซื้อ (broker = farmgate · retailer/exporter = wholesale) | `150-180 บาท/กก. (เกรด AA)` |
| `payment_terms` | Single select | `ทันที` / `7 วัน` / `14 วัน` / `30 วัน` / `30 วัน LC` / `60 วัน` | `ทันที` |
| `quality_grades_accepted` | Multiple select | AAA / AA / A / B / C / Premium / มาตรฐาน | `AAA`, `AA`, `A` |
| `sells_to` ⭐ NEW | Link to `tbl_buyers` (multi) | **broker only** — ห้าง/ผู้ส่งออก/แปรรูปที่ broker นี้ขายต่อให้ (downstream) | `RT001, EX001, PC001` |
| `buys_from` ⭐ NEW | Link to `tbl_buyers` (multi) | **retailer/exporter/processor only** — ล้ง/สหกรณ์ที่ป้อนวัตถุดิบ (upstream) | `BR001, BR002` |
| `contact_person` | Single line text | | `คุณสมศักดิ์ ก้าวล้ำ` |
| `phone` | Phone | | `0817778888` |
| `line_id` | Single line text | | `@chantra_durian` |
| `province_pickup` | Single select | | `จันทบุรี` |
| `province_delivery` | Multiple select | จังหวัดที่ครอบคลุม / ตลาดส่งออก | `จันทบุรี`, `ระยอง`, `จีน` |
| `status` | Single select | `active` / `paused` / `blacklisted` | `active` |
| `rating` | Number (1-5) | rating จากเกษตรกร | `4.8` |
| `total_matches` | Count | rollup `tbl_matches` | `42` |
| `total_revenue_thb` | Rollup | sum confirmed deals | `12,500,000` |

**Validation rules (v1.1):**
1. `tier='broker'` records MUST have `sells_to[]` populated (downstream chain)
2. `tier IN ('retailer','exporter','processor')` records MUST have `buys_from[]` populated (upstream chain)
3. `tbl_matches.buyer` MUST link to a buyer with `tier='broker'` — UI/API rejects matches to Tier 2

---

## 5b. `tbl_market_chain_snapshot` ⭐ NEW (Time-Series Margin Tracking)

Records ราคา 3 tiers ของแต่ละพืชรายสัปดาห์ เพื่อ track margin จริงและคำนวณ "realized farmer share %"

| Field | Type | Notes | Sample |
|-------|------|-------|--------|
| `snap_id` | Formula | `{crop_id}-{YYYY-Www}-{region}` | `durian-2026-W25-east` |
| `crop_id` | Link to `tbl_crop_calendar` | crop_id reference | `durian` |
| `year` | Number | | `2026` |
| `week_iso` | Number (1-52) | | `25` |
| `region` | Single select | `เหนือ` / `อีสาน` / `กลาง` / `ตะวันออก` / `ใต้` / `ทั่วประเทศ` | `ตะวันออก` |
| `farmgate_min_thb` | Number (decimal) | ราคาหน้าสวน (ขั้นต่ำ) บาท/กก. | `85.00` |
| `farmgate_max_thb` | Number (decimal) | ราคาหน้าสวน (สูงสุด) | `110.00` |
| `wholesale_min_thb` | Number (decimal) | ราคาขายส่งล้ง บาท/กก. | `110.00` |
| `wholesale_max_thb` | Number (decimal) | ราคาขายส่งล้ง | `140.00` |
| `retail_min_thb` | Number (decimal) | ราคาขายปลีก ตลาดสด/ห้าง | `160.00` |
| `retail_max_thb` | Number (decimal) | ราคาขายปลีก | `200.00` |
| `broker_margin_pct` | Formula | `(wholesale_avg - farmgate_avg) / retail_avg * 100` | `26.4` |
| `retailer_margin_pct` | Formula | `(retail_avg - wholesale_avg) / retail_avg * 100` | `25.8` |
| `farmer_share_pct` | Formula | `farmgate_avg / retail_avg * 100` | `47.8` |
| `source` | Single select | `oae` / `doae` / `internal_broker_survey` / `farmer_self` / `perplexity` | `oae` |
| `source_url` | URL | URL ของแหล่งข้อมูล | `https://www.oae.go.th/...` |
| `snapshot_date` | Date | วันที่บันทึก | `2026-06-22` |
| `notes` | Long text | บันทึก agent | `พีคของพีค พ.ค.-มิ.ย.` |

**Sample SQL/Airtable formula for `farmer_share_pct`:**
```
((farmgate_min_thb + farmgate_max_thb) / 2) /
((retail_min_thb + retail_max_thb) / 2) * 100
```

**Sample query — เกษตรกรในระบบได้ส่วนแบ่งเท่าไหร่ของราคาขายปลีก (เฉลี่ยทั้งปี):**
```sql
SELECT
  crop_id,
  AVG(farmer_share_pct) AS avg_farmer_share,
  AVG(broker_margin_pct) AS avg_broker_margin,
  AVG(retailer_margin_pct) AS avg_retailer_margin,
  COUNT(*) AS snapshots
FROM tbl_market_chain_snapshot
WHERE year = 2026
GROUP BY crop_id
ORDER BY avg_farmer_share DESC;
```

**Airtable formula — KPI "ราคาเป้าหมายหน้าสวน" (เป้าให้เกษตรได้ >=50% ของราคาปลีก):**
```
IF(
  farmer_share_pct >= 50,
  "🟢 เป็นธรรม",
  IF(farmer_share_pct >= 40, "🟡 ปานกลาง", "🔴 ถูกกดราคา")
)
```

---

## 6. `tbl_production_estimate`

Per-plot per-month yield estimate. Used by `production-dashboard.html`.

| Field | Type | Notes | Sample |
|-------|------|-------|--------|
| `est_id` | Formula | `{plot_id}-{YYYY-MM}` | `P-F-2026-0427-01-2026-06` |
| `plot` | Link to `tbl_plots` | | → `P-F-2026-0427-01` |
| `farmer` | Lookup | | `นายธีระ ดวงดี` |
| `crop` | Lookup | | `ทุเรียน` |
| `province` | Lookup | | `จันทบุรี` |
| `region` | Lookup | คำนวณจาก province | `ตะวันออก` |
| `year` | Number | | `2026` |
| `month` | Number (1-12) | | `6` |
| `est_kg` | Number | ประมาณการ กก. | `8,500` |
| `est_grade_aa_kg` | Number | | `3,000` |
| `est_grade_a_kg` | Number | | `3,500` |
| `est_grade_b_kg` | Number | | `1,500` |
| `est_grade_c_kg` | Number | | `500` |
| `est_avg_price_thb` | Currency | ราคาคาดการณ์ ต่อ กก. | `165` |
| `est_revenue_thb` | Formula | `est_kg * est_avg_price_thb` | `1,402,500` |
| `confidence` | Single select | `high` / `medium` / `low` | `high` |
| `source` | Single select | `farmer_self` / `ai_model` / `agent_analyst` | `ai_model` |
| `last_updated` | Last modified | | `2026-05-26` |

---

## 7. `tbl_matches`

Pre-computed matching suggestions: farmer × buyer × estimated harvest week.

| Field | Type | Notes | Sample |
|-------|------|-------|--------|
| `match_id` | Autonumber / Primary | `M-{NNNNNN}` | `M-001234` |
| `plot` | Link to `tbl_plots` | | → `P-F-2026-0427-01` |
| `farmer` | Lookup | | `นายธีระ ดวงดี` |
| `buyer` | Link to `tbl_buyers` | | → `B-0001` |
| `crop` | Lookup | | `ทุเรียน` |
| `grade` | Single select | AAA / AA / A / B / C | `AA` |
| `volume_kg` | Number | | `3,500` |
| `harvest_week` | Single line text | | `W25-26` |
| `harvest_year` | Number | | `2026` |
| `match_score` | Formula | 0-100, weighted sum (crop 40% + grade 25% + volume 20% + week proximity 15%) | `97` |
| `match_breakdown` | Long text JSON | `{"crop":40,"grade":25,"volume":18,"week":14}` | (json) |
| `status` | Single select | `suggested` / `accepted` / `contract_signed` / `delivered` / `rejected` | `suggested` |
| `suggested_date` | Date | | `2026-05-26` |
| `responded_date` | Date | when farmer or buyer responded | - |
| `contract_id` | Single line text | external doc ID | - |
| `agent_notes` | Long text | | - |

**Match score formula (pseudo):**
```javascript
score = (
  (crop_match * 40) +              // 0 or 40
  (grade_match * 25) +              // 0-25 (exact = 25, within range = 15)
  (volume_fit * 20) +               // 0-20 (sweet spot)
  (week_proximity * 15)             // 0-15 (current week to harvest)
)
```

---

## Permissions / Access Control

### LINE Bot Writer (Make.com / Apps Script)
- `tbl_farmers` — INSERT (new registration) + UPDATE last_activity
- `tbl_plots` — INSERT + UPDATE last_activity
- `tbl_plot_activities` — INSERT only (append-only log)
- Other tables — READ only

### Admin Dashboard (HTML pages)
- All tables — READ via API endpoints
- `tbl_farmers`, `tbl_plots`, `tbl_buyers`, `tbl_matches` — UPDATE via admin auth (`x-api-key: phrae2026`)

### Agent (Claude in Make.com)
- All tables — READ + UPDATE
- For `tbl_plot_activities` — only UPDATE `agent_review_status` + `agent_notes`

### CEO View
- All tables — READ
- Audit log for any UPDATE

---

## API Endpoint Mapping

| Endpoint | Method | Table | Notes |
|----------|--------|-------|-------|
| `/api/farmer/register` | POST | `tbl_farmers` INSERT | Agent #2 extraction |
| `/api/farmer/plot/new` | POST | `tbl_plots` INSERT | |
| `/api/farmer/activities` | GET | `tbl_plot_activities` SELECT | `?limit=50&province=X&crop=Y` |
| `/api/farmer/activities` | POST | `tbl_plot_activities` INSERT | LINE webhook |
| `/api/farmer/production` | GET | `tbl_production_estimate` rollup | Used by dashboard |
| `/api/farmer/matching` | POST | `tbl_matches` SELECT | **v1.1**: restricted to `tier='broker'` · returns downstream chain |
| `/api/farmer/buyers` | GET | `tbl_buyers` SELECT | **v1.1**: supports `?tier=broker|retailer|exporter|processor` |
| `/api/farmer/market-chain/:crop` ⭐ NEW | GET | `tbl_buyers` + crop JSON | full 3-tier chain for a crop · margin + members |
| `/api/farmer/broadcast` | POST | reads `tbl_crop_calendar` | LINE broadcast week tasks |
| `/api/crops/list` | GET | `tbl_crop_calendar` distinct | 12 crops |
| `/api/crops/{id}` | GET | `tbl_crop_calendar` filtered | full 52 weeks |

---

## Data Quality Rules (Validation)

1. **Farmer registration** — phone unique within `tbl_farmers`
2. **Plot must link to existing farmer** — referential integrity
3. **`activity.crop` must match `plot.crop`** — sanity check
4. **`on_schedule` flag** — re-calculated weekly via scheduled job
5. **Match score** — recalculated nightly + when buyer/plot updates
6. **Production estimate** — refreshed monthly from farmer self-reports + AI projection (DOAE statistics + weather)

---

## Migration Notes (from existing JSON)

The 12 JSON files in `/public/crop-data/` are the **canonical source** for `tbl_crop_calendar`.
Run import script monthly:
```bash
node scripts/sync-crop-calendar.js
# reads /public/crop-data/*.json → upserts into Airtable tbl_crop_calendar
```

---

**End of schema doc** · v1.0 · 2026-05-26
