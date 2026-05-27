#!/usr/bin/env bash
set -e
BASE=https://g2g-ai-pool.fly.dev
echo "== Issue directive =="
D=$(curl -sS -X POST $BASE/api/moac/directives \
  -H 'content-type: application/json' \
  -H 'x-api-key: moac2026' \
  -d '{"issuedBy":"moac-minister","issuedByName":"นายสุริยะ จึงรุ่งเรืองกิจ","title":"ลดต้นทุนปุ๋ย 30%","body":"ภายใน Q3 2569 ให้กรมวิชาการเกษตร กรมส่งเสริม และ ส.ป.ก. ร่วมขับเคลื่อน","category":"policy","targetLevel":["ps","dept-head"],"dueDate":"2569-09-30","priority":"urgent","kpis":[{"title":"ต้นทุนปุ๋ย","target":"30","unit":"%"}]}')
DID=$(echo "$D" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['directiveId'])")
CODE=$(echo "$D" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['code'])")
echo "DID=$DID  CODE=$CODE"
echo "== wait 50s for Claude advisory =="
sleep 50
echo "== Fetch advisory =="
curl -sS $BASE/api/moac/directives/$DID/advisory > /tmp/adv.json
python3 << PYEOF
import json
d = json.load(open('/tmp/adv.json'))
print('Status:', d.get('status'))
a = d.get('advisory')
print('Has advisory:', a is not None)
if a:
    print('Model:', a.get('ai_model'))
    an = a.get('analysis', {}) or {}
    print('Context:', (an.get('context_summary') or '')[:220])
    plans = an.get('action_plans', {}) or {}
    print('Levels:', list(plans.keys()))
    if 'dept-head' in plans:
        dh = plans['dept-head']
        print('--- dept-head plan ---')
        print('Summary:', dh.get('summary',''))
        for s in (dh.get('steps') or [])[:4]:
            print(' •', s[:130])
    print('Risks count:', len(an.get('risks',[])))
    print('Best practices:', len(an.get('best_practices',[])))
    print('Milestones:', len(an.get('milestones',[])))
    sources = (a.get('research') or {}).get('sources') or []
    print('Sources count:', len(sources))
elif d.get('hint'):
    print('Hint:', d.get('hint'))
PYEOF
