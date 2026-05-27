# G2G AI Pool — Deploy Guide (Terminal)

> Multi-provider AI router with cost+markup metering.
> Airtable base **already created** by Claude (`appRQwVddDxQdU6P3` in MoA workspace).
> 4 providers + 11 models + 9 channels + 4 pricing tiers already seeded.
> Floor 3x, Blended target 4x, Gov 5–6x, Insider 8x+.

---

## What's left for you (5 manual steps in Terminal, ~20 min)

### Step 1 — Create Airtable Personal Access Token

Open in browser: https://airtable.com/create/tokens

- Click **+ Create new token**
- Name: `g2g-ai-pool-prod`
- Scopes: `data.records:read`, `data.records:write`, `schema.bases:read`
- Access: select base **G2G_AI_Pool**
- Click Create → **copy the token** (starts with `pat...`)

### Step 2 — Install flyctl (if not already)

```bash
brew install flyctl
# OR: curl -L https://fly.io/install.sh | sh
fly auth login
```

### Step 3 — Initialize Fly app

```bash
cd ~/Downloads/g2g-ai-pool   # or wherever you put this folder
fly launch --no-deploy --copy-config --name g2g-ai-pool --region sin
```

When asked: **No** to Postgres, **No** to Redis, **No** to immediate deploy.

### Step 4 — Set secrets (paste YOUR keys here)

```bash
fly secrets set \
  AIRTABLE_TOKEN='pat...PASTE_FROM_STEP_1...' \
  AIRTABLE_BASE='appRQwVddDxQdU6P3' \
  ANTHROPIC_KEY_1='sk-ant-...YOUR_REAL_KEY...' \
  OPENAI_KEY_1='sk-...YOUR_REAL_KEY...' \
  GEMINI_KEY_1='AIza...YOUR_REAL_KEY...' \
  PERPLEXITY_KEY_1='pplx-...YOUR_REAL_KEY...' \
  -a g2g-ai-pool
```

(All values stay on your machine + Fly — never travel through chat.)

### Step 5 — Deploy

```bash
fly deploy -a g2g-ai-pool
```

After deploy completes, get your URL:

```bash
fly status -a g2g-ai-pool
# Hostname: g2g-ai-pool.fly.dev
```

### Step 6 — Verify health

```bash
curl https://g2g-ai-pool.fly.dev/health
# Expected: {"ok":true,"service":"g2g_ai_pool","ts":"..."}
```

### Step 7 — Smoke test the router

```bash
curl -X POST https://g2g-ai-pool.fly.dev/route \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "C001",
    "channel_key": "",
    "user_id": "U_test_001",
    "prompt": "สวัสดี ทดสอบระบบ ตอบสั้นๆ",
    "model_class": "cheap",
    "max_tokens": 100
  }'
```

Expected response:
```json
{
  "ok": true,
  "text": "...AI response in Thai...",
  "tokens": {"input": ..., "output": ...},
  "cost_thb": 0.0xxx,
  "sell_thb": 0.0xxx,
  "margin_ratio": 3.01,
  "model_used": "gemini-2.5-flash"
}
```

Then check Airtable → `Usage_Log` table → there should be a new row with `margin_status = 🟢 OK`.

---

## LINE Webhook Setup (after server runs)

For each LINE OA you want to connect (น้องเลขา first):

1. Add LINE channel access token to Fly secrets:
   ```bash
   fly secrets set LINE_TOKEN_C001='YOUR_LINE_CHANNEL_ACCESS_TOKEN' -a g2g-ai-pool
   ```
   (Replace `C001` with the `channel_id_ext` from Airtable Channels table)

2. Open LINE Developers Console: https://developers.line.biz/console/
3. Pick your OA channel → Messaging API tab
4. **Webhook URL** = `https://g2g-ai-pool.fly.dev/line/webhook/C001`
5. Click **Verify** — should return Success
6. Turn ON **Use webhook**
7. In LINE OA Manager: turn OFF auto-response messages, turn ON chat

Done. Send a message to the OA — bot should reply with AI.

---

## Local Development

```bash
cp .env.example .env
# edit .env with your real keys
npm install
npm run dev
```

Server runs on http://localhost:8080 — same endpoints as production.

---

## Adding More Provider Keys (when you scale)

When traffic grows and 1 key hits 85% daily quota:

