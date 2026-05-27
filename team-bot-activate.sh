#!/bin/bash
# ============================================================
# G2G Team Bot Activator — 10 bots (บัญชีใหม่ทั้งหมด)
# ใส่ค่าแต่ละ bot ด้านล่าง แล้วรัน: bash team-bot-activate.sh
# ============================================================

APP="g2g-ai-pool"

# ──────────────────────────────────────────────
# 1. เกมส์ — Government Relations (@yyj1761e)
# ──────────────────────────────────────────────
GAME_CHANNELID=""      # Channel ID จาก LINE Developers Console
GAME_SECRET=""         # Channel Secret
GAME_TOKEN=""          # Channel Access Token

# ──────────────────────────────────────────────
# 2. วรรณ — Operations (@974ifwsg)
# ──────────────────────────────────────────────
WAN_CHANNELID=""
WAN_SECRET=""
WAN_TOKEN=""

# ──────────────────────────────────────────────
# 3. ใบแพร — Creative & Social (@729yshru)
# ──────────────────────────────────────────────
BAIPARE_CHANNELID=""
BAIPARE_SECRET=""
BAIPARE_TOKEN=""

# ──────────────────────────────────────────────
# 4. ส้ม — อัญมณี (@154oekue)
# ──────────────────────────────────────────────
SOM_CHANNELID=""
SOM_SECRET=""
SOM_TOKEN=""

# ──────────────────────────────────────────────
# 5. ภูวษา — Business & Coordination (@764veplv)
# ──────────────────────────────────────────────
PRUWASA_CHANNELID=""
PRUWASA_SECRET=""
PRUWASA_TOKEN=""

# ──────────────────────────────────────────────
# 6. แอมพร — ทีมงาน G2G (@005vsrze)
# ──────────────────────────────────────────────
AMPHAIWAN_CHANNELID=""
AMPHAIWAN_SECRET=""
AMPHAIWAN_TOKEN=""

# ──────────────────────────────────────────────
# 7. พิมลรัตน์ — IT & Data Center (@654ottfx)
# ──────────────────────────────────────────────
PIMONRAT_CHANNELID=""
PIMONRAT_SECRET=""
PIMONRAT_TOKEN=""

# ──────────────────────────────────────────────
# 8. ชาดา — ข่าวและการสื่อสาร (@284yckbo)
# ──────────────────────────────────────────────
CHADA_CHANNELID=""
CHADA_SECRET=""
CHADA_TOKEN=""

# ──────────────────────────────────────────────
# 9. พรรณี — มวลชนแพร่ (@899cacob)
# ──────────────────────────────────────────────
PANNEE_CHANNELID=""
PANNEE_SECRET=""
PANNEE_TOKEN=""

# ──────────────────────────────────────────────
# 10. ซ้อน — ทีมงาน G2G (@051fbewu)
# ──────────────────────────────────────────────
SON_CHANNELID=""
SON_SECRET=""
SON_TOKEN=""

# ============================================================
# ห้ามแก้ด้านล่าง — Script จะทำงานเอง
# ============================================================

echo "🤖 G2G Team Bot Activator (10 bots) — กำลัง set secrets..."

set_bot() {
  local name=$1 slug=$2 cid=$3 secret=$4 token=$5
  if [ -z "$cid" ] || [ -z "$secret" ] || [ -z "$token" ]; then
    echo "⏭  $name — ยังไม่ได้ใส่ token ข้าม"
    return
  fi
  echo "▶ $name ($slug)..."
  fly secrets set \
    "LINE_CHANNELID_${slug}=${cid}" \
    "LINE_SECRET_${slug}=${secret}" \
    "LINE_TOKEN_${slug}=${token}" \
    -a "$APP" --stage
  echo "✅ $name — secrets staged"
}

set_bot "เกมส์"      "GAME_G2G"      "$GAME_CHANNELID"      "$GAME_SECRET"      "$GAME_TOKEN"
set_bot "วรรณ"       "WAN_G2G"       "$WAN_CHANNELID"       "$WAN_SECRET"       "$WAN_TOKEN"
set_bot "ใบแพร"      "BAIPARE_G2G"   "$BAIPARE_CHANNELID"   "$BAIPARE_SECRET"   "$BAIPARE_TOKEN"
set_bot "ส้ม"        "SOM_G2G"       "$SOM_CHANNELID"       "$SOM_SECRET"       "$SOM_TOKEN"
set_bot "ภูวษา"      "PRUWASA_G2G"   "$PRUWASA_CHANNELID"   "$PRUWASA_SECRET"   "$PRUWASA_TOKEN"
set_bot "แอมพร"      "AMPHAIWAN_G2G" "$AMPHAIWAN_CHANNELID" "$AMPHAIWAN_SECRET" "$AMPHAIWAN_TOKEN"
set_bot "พิมลรัตน์"  "PIMONRAT_G2G"  "$PIMONRAT_CHANNELID"  "$PIMONRAT_SECRET"  "$PIMONRAT_TOKEN"
set_bot "ชาดา"       "CHADA_G2G"     "$CHADA_CHANNELID"     "$CHADA_SECRET"     "$CHADA_TOKEN"
set_bot "พรรณี"      "PANNEE_G2G"    "$PANNEE_CHANNELID"    "$PANNEE_SECRET"    "$PANNEE_TOKEN"
set_bot "ซ้อน"       "SON_G2G"       "$SON_CHANNELID"       "$SON_SECRET"       "$SON_TOKEN"

echo ""
echo "📡 Deploy เพื่อ apply secrets..."
fly secrets deploy -a "$APP"

echo ""
echo "🔗 ตั้ง Webhook URLs..."
WEBHOOK_BASE="https://g2g-ai-pool.fly.dev/webhook/line/mt"

set_webhook() {
  local name=$1 token=$2
  if [ -z "$token" ]; then return; fi
  result=$(curl -s -X POST "https://api.line.me/v2/bot/channel/webhook/endpoint" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"webhookEndpointUrl\": \"${WEBHOOK_BASE}\"}")
  echo "✅ Webhook $name: $result"
}

set_webhook "เกมส์"      "$GAME_TOKEN"
set_webhook "วรรณ"       "$WAN_TOKEN"
set_webhook "ใบแพร"      "$BAIPARE_TOKEN"
set_webhook "ส้ม"        "$SOM_TOKEN"
set_webhook "ภูวษา"      "$PRUWASA_TOKEN"
set_webhook "แอมพร"      "$AMPHAIWAN_TOKEN"
set_webhook "พิมลรัตน์"  "$PIMONRAT_TOKEN"
set_webhook "ชาดา"       "$CHADA_TOKEN"
set_webhook "พรรณี"      "$PANNEE_TOKEN"
set_webhook "ซ้อน"       "$SON_TOKEN"

echo ""
echo "🎉 เสร็จสิ้น! Bot ที่ใส่ token ครบจะ active ทันที"
echo "   ทดสอบ: DM แต่ละ bot แล้วพิมพ์ 'ทดสอบ'"
