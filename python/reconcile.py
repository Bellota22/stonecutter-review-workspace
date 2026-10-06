"""Weekly source-to-mart reconciliation. JSON evidence in, evidence + quality out."""
import json
import sys
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP


def reconcile(evidence):
    evidence = dict(evidence)
    current, previous = evidence['activeSubscriptions'], evidence['previousSubscriptions']
    source_total = sum(row['activeSubscriptions'] for row in evidence['sourceSnapshots'])
    evidence['sourceTotal'] = source_total
    evidence['reconciliationDelta'] = None if current is None else current - source_total
    evidence['growthPct'] = (
        float(((Decimal(current) / Decimal(previous) - 1) * 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP))
        if current is not None and previous is not None and previous > 0 else None
    )
    imported = evidence['ingestedAt']
    age = ((datetime.fromisoformat(evidence['asOf']) - datetime.fromisoformat(imported)).total_seconds()
           if imported else float('inf'))
    recent = age <= 48 * 3600
    quality = {'status': 'ready' if recent else 'insufficient',
               'reasons': [] if recent else ['Latest import is unavailable or older than 48 hours.']}
    return {'evidence': evidence, 'quality': quality}


if __name__ == '__main__':
    json.dump(reconcile(json.load(sys.stdin)), sys.stdout, allow_nan=False)