1. Sign up for additional Anthropic/OpenAI account
2. Generate new API key
3. Add to Fly secrets: `fly secrets set ANTHROPIC_KEY_2='sk-ant-...' -a g2g-ai-pool`
4. Add row in Airtable `API_Keys_Pool`:
   - key_label: `Anthropic-Pool-2`
   - key_ref: `ANTHROPIC_KEY_2`
   - provider: link to Anthropic
   - daily_quota_usd: 50 (or whatever limit you set on account)
   - rank: 2
   - active: ✓

System auto-routes to least-used key. **No code change needed.**

---

## Monitoring

```bash
fly logs -a g2g-ai-pool                # live tail
fly status -a g2g-ai-pool              # health
fly scale show -a g2g-ai-pool          # machine info
```

In Airtable:
- 🚨 `Usage_Log` view filter `margin_status = "🔴 BREACH"` → must be empty
- 💰 Daily P&L view: group by channel, today
- 🔥 `API_Keys_Pool` view: filter `quota_remaining_pct < 0.30` → time to add more keys

---

## Cost Estimate (Fly.io)

- shared-cpu-1x 512MB Singapore region
- ~$2–5/month idle
- ~$10–30/month at Launch scale (10K users)
- Scales horizontally if needed

---

## MOAC Platform & Farmer Management (added 2026-05)

### MOAC ministry data routes (read-only, public)
`GET /api/moac/overview`, `/api/moac/departments`, `/api/moac/departments/:code`,
`/api/moac/kpis`, `/api/moac/policies`, `/api/moac/province-rollout`
- Data source: `public/ministry-data/agriculture.json`
- CORS allow-list keys (POST only): `phrae2026`, `moac2026`, `chiangrai2026`, `udonthani2026`

### MOAC delegation routes (mirror MHESI)
- `POST /api/moac/assign` — boss assigns task downward (body: `{from, fromName, to, toName, title, detail, priority}`)
- `GET  /api/moac/tasks?assignee=&assigner=` — list tasks
- `PATCH /api/moac/tasks/:id` — update status/note
- `POST /api/moac/report` — submit report upward (body: `{from, fromName, fromLevel, toLevel, title, summary, data}`)
- `GET  /api/moac/reports?toLevel=&from=&fromLevel=` — list reports
- In-memory store (`moacTasks[]`, `moacReports[]`) — same shape as MHESI. Frontend can reuse `mhesi-delegate.js` by swapping `API` URL to `/api/moac`.

### Farmer Management routes
- `POST /api/farmer/track` — log a plot activity
- `GET  /api/farmer/activities?limit=&plotId=&crop=&farmerId=`
- `GET  /api/farmer/plots/:id` — full history of one plot (activities + production + matches)
- `GET  /api/farmer/calendar/:crop` — reads `public/crop-data/{crop}.json` (12 crops: lamyai, lychee, mango, pineapple, orange, coffee, tea, rubber, sugarcane, cassava, rice-jasmine, rice-sticky)
- `GET  /api/farmer/production?plotId=&crop=`
- `POST /api/farmer/production` — record an estimate `{plotId, crop, estimateKg, harvestWeek, grade}`
- `GET  /api/farmer/buyers?region=&grade=&crop=` — list 8 seeded buyer/ล้ง records
- `POST /api/farmer/matching` — input plot info `{plotId, province, crop, grade, estimateKg}`, returns top-3 buyer matches scored by region (40) + grade (30) + capacity (30) + crop bonus (10)

### LINE Farmer Tracker bot
- Webhook: `POST /api/line-webhook/farmer`
- Setup details: see `LINE_FARMER_BOT_CONFIG.md`
- Required Fly secrets: `LINE_CHANNEL_ACCESS_TOKEN_FARMER`, `LINE_CHANNEL_SECRET_FARMER` (fallback to non-suffixed ones for dev)
- Optional `ANTHROPIC_API_KEY` for Claude Haiku activity parsing (regex fallback otherwise)

### Desktop apps for MOAC personnel
Build clickable `.app` bundles (macOS) for every MOAC role:

```bash
chmod +x scripts/build-moac-desktop-apps.sh
bash scripts/build-moac-desktop-apps.sh
# Output: ~/Desktop/แพลตฟอร์มกระทรวงเกษตรและสหกรณ์/
#   1-รัฐมนตรี/, 2-ปลัดและรองปลัด/, 3-กรม/ (15 depts), 4-FarmerMgmt/
```

Override the backend URL with `BASE_URL=https://other.fly.dev bash scripts/build-moac-desktop-apps.sh`
