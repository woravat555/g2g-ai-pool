#!/bin/bash
# ============================================================
# G2G Team Bot Activator — วางโทเค็นแล้วรันเลย
# ใส่ค่าแต่ละ bot ด้านล่าง แล้วรัน: bash team-bot-activate.sh
# ============================================================

APP="g2g-ai-pool"

# ──────────────────────────────────────────────
# 1. เกมส์ — Government Relations
# ──────────────────────────────────────────────
GAME_CHANNELID=""      # Channel ID จาก LINE Developers Console
GAME_SECRET=""         # Channel Secret
GAME_TOKEN=""          # Channel Access Token

# ──────────────────────────────────────────────
# 2. วรรณ — Operations
# ──────────────────────────────────────────────
WANNA_CHANNELID=""
WANNA_SECRET=""
WANNA_TOKEN=""

# ──────────────────────────────────────────────
# 3. ใบแพร — Creative & Social
# ──────────────────────────────────────────────
BAIPARE_CHANNELID=""
BAIPARE_SECRET=""
BAIPARE_TOKEN=""

# ──────────────────────────────────────────────
# 4. ส้ม — อัญมณี
# ──────────────────────────────────────────────
SOM_CHANNELID=""
SOM_SECRET=""
SOM_TOKEN=""

# ──────────────────────────────────────────────
# 5. ชาดา — ข่าวและการสื่อสาร
# ──────────────────────────────────────────────
CHADA_CHANNELID=""
CHADA_SECRET=""
CHADA_TOKEN=""

# ──────────────────────────────────────────────
# 6. พิมลรัตน์ — IT & Data Center
# ──────────────────────────────────────────────
PIMONRAT_CHANNELID=""
PIMONRAT_SECRET=""
PIMONRAT_TOKEN=""

# ──────────────────────────────────────────────
# 7. พรรณี — มวลชนแพร่
# ──────────────────────────────────────────────
PANNEE_CHANNELID=""
PANNEE_SECRET=""
PANNEE_TOKEN=""

# ──────────────────────────────────────────────
# 8. ภูวษา — หัวหน้าธุรกิจและการประสานงาน
# ──────────────────────────────────────────────
PUWASA_CHANNELID=""
PUWASA_SECRET=""
PUWASA_TOKEN=""

# ============================================================
# ห้ามแก้ด้านล่าง — Script จะทำงานเอง
# ============================================================

echo "🤖 G2G Team Bot Activator — กำลัง set secrets..."

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

set_bot "เกมส์"      "GAME_G2G"    "$GAME_CHANNELID"    "$GAME_SECRET"    "$GAME_TOKEN"
set_bot "วรรณ"       "WANNA_G2G"   "$WANNA_CHANNELID"   "$WANNA_SECRET"   "$WANNA_TOKEN"
set_bot "ใบแพร"      "BAIPARE_G2G" "$BAIPARE_CHANNELID" "$BAIPARE_SECRET" "$BAIPARE_TOKEN"
set_bot "ส้ม"        "SOM_G2G"     "$SOM_CHANNELID"     "$SOM_SECRET"     "$SOM_TOKEN"
set_bot "ชาดา"       "CHADA_G2G"   "$CHADA_CHANNELID"   "$CHADA_SECRET"   "$CHADA_TOKEN"
set_bot "พิมลรัตน์"  "PIMONRAT_G2G" "$PIMONRAT_CHANNELID" "$PIMONRAT_SECRET" "$PIMONRAT_TOKEN"
set_bot "พรรณี"      "PANNEE_G2G"  "$PANNEE_CHANNELID"  "$PANNEE_SECRET"  "$PANNEE_TOKEN"
set_bot "ภูวษา"      "PUWASA_G2G"  "$PUWASA_CHANNELID"  "$PUWASA_SECRET"  "$PUWASA_TOKEN"

echo ""
echo "📡 Deploy เพื่อ apply secrets..."
fly secrets deploy -a "$APP"

echo ""
echo "🔗 ตั้ง Webhook URLs ทีละ bot..."
WEBHOOK_BASE="https://g2g-ai-pool.fly.dev/webhook/line/mt"

set_webhook() {
  local name=$1 token=$2 cid=$3
  if [ -z "$token" ]; then return; fi
  result=$(curl -s -X POST "https://api.line.me/v2/bot/channel/webhook/endpoint" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"webhookEndpointUrl\": \"${WEBHOOK_BASE}\"}")
  echo "✅ Webhook $name: $result"
}

set_webhook "เกมส์"      "$GAME_TOKEN"     "$GAME_CHANNELID"
set_webhook "วรรณ"       "$WANNA_TOKEN"    "$WANNA_CHANNELID"
set_webhook "ใบแพร"      "$BAIPARE_TOKEN"  "$BAIPARE_CHANNELID"
set_webhook "ส้ม"        "$SOM_TOKEN"      "$SOM_CHANNELID"
set_webhook "ชาดา"       "$CHADA_TOKEN"    "$CHADA_CHANNELID"
set_webhook "พิมลรัตน์"  "$PIMONRAT_TOKEN" "$PIMONRAT_CHANNELID"
set_webhook "พรรณี"      "$PANNEE_TOKEN"   "$PANNEE_CHANNELID"
set_webhook "ภูวษา"      "$PUWASA_TOKEN"   "$PUWASA_CHANNELID"

echo ""
echo "🎉 เสร็จสิ้น! Bot ที่ใส่ token ครบจะ active ทันที"
echo "   ทดสอบ: DM แต่ละ bot แล้วพิมพ์ 'ทดสอบ'"
