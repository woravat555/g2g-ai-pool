# MOAC AI Advisory System

Auto-generated, role-aware policy advisory for every directive issued by the
Minister of Agriculture. Combines **Perplexity Sonar-Pro** (research) +
**Claude Sonnet 4.x** (policy analysis) into a structured JSON payload that the
moac-app UI surfaces under a new "🤖 AI แนะนำ" tab inside the directive detail
modal — pre-filtered to the viewer's role level.

## How auto-trigger works

1. `POST /api/moac/directives` creates the directive and returns immediately
   (no UI wait).
2. The handler fires `generateDirectiveAdvisory(directive)` asynchronously:
   - Perplexity research call (`sonar-pro`) gathers Thai policy context, KPIs,
     past initiatives.
   - Claude (`claude-sonnet-4-5`, 4000 tokens) produces strict JSON with
     `context_summary`, `key_data_points`, six-level `action_plans`,
     `risks`, `best_practices`, `milestones`, `success_metrics`, `model_notes`.
3. Result is attached to the directive (`directive.aiAdvisory`,
   `aiAdvisoryAt`, `aiAdvisoryStatus`) and persisted to `/tmp/moac-data.json`.
4. UI badge polls `/advisory` every 10s and lights up "🤖 AI พร้อม" once ready.

## New / extended endpoints

```bash
# 1) Lazy-load just the advisory blob (no full directive payload)
curl https://HOST/api/moac/directives/MD1716700001/advisory

# 2) Regenerate (e.g. after editing the directive body)
curl -X POST -H "x-api-key: moac2026" \
  https://HOST/api/moac/directives/MD1716700001/refresh-advisory

# 3) Role-filtered slice — returns only the action plan for the caller's level
curl -X POST -H "Content-Type: application/json" \
  -d '{"roleId":"moac-doae-deputy"}' \
  https://HOST/api/moac/directives/MD1716700001/role-advisory

# 4) Backwards-compat one-shot mode (delegates when directiveId supplied)
curl -X POST -H "Content-Type: application/json" \
  -d '{"directiveId":"MD1716700001"}' \
  https://HOST/api/moac/ai-analysis

# 5) Original /ai-analysis still works for ad-hoc questions
curl -X POST -H "Content-Type: application/json" \
  -d '{"question":"งบดำเนินงาน 2568 พอหรือไม่"}' \
  https://HOST/api/moac/ai-analysis
```

## Sample advisory JSON shape

```json
{
  "ai_model": "claude-sonnet-4-5 + perplexity/sonar-pro",
  "generated_at": "2026-05-26T05:14:22.918Z",
  "research": {
    "text": "ไทยใช้ปุ๋ยเคมีปีละ ~5.4 ล้านตัน นำเข้า 95% มูลค่า ~70,000 ล้านบาท…",
    "sources": [{"idx":1,"url":"https://…","title":"ราคาปุ๋ย OAE"}]
  },
  "analysis": {
    "context_summary": "นโยบายลดต้นทุนปุ๋ย 30% เกิดจาก…",
    "key_data_points": ["…","…"],
    "action_plans": {
      "ps":          { "summary":"…","steps":["…"],"deadline_hint":"30 วัน" },
      "deputy-ps":   { "summary":"…","steps":["…"] },
      "dept-head":   { "summary":"…","steps":["…"] },
      "dept-deputy": { "summary":"…","steps":["…"] },
      "dept-staff":  { "summary":"…","steps":["…"] },
      "provincial":  { "summary":"…","steps":["…"] }
    },
    "risks": [
      { "risk":"…","mitigation":"…","severity":"high" }
    ],
    "best_practices": ["…"],
    "milestones": [{ "week":1,"title":"…","owner_level":"ps" }],
    "success_metrics": [{ "metric":"…","target":"…","tied_to_kpi":"…" }],
    "model_notes": "ตัวเลขปี 2568 อ้างอิงจาก OAE/ราคาตลาดเดือน เม.ย."
  },
  "tokens_used": 3417
}
```

## Privacy & data handling

- The directive title, body, category, priority, due date, and KPI list are
  sent to **Anthropic** (Claude) and **Perplexity** (sonar-pro) over HTTPS.
- No personnel records, citizen data, or identifiers are sent — only the
  policy text the Minister already issued.
- Disable globally by unsetting `CLAUDE_API_KEY` / `ANTHROPIC_API_KEY` on Fly.
  The system then returns a stub advisory with `error: "missing_claude_api_key"`.
- `PPLX_API_KEY` is optional; without it the system falls back to Claude-only
  analysis (no live citations).

## Cost note

- **Claude Sonnet 4.5** at ~3.5k–4k tokens per directive ≈ $0.06–$0.08.
- **Perplexity sonar-pro** at ~1.2k tokens ≈ $0.02.
- Total **≈ $0.08–$0.10 per directive issued** + one regenerate per refresh.
- The Minister will typically issue 10–30 directives/month → **< $5/month** in
  AI cost across the whole ministry.
- Advisory is cached on the directive object, so subsequent reads (one per
  recipient × N viewings) are free.
