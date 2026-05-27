#!/bin/bash
# G2G AI Pool — Machine B Setup
REPO_URL="https://github.com/woravat555/g2g-ai-pool.git"
DEST="$HOME/Desktop/g2g-ai-pool"
echo "📥 Cloning repository..."
git clone "$REPO_URL" "$DEST" && cd "$DEST" && npm install && echo "✅ Done! Open Cowork → Select Folder → $DEST"
echo ""
echo "🔄 Daily sync: cd $DEST && git pull"
echo "🚀 Deploy: cd $DEST && fly deploy -a g2g-ai-pool"
