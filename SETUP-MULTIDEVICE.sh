#!/bin/bash
# =============================================================
# G2G AI Pool — Multi-Device Cowork Setup (Machine A)
# รันสคริปต์นี้บน Terminal ของ Machine A ครั้งเดียว
# =============================================================

echo "🚀 G2G Multi-Device Cowork Setup — Machine A"
echo "=============================================="

cd ~/Desktop/g2g-ai-pool

# 1. ลบ lock file ถ้ามี
if [ -f ".git/index.lock" ]; then
  echo "🔓 Removing stale git lock..."
  rm -f .git/index.lock
fi

# 2. Commit ทุกไฟล์
echo ""
echo "📦 Creating initial commit..."
git add -A
git commit -m "G2G AI Pool — Initial commit v1.0

- Multi-tenant LINE webhook (5 OAs + 11 MHESI bots)
- Agency delegation system with 7-day approval window
- Government management portals (9 agencies)
- War Room competitive intelligence
- Team bot system (8 team bots)
- Phrae province command center
- Multi-device Cowork support"

echo ""
echo "✅ Commit done!"
echo ""

# 3. ให้ user ใส่ GitHub username
read -p "🔑 GitHub username ของคุณ: " GH_USER
read -p "📁 ชื่อ repo บน GitHub (กด Enter ใช้ 'g2g-ai-pool'): " REPO_NAME
REPO_NAME=${REPO_NAME:-g2g-ai-pool}

REMOTE_URL="https://github.com/${GH_USER}/${REPO_NAME}.git"

echo ""
echo "🌐 Setting remote: $REMOTE_URL"
git remote add origin "$REMOTE_URL" 2>/dev/null || git remote set-url origin "$REMOTE_URL"

# 4. Push
echo ""
echo "⬆️  Pushing to GitHub..."
git branch -M main
git push -u origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Push สำเร็จ!"
  echo ""
  echo "================================================================"
  echo "🖥️  MACHINE B SETUP — รันคำสั่งนี้บน Machine B:"
  echo "================================================================"
  echo ""
  echo "  git clone ${REMOTE_URL}"
  echo "  cd ${REPO_NAME}"
  echo "  npm install"
  echo ""
  echo "  จากนั้นเปิด Cowork → Select Folder → เลือกโฟลเดอร์ ${REPO_NAME}"
  echo ""
  echo "================================================================"
  echo "🔄 DAILY SYNC WORKFLOW:"
  echo "================================================================"
  echo ""
  echo "  Machine A (หลังแก้ไข): git add -A && git commit -m '...' && git push"
  echo "  Machine B (ดึงอัปเดต): git pull"
  echo "  Deploy จากเครื่องไหนก็ได้:  fly deploy -a g2g-ai-pool"
  echo ""
else
  echo ""
  echo "❌ Push ไม่สำเร็จ — อาจต้องสร้าง repo บน GitHub ก่อน:"
  echo ""
  echo "  1. ไปที่ https://github.com/new"
  echo "  2. Repository name: ${REPO_NAME}"
  echo "  3. Private ✓  →  Create repository"
  echo "  4. รัน script นี้ใหม่"
fi
