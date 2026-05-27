#!/usr/bin/env bash
export PATH=$HOME/.fly/bin:/opt/homebrew/bin:$PATH
cd /Users/maew/Desktop/g2g-ai-pool
fly deploy --strategy immediate > /tmp/g2g-deploy.log 2>&1
echo "DEPLOY_DONE: $?" >> /tmp/g2g-deploy.log
