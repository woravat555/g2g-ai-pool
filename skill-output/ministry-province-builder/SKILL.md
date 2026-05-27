---
name: ministry-province-builder
description: Reusable G2G ministry/province platform generator. Use when user says "สร้างแพลตฟอร์มกระทรวง X", "ทำเว็บกรม Y", "build ministry platform", "province platform", "ขยายไปจังหวัด Z". Reads a ministry/province JSON config, generates role HTML files + delegate.js + hub + desktop apps in one pass. Pattern proven on MHESI (51 files) and MOAC (60 files).
---

# Ministry / Province Platform Builder

Use this skill to replicate the MHESI/MOAC pattern for any Thai ministry or province in one shot.

## Trigger phrases
- "สร้างแพลตฟอร์มกระทรวง X" / "build ministry X"
- "ขยายโครงการไปจังหวัด Y" / "rollout to province Y"
- "ทำเว็บกรม Z"

## Inputs needed (ask user if missing)
1. **namespace** — short code (e.g. `mhesi`, `moac`, `phrae`, `moi`)
2. **ministry_name_th** — full Thai name
3. **theme colors** — primary (--p1), gradient stop 2/3
4. **departments[]** — list of `{code, name_th, head_position, icon}` (often already in `ministry_modules/{name}.json`)
5. **base_url** — e.g. `https://g2g-ai-pool.fly.dev`
6. **output dir** — usually `/Users/maew/Desktop/g2g-ai-pool/public/`

## Workflow

### Step 1 — Read references
Before generating anything, read these as patterns:
- `/Users/maew/Desktop/g2g-ai-pool/public/mhesi-delegate.js` — delegation FAB
- `/Users/maew/Desktop/g2g-ai-pool/public/mhesi-minister.html` — top role
- `/Users/maew/Desktop/g2g-ai-pool/public/mhesi-nstda.html` + `-deputy.html` + `-staff.html` — dept tier
- `/Users/maew/Desktop/g2g-ai-pool/public/mhesi-hub.html` — landing
- `/Users/maew/Desktop/g2g-ai-pool/public/moac-delegate.js` — already-customised for MOAC (proof of namespace swap works)

### Step 2 — Confirm scope with user
Show: total file count = 4 political + (depts × 3) + hub + org + delegate.js + desktop script.
Example MOAC: 4 + (15×3) + 3 = ~57 files.

### Step 3 — Generate delegate.js
Clone `mhesi-delegate.js`, swap:
- `MhesiDelegate` → `{Namespace}Delegate`
- `/api/mhesi` → `/api/{namespace}`
- Optionally swap CSS var colors

### Step 4 — Generate role HTMLs
For each role, render template `templates/role-html.template` with these variables:
`{{ministry_code}} {{ministry_name_th}} {{role_id}} {{role_name}} {{role_emoji}} {{theme_p1}}..{{theme_p5}} {{sidebar_items}} {{tabs_html}} {{namespace}} {{api_base}} {{reports_to_js}} {{can_assign_to_json}} {{hub_link}}`

For each department, generate 3 role files: head, deputy, staff.

### Step 5 — Generate hub.html
Render `templates/hub.html.template` with tile data for all generated roles.

### Step 6 — Generate desktop apps script
Render `templates/desktop-app.sh.template` — sets BASE_URL, OUT_ROOT, and emits one `build_app` call per generated role HTML. Make sure to sanitize `/` in labels to avoid `osacompile` error.

### Step 7 — Generate backend stub
Append to `server.js` (after MHESI section, before `app.listen`):
- `/api/{ns}/assign` POST
- `/api/{ns}/tasks` GET + `/api/{ns}/tasks/:id` PATCH
- `/api/{ns}/report` POST + `/api/{ns}/reports` GET
Copy the MHESI block exactly, replacing `mhesi*` → `{ns}*` in identifiers.

### Step 8 — Deploy + verify
```
cd /Users/maew/Desktop/g2g-ai-pool
fly deploy --strategy immediate
bash scripts/build-{ns}-desktop-apps.sh
open https://g2g-ai-pool.fly.dev/{ns}-hub.html
```

## Critical rules
- **Sarabun font** + inline CSS in `<style>` — no external stylesheets
- Each HTML must include `<script src="/{ns}-delegate.js"></script>`
- `{Namespace}Delegate.init({...})` must be called on `doLogin()`
- **Real data only** — pull from `ministry_modules/{ns}.json` if present; never fabricate
- Build script must sanitize `/` and `:` in app labels (osacompile fails on those)
- URLs in desktop script must match actually-existing HTML files (lowercase code)

## Reference implementations
- MHESI: 51 files, theme purple `#5b0ea6`, completed 2026-05-25
- MOAC: 60 files, theme navy+gold `#1b4332`+`#c9a227`, completed 2026-05-26
