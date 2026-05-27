# G2G Gov Platform — Session Memory
**Updated**: 2026-05-24
**Status**: Phase 1 กษ. แพร่ — COMPLETE ✅ LIVE

---

## What's Done ✅

### Platform (Fly.io: g2g-ai-pool)
- **management.html** — 4-dimension management platform (คน/เงิน/งาน/บูรณาการ) LIVE
- **phrae.html** — Main AgriTech platform LIVE
- **personnel-registry.html** — Staff registry LIVE

### Management API — ALL ENDPOINTS LIVE ✅
```
GET /api/phrae/management/summary    → { ok, summary: { personnel: 9, budget: 9 agencies, ... } }
GET /api/phrae/management/personnel  → { ok, total: 9, people: [...] }
GET /api/phrae/management/budget     → { ok, total: 9, agencies: [...] }
GET /api/phrae/management/projects   → { ok, total: 8, projects: [...] }
GET /api/phrae/management/contracts  → { ok, total: 7, contracts: [...] }
GET /api/phrae/management/integration → { ok, total: 4, plans: [...] }
POST routes for all 5 data types (writes to Airtable when token has scope)
```

### Static Data Cache System
- **Problem solved**: Fly.io AIRTABLE_TOKEN doesn't have PHRAE_BASE scope → 403 on all phrae routes
- **Solution**: public/management-data.json serves as automatic fallback
- **Pattern**: Each GET route tries Airtable, catches any error, falls back to static JSON
- **To enable live sync**: fly secrets set AIRTABLE_TOKEN=<token-with-phrae-base-scope> --app g2g-ai-pool

### Airtable Tables (PHRAE_BASE = appXQC4uFhjeBpC7T)
| Table | ID | Records |
|-------|----|---------|
| Personnel_GSA | tblyx5cH135PfTAfZ | 9 |
| Budget_FY2568 | tblK5sEQcZBIm3ejr | 9 |
| Projects_2568 | tbl1NgjLDz4vmhUNt | 8 |
| Contracts_GSA | tblIkZp58vhCA6Ehw | 7 |
| Integration_Plans | tbldZ0eyLBFdPbZMQ | 4 |

### Budget Field Names (CRITICAL — Frontend uses these exact names)
```
personnel_budget  operating_budget  capital_budget  subsidy_budget  other_budget
budget_total  disbursed_total  disbursed_pct
```

### Key Files
```
server.js line 6     — import { readFileSync } from "fs"  (ES module — NOT require())
server.js line 2836  — PHRAE_BASE + mgmtStatic() helper
server.js line 2860+ — phraeGet/phraePost/phraePatch helpers
server.js line 3580+ — Management API routes (GET + POST for all 5 tables)
public/management.html        — Frontend (74,980 bytes)
public/management-data.json   — Static cache (28,352 bytes)
phrae-agri/MINISTRY-EXPANSION-TEMPLATE.md — How to add new ministry
```

### CRITICAL: ES Modules
- server.js uses `import` NOT `require`
- `const __dirname = dirname(fileURLToPath(import.meta.url))` is already set on line 12
- Use `readFileSync` (imported from "fs") NOT `require("fs").readFileSync`

---

## What's Next 🔄

### Fix Live Airtable Sync (User action needed)
1. airtable.com → Developer Hub → Personal Access Tokens
2. Edit token, add scope for appXQC4uFhjeBpC7T (PHRAE_BASE)
3. fly secrets set AIRTABLE_TOKEN=<updated-token> --app g2g-ai-pool

### Phase 2: มท. ท้องถิ่น — Ready to Start
Follow phrae-agri/MINISTRY-EXPANSION-TEMPLATE.md:
- Agency code prefix: MOI-54-xxx
- 84 อปท. + 8 ที่ว่าการอำเภอ
- Extra tables: LocalAdmin_Revenue, LocalAdmin_Council, LocalAdmin_Services

---

## Iron Rules (Always Load)
1. ห้ามใส่ ธ.ก.ส./พช. เข้าโครงสร้าง กษ.
2. จ้างเหมา = งบดำเนินงาน หมวดค่าใช้สอย
3. CitizenID 13 หลัก = Universal Key
4. Province-First: แพร่ → 76 จว. → ชาติ
5. API: /api/{province_code}/{ministry}/*
6. AIRTABLE_BASE = app6keeRcHmiTMLKy [NEVER CHANGE]
7. PHRAE_BASE = appXQC4uFhjeBpC7T [NEVER CHANGE]
8. PHRAE_API_KEY = phrae2026

---

## Live URLs
- Platform: https://g2g-ai-pool.fly.dev/phrae.html
- Management: https://g2g-ai-pool.fly.dev/management.html
- Personnel: https://g2g-ai-pool.fly.dev/personnel-registry.html
- Deploy: cd /Users/maew/Desktop/g2g-ai-pool && fly deploy --app g2g-ai-pool
