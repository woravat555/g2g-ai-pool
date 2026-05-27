#!/usr/bin/env bash
# =============================================================
# G2G AgriTech — MOAC Desktop Apps Builder (v2 — URLs verified)
# =============================================================
# Generates clickable .app bundles for every MOAC role.
# Each .app opens Google Chrome to a specific dashboard URL.
#
# Output:
#   ~/Desktop/แพลตฟอร์มกระทรวงเกษตรและสหกรณ์/
#     1-รัฐมนตรี/
#     2-ปลัดและรองปลัด/
#     3-กรม/  (15 subfolders, one per dept × 3 roles)
#     4-FarmerMgmt/
#     0-Hub.app  (entry point)
#
# Requires: macOS (osacompile, mkdir) — no extra deps.
# Run: bash scripts/build-moac-desktop-apps.sh
# Set BASE_URL=http://localhost:8787 to point at local server.
# =============================================================
set -euo pipefail
BASE_URL="${BASE_URL:-https://g2g-ai-pool.fly.dev}"
OUT_ROOT="${HOME}/Desktop/แพลตฟอร์มกระทรวงเกษตรและสหกรณ์"

echo "[build-moac-desktop-apps] BASE_URL=${BASE_URL}"
echo "[build-moac-desktop-apps] OUT_ROOT=${OUT_ROOT}"

# Wipe + recreate to avoid stale apps
rm -rf "${OUT_ROOT}"
mkdir -p "${OUT_ROOT}/0-Hub"
mkdir -p "${OUT_ROOT}/1-รัฐมนตรี"
mkdir -p "${OUT_ROOT}/2-ปลัดและรองปลัด"
mkdir -p "${OUT_ROOT}/3-กรม"
mkdir -p "${OUT_ROOT}/4-FarmerMgmt"

# -------------------------------------------------------------
# build_app <output_dir> <app_label> <url> <icon_emoji>
# Sanitises slashes in label → dash, so osacompile is happy.
# -------------------------------------------------------------
build_app() {
  local out_dir="$1"
  local raw_label="$2"
  local url="$3"
  local emoji="$4"
  # replace "/" with "-" and ":" with "-"
  local label="${raw_label//\//-}"
  label="${label//:/-}"
  local app_path="${out_dir}/${emoji} ${label}.app"
  rm -rf "${app_path}"

  local script="tell application \"Google Chrome\"
    activate
    if (count of windows) is 0 then
        make new window
    end if
    open location \"${url}\"
end tell"

  echo "${script}" | osacompile -o "${app_path}" >/dev/null 2>&1 \
    && echo "  ✓ ${app_path}" \
    || echo "  ✗ FAILED ${app_path}"
}

# -------------------------------------------------------------
# Tier 0 — Hub (entry)
# -------------------------------------------------------------
build_app "${OUT_ROOT}/0-Hub"            "MOAC Hub (เลือกบทบาท)"    "${BASE_URL}/moac-hub.html"               "🏛"
build_app "${OUT_ROOT}/0-Hub"            "MOAC Org Chart"           "${BASE_URL}/moac-org.html"               "🌳"

# -------------------------------------------------------------
# Tier 1 — รัฐมนตรี
# -------------------------------------------------------------
echo ""
echo "Building Tier 1 — รัฐมนตรี..."
build_app "${OUT_ROOT}/1-รัฐมนตรี"        "รมว.กษ."                  "${BASE_URL}/moac-minister.html"          "👑"
build_app "${OUT_ROOT}/1-รัฐมนตรี"        "เลขาฯ รมว."               "${BASE_URL}/moac-minister-sec.html"      "📝"
build_app "${OUT_ROOT}/1-รัฐมนตรี"        "รมช.กษ. (คนที่ 1) วัชระพล" "${BASE_URL}/moac-dep-minister.html"        "🎖"
build_app "${OUT_ROOT}/1-รัฐมนตรี"        "เลขาฯ รมช. (คนที่ 1)"     "${BASE_URL}/moac-dep-minister-sec.html"    "📝"
build_app "${OUT_ROOT}/1-รัฐมนตรี"        "รมช. (คนที่ 2) ปิยรัฐชย์"   "${BASE_URL}/moac-dep-minister-2.html"     "🎖"
build_app "${OUT_ROOT}/1-รัฐมนตรี"        "เลขาฯ รมช. (คนที่ 2)"      "${BASE_URL}/moac-dep-minister-2-sec.html" "📝"

