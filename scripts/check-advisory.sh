#!/usr/bin/env bash
BASE=https://g2g-ai-pool.fly.dev
DID="$1"
[ -z "$DID" ] && { echo "usage: $0 <DID>"; exit 1; }
echo "Fetching advisory for $DID..."
curl -sS $BASE/api/moac/directives/$DID/advisory > /tmp/adv.json
python3 << PYEOF
import json
d = json.load(open('/tmp/adv.json'))
print('Status:', d.get('status'))
a = d.get('advisory')
print('Has advisory:', a is not None)
if a:
    print('Model:', a.get('ai_model'))
    print('Tokens:', a.get('tokens_used'))
    an = a.get('analysis', {}) or {}
    print('Context:', (an.get('context_summary') or '(empty)')[:240])
    plans = an.get('action_plans', {}) or {}
    print('\nLevels with plans:', list(plans.keys()))
    for level in ['ps','dept-head','dept-staff']:
        if level in plans:
            p = plans[level]
            print(f'\n--- {level} ---')
            print('Summary:', p.get('summary',''))
            for s in (p.get('steps') or [])[:3]:
                print('  •', s[:130])
    print('\nRisks count:', len(an.get('risks',[])))
    if an.get('risks'):
        r = an['risks'][0]
        print('  e.g.', r.get('risk',''), '|', r.get('mitigation','')[:80])
    print('Best practices:', len(an.get('best_practices',[])))
    if an.get('best_practices'):
        print('  e.g.', an['best_practices'][0][:120])
    print('Milestones:', len(an.get('milestones',[])))
    print('Success metrics:', len(an.get('success_metrics',[])))
    sources = (a.get('research') or {}).get('sources') or []
    print('Perplexity sources:', len(sources))
    if sources:
        print('  e.g.', sources[0].get('url','')[:80])
elif d.get('hint'):
    print('Hint:', d.get('hint'))
PYEOF
