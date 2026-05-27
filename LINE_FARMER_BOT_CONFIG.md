# LINE Farmer Tracker Bot — Configuration Guide

LINE Official Account (OA) ที่ให้เกษตรกรพิมพ์เล่ากิจกรรมในแปลงสด ๆ
แล้วบอทจะ parse → บันทึกลง `farmerActivities[]` → ตอบ confirm กลับ

## OA Identity

| Item | Value |
|---|---|
| OA Display Name | G2G เกษตรกรน้อย (Farmer Tracker) |
| Basic ID | `@g2g-farmer` (request from LINE OA Manager) |
| Category | เกษตร / ธุรกิจการเกษตร |
| Description | บันทึกกิจกรรมในแปลง (ใส่ปุ๋ย / พ่นยา / เก็บเกี่ยว) แบบพิมพ์เล่า แล้วบอท G2G AgriTech จดให้อัตโนมัติ |

## Channel Credentials (Fly secrets)

ตั้งค่า secrets บน Fly.io แอป `g2g-ai-pool` ทั้ง 2 ตัว:

```bash
fly secrets set LINE_CHANNEL_ACCESS_TOKEN_FARMER="<long-lived-channel-access-token>" -a g2g-ai-pool
fly secrets set LINE_CHANNEL_SECRET_FARMER="<channel-secret-from-developer-console>" -a g2g-ai-pool
```

ถ้าไม่ตั้ง `_FARMER` ระบบจะ fallback ไปใช้ `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` ทั่วไปแทน
ทำให้แชร์บอทเดิมได้ในช่วง dev

ถ้าไม่ตั้ง `LINE_CHANNEL_SECRET*` เลย → webhook จะ skip signature verification (เหมาะกับ dev / staging)

## Webhook URL

```
https://g2g-ai-pool.fly.dev/api/line-webhook/farmer
```

## LINE Developer Console Setup

1. https://developers.line.biz/console/ → เลือก Provider → Create Messaging API channel
2. กรอกชื่อ "G2G Farmer Tracker", category = เกษตร
3. ไปที่ tab **Messaging API**:
   - คัดลอก **Channel access token (long-lived)** → ใส่เป็น `LINE_CHANNEL_ACCESS_TOKEN_FARMER`
   - คัดลอก **Channel secret** (tab Basic settings) → ใส่เป็น `LINE_CHANNEL_SECRET_FARMER`
4. **Webhook URL** = `https://g2g-ai-pool.fly.dev/api/line-webhook/farmer`
5. กด **Verify** — ควรเห็น "Success" (server ตอบ 200)
6. เปิด **Use webhook** = ON
7. ไปที่ LINE OA Manager (https://manager.line.biz) → Settings → Response settings:
   - **Chat** = OFF (ให้ webhook ตอบแทน)
   - **Auto-response messages** = OFF
   - **Webhook** = ON
   - **Greeting message** = ON (ใช้แทน follow event ถ้า webhook ยังไม่ตอบ)

## Rich Menu (4-tile layout, 2500x843px)

| Tile | Action | Reply / Link |
|---|---|---|
| 📝 บันทึกกิจกรรม | Send text: "บันทึก" | Bot ตอบ template + รอ input |
| 📊 ดูประวัติแปลง | URI | `https://g2g-ai-pool.fly.dev/farmer-plots.html?lineId={userId}` |
| 📅 งานสัปดาห์นี้ | URI | `https://g2g-ai-pool.fly.dev/farmer-weekly.html?lineId={userId}` |
| 🎯 ตลาด/ผู้ซื้อ | URI | `https://g2g-ai-pool.fly.dev/farmer-buyers.html?lineId={userId}` |

สร้าง rich menu ผ่าน LINE Official Account Manager → Rich messages → Rich menus → Create

## Sample Messages & Expected Parsed JSON

### 1. ใส่ปุ๋ย
**User:** `วันนี้ใส่ปุ๋ยลำไยแปลง P001 สูตร 15-15-15 จำนวน 2 กระสอบ`
```json
{
  "type": "fertilize",
  "crop": "lamyai",
  "plotId": "P001",
  "note": "วันนี้ใส่ปุ๋ยลำไยแปลง P001 สูตร 15-15-15 จำนวน 2 กระสอบ"
}
```
**Bot reply:** `✅ บันทึกแล้ว: fertilize (lamyai) แปลง P001\nขอบคุณค่ะ`

### 2. พ่นยา
**User:** `พ่นยาฆ่าแมลงในแปลงมะม่วงเลข 42 เช้านี้ครับ`
```json
{ "type": "spray", "crop": "mango", "plotId": "42", "note": "..." }
```

### 3. เก็บเกี่ยว
**User:** `เก็บเกี่ยวลิ้นจี่แปลง L7 ได้ 350 กก. เกรด A`
```json
{ "type": "harvest", "crop": "lychee", "plotId": "L7", "note": "..." }
```

### 4. รดน้ำ
**User:** `รดน้ำสับปะรดแปลง P2`
```json
{ "type": "water", "crop": "pineapple", "plotId": "P2", "note": "..." }
```

### 5. ตัดแต่งกิ่ง
**User:** `ตัดแต่งกิ่งลำไยแปลง P001 เสร็จแล้ว`
```json
{ "type": "prune", "crop": "lamyai", "plotId": "P001", "note": "..." }
```

### 6. ตรวจแปลง
**User:** `วันนี้ไปตรวจแปลงทุเรียน B12 มีโรคใบจุด ต้องพ่นยา`
```json
{ "type": "inspect", "crop": "durian", "plotId": "B12", "note": "..." }
```

## Parsing Logic

1. **Claude Haiku** (ถ้ามี `ANTHROPIC_API_KEY` env): ส่ง text ไป parse เป็น JSON
2. **Regex fallback**: keyword matching สำหรับ 9 activity types (fertilize/spray/harvest/water/prune/weed/inspect/plant/other) และ 13 crops + plot ID regex `แปลง[\s#]?([A-Z]?\d+)`

## Verifying

```bash
# 1. Health check
curl https://g2g-ai-pool.fly.dev/api/line-webhook/farmer -X POST \
  -H 'content-type: application/json' \
  -d '{"events":[]}'
# → {"ok":true}

# 2. Simulate a message (dev only, no signature)
curl https://g2g-ai-pool.fly.dev/api/line-webhook/farmer -X POST \
  -H 'content-type: application/json' \
  -d '{"events":[{"type":"message","replyToken":"test","source":{"userId":"U_test"},"message":{"type":"text","text":"ใส่ปุ๋ยลำไยแปลง P001"}}]}'

# 3. Check it was saved
curl 'https://g2g-ai-pool.fly.dev/api/farmer/activities?farmerId=U_test'
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Verify ใน Console ขึ้น Error 401 | signature mismatch | ตรวจ `LINE_CHANNEL_SECRET_FARMER` ใน Fly secrets ให้ตรงกับ Console |
| User พิมพ์แล้วบอทเงียบ | OA Manager → Chat = ON | ปิด Chat ใน OA Manager (ให้ webhook ตอบแทน) |
| ตอบทุกครั้งเป็น "type: other" | regex ไม่ match | เพิ่ม `ANTHROPIC_API_KEY` หรือเพิ่ม keyword ใน `parseFarmerActivityFallback` |
| 404 not_found_error | `CLAUDE_MODEL` ผิด | ใช้ `claude-haiku-4-5` (มีอยู่แล้ว) |
