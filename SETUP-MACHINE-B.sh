#!/bin/bash
# =============================================================
# G2G AI Pool — Multi-Device Cowork Setup (Machine B)
# รันสคริปต์นี้บน Terminal ของ Machine B
# =============================================================

echo "🖥️  G2G Multi-Device Cowork Setup — Machine B"
echo "================================================"

read -p "🔑 GitHub username ของ Machine A: " GH_USER
read -p "📁 ชื่อ repo (กด Enter ใช้ 'g2g-ai-pool'): " REPO_NAME
REPO_NAME=${REPO_NAME:-g2g-ai-pool}

REMOTE_URL="https://github.com/${GH_USER}/${REPO_NAME}.git"
DEST="$HOME/Desktop/${REPO_NAME}"

echo ""
echo "📥 Cloning from: $REMOTE_URL"
git clone "$REMOTE_URL" "$DEST"

if [ $? -eq 0 ]; then
  cd "$DEST"
  echo ""
  echo "📦 Installing dependencies..."
  npm install

  echo ""
  echo "✅ Machine B setup เสร็จแล้ว!"
  echo ""
  echo "================================================================"
  echo "📂 เปิด Cowork แล้วเลือกโฟลเดอร์:"
  echo "   $DEST"
  echo "================================================================"
  echo ""
  echo "🔄 Daily sync: เปิด Terminal แล้วรัน:"
  echo "   cd $DEST && git pull"
  echo ""
  echo "🚀 Deploy จาก Machine B:"
  echo "   cd $DEST && fly deploy -a g2g-ai-pool"
else
  echo ""
  echo "❌ Clone ไม่สำเร็จ — ตรวจสอบ username และชื่อ repo"
fi