# -------------------------------------------------------------
# Tier 2 — ปลัดและรองปลัด
# -------------------------------------------------------------
echo ""
echo "Building Tier 2 — ปลัดและรองปลัด..."
build_app "${OUT_ROOT}/2-ปลัดและรองปลัด"  "ปลัด กษ."                 "${BASE_URL}/moac-ps.html"                "📋"
build_app "${OUT_ROOT}/2-ปลัดและรองปลัด"  "เลขาฯ ปลัด"               "${BASE_URL}/moac-ps-sec.html"            "📝"
build_app "${OUT_ROOT}/2-ปลัดและรองปลัด"  "ที่ปรึกษาปลัด"            "${BASE_URL}/moac-ps-advisor.html"        "🎓"
build_app "${OUT_ROOT}/2-ปลัดและรองปลัด"  "รองปลัด กษ."              "${BASE_URL}/moac-deputy-ps.html"         "📋"
build_app "${OUT_ROOT}/2-ปลัดและรองปลัด"  "เลขาฯ รองปลัด"            "${BASE_URL}/moac-deputy-ps-sec.html"     "📝"

# -------------------------------------------------------------
# Tier 3 — 15 กรม × 3 ระดับ
# -------------------------------------------------------------
echo ""
echo "Building Tier 3 — 15 กรม..."

# Format: "code|name_th|emoji"   (code must match moac-{code-lower}.html)
DEPTS=(
  "OPS|สำนักงานปลัด กษ.|🏛"
  "DOAE|กรมส่งเสริมการเกษตร|🌾"
  "CPD|กรมส่งเสริมสหกรณ์|🤝"
  "CAD|กรมตรวจบัญชีสหกรณ์|📊"
  "DLD|กรมปศุสัตว์|🐄"
  "DOF|กรมประมง|🐟"
  "RD|กรมการข้าว|🌾"
  "DOA|กรมวิชาการเกษตร|🔬"
  "LDD|กรมพัฒนาที่ดิน|🌱"
  "RID|กรมชลประทาน|💧"
  "ALRO|ส.ป.ก.|📐"
  "RAOT|กยท. (ยางพารา)|🌳"
  "QSDS|กรมหม่อนไหม|🧵"
  "OAE|สศก.|📈"
  "ACFS|มกอช.|✅"
)

for entry in "${DEPTS[@]}"; do
  IFS='|' read -r code name emoji <<< "${entry}"
  code_lc="$(echo "${code}" | tr '[:upper:]' '[:lower:]')"
  dept_dir="${OUT_ROOT}/3-กรม/${emoji} ${name}"
  mkdir -p "${dept_dir}"
  build_app "${dept_dir}" "${name} — หัวหน้า"   "${BASE_URL}/moac-${code_lc}.html"          "${emoji}"
  build_app "${dept_dir}" "${name} — รอง"       "${BASE_URL}/moac-${code_lc}-deputy.html"   "${emoji}"
  build_app "${dept_dir}" "${name} — นักวิชาการ" "${BASE_URL}/moac-${code_lc}-staff.html"   "${emoji}"
done

# -------------------------------------------------------------
# Tier 4 — Farmer Management
# -------------------------------------------------------------
echo ""
echo "Building Tier 4 — Farmer Management..."
build_app "${OUT_ROOT}/4-FarmerMgmt" "ปฏิทินพืช 12 ชนิด (52 สัปดาห์)"  "${BASE_URL}/crop-calendar-v2.html"      "📅"
build_app "${OUT_ROOT}/4-FarmerMgmt" "ติดตามแปลงเกษตรกร (LINE bot log)" "${BASE_URL}/farmer-tracker.html"        "👨‍🌾"
build_app "${OUT_ROOT}/4-FarmerMgmt" "แนวโน้มผลผลิต + จับคู่ผู้ซื้อ"      "${BASE_URL}/production-dashboard.html"  "📊"
build_app "${OUT_ROOT}/4-FarmerMgmt" "Farmer Advisory (เดิม)"            "${BASE_URL}/farmer-advisory.html"       "🤝"

# -------------------------------------------------------------
# Summary
# -------------------------------------------------------------
echo ""
echo "============================================================"
echo "✅ Done. All apps in: ${OUT_ROOT}"
find "${OUT_ROOT}" -maxdepth 3 -name "*.app" -type d | wc -l | xargs echo "Total apps:"
echo "============================================================"
