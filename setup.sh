#!/usr/bin/env bash
# G2G AI Pool — interactive Terminal setup
# Run from the project folder: bash setup.sh
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}===========================================${NC}"
echo -e "${CYAN}  G2G AI Pool — Fly.io Setup${NC}"
echo -e "${CYAN}===========================================${NC}"

# Check flyctl
if ! command -v fly &> /dev/null; then
  echo -e "${YELLOW}flyctl not found — installing...${NC}"
  if command -v brew &> /dev/null; then
    brew install flyctl
  else
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
  fi
fi
echo -e "${GREEN}✓ flyctl ready${NC}"

# Check fly auth
if ! fly auth whoami &> /dev/null; then
  echo -e "${YELLOW}Please login to Fly.io...${NC}"
  fly auth login
fi
echo -e "${GREEN}✓ Fly.io authenticated${NC}"

# Init app if not exists
APP_NAME="g2g-ai-pool"
if ! fly status -a "$APP_NAME" &> /dev/null; then
  echo -e "${YELLOW}Creating Fly app $APP_NAME...${NC}"
  fly launch --no-deploy --copy-config --name "$APP_NAME" --region sin --yes
fi
echo -e "${GREEN}✓ Fly app ready: $APP_NAME${NC}"

# Prompt for secrets
echo -e "\n${CYAN}--- Set API Keys ---${NC}"
echo -e "${YELLOW}Paste your keys when prompted. They go directly to Fly — not stored anywhere else.${NC}\n"

read -p "Airtable PAT (from https://airtable.com/create/tokens) [pat...]: " AIRTABLE_TOKEN
read -p "Anthropic key [sk-ant-...]: " ANTHROPIC_KEY_1
read -p "OpenAI key [sk-...]: " OPENAI_KEY_1
read -p "Gemini key [AIza...]: " GEMINI_KEY_1
read -p "Perplexity key [pplx-...]: " PERPLEXITY_KEY_1
read -p "CEO alert webhook (optional, can be blank): " CEO_ALERT_WEBHOOK

echo -e "\n${YELLOW}Pushing secrets to Fly...${NC}"
fly secrets set \
  AIRTABLE_TOKEN="$AIRTABLE_TOKEN" \
  AIRTABLE_BASE="appRQwVddDxQdU6P3" \
  ANTHROPIC_KEY_1="$ANTHROPIC_KEY_1" \
  OPENAI_KEY_1="$OPENAI_KEY_1" \
  GEMINI_KEY_1="$GEMINI_KEY_1" \
  PERPLEXITY_KEY_1="$PERPLEXITY_KEY_1" \
  CEO_ALERT_WEBHOOK="$CEO_ALERT_WEBHOOK" \
  -a "$APP_NAME"

echo -e "${GREEN}✓ Secrets set${NC}"

# Deploy
echo -e "\n${YELLOW}Deploying...${NC}"
fly deploy -a "$APP_NAME"

# Verify
echo -e "\n${YELLOW}Verifying health...${NC}"
sleep 5
URL="https://${APP_NAME}.fly.dev"
HEALTH=$(curl -s "$URL/health")
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓ Health OK: $HEALTH${NC}"
else
  echo -e "${RED}✗ Health check failed: $HEALTH${NC}"
  echo "Run: fly logs -a $APP_NAME"
  exit 1
fi

# Smoke test
echo -e "\n${YELLOW}Smoke test router (uses your real keys)...${NC}"
SMOKE=$(curl -s -X POST "$URL/route" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "C001",
    "channel_key": "",
    "user_id": "U_smoke_test",
    "prompt": "ทดสอบระบบ ตอบคำว่า OK",
    "model_class": "cheap",
    "max_tokens": 50
  }')
echo "$SMOKE" | head -c 500

if echo "$SMOKE" | grep -q '"ok":true'; then
  echo -e "\n${GREEN}✓ Smoke test PASSED${NC}"
else
  echo -e "\n${RED}✗ Smoke test failed — check Airtable Usage_Log + fly logs${NC}"
fi

echo -e "\n${CYAN}===========================================${NC}"
echo -e "${GREEN}DONE!${NC}"
echo -e "Server URL:  ${CYAN}$URL${NC}"
echo -e "LINE webhook URL (replace C001 with channel_id_ext):"
echo -e "  ${CYAN}$URL/line/webhook/C001${NC}"
echo -e ""
echo -e "Next: set LINE channel tokens with:"
echo -e "  ${YELLOW}fly secrets set LINE_TOKEN_C001='YOUR_LINE_TOKEN' -a $APP_NAME${NC}"
echo -e "${CYAN}===========================================${NC}"
