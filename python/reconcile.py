"""Weekly source-to-mart reconciliation: evidence fan-out plus fitness-for-decision checks.

The mart only knows what our import loaded. The publisher header carries control totals, so every
check below compares what we have against what the publisher declared for the same report. A week
that cannot be proven complete and comparable produces no growth figure at all -- missing or
truncated evidence is unknown, not zero.
"""
import json
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

FRESHNESS_HOURS = 48


def _hours_since(as_of, timestamp):
    if not timestamp:
        return None
    return (datetime.fromisoformat(as_of) - datetime.fromisoformat(timestamp)).total_seconds() / 3600


def _previous_expected_end(period_start):
    return (date.fromisoformat(period_start) - timedelta(days=1)).isoformat()


def _coverage(report, expected_end, label):
    if not report:
        return False, '%s: no report was selected for this week.' % label
    end = str(report.get('periodEnd'))[:10]
    if report.get('status') != 'complete':
        return False, '%s: the selected report is %s and covers only through %s, not the full week ending %s.' % (
            label, report.get('status'), end, expected_end)
    if end != expected_end:
        return False, '%s: the selected report covers through %s but the week ends %s.' % (label, end, expected_end)
    return True, '%s: complete coverage through %s.' % (label, expected_end)


def _ingestion(report, label):
    if not report:
        return False, '%s: no report was selected.' % label
    loaded_offers, declared_offers = int(report.get('loadedOffers') or 0), int(report.get('declaredOfferCount') or 0)
    loaded_subs = int(report.get('loadedSubscriptions') or 0)
    declared_subs = int(report.get('declaredSubscriptions') or 0)
    if loaded_offers != declared_offers or loaded_subs != declared_subs:
        return False, '%s: imported %s of %s offers (%s of %s subscriptions) from %s.' % (
            label, loaded_offers, declared_offers, loaded_subs, declared_subs, report.get('publisherReportId'))
    return True, '%s: %s offers and %s subscriptions reconcile to the publisher header.' % (
        label, loaded_offers, loaded_subs)


def _matches_export(report, export, label):
    if export is None:
        return False, '%s: the publisher export has no current report for this week.' % label
    if report is None:
        return False, '%s: no report was selected, the export has %s.' % (label, export.get('publisherReportId'))
    if report.get('publisherReportId') != export.get('publisherReportId'):
        return False, '%s: we counted %s, the publisher export says %s is current.' % (
            label, report.get('publisherReportId'), export.get('publisherReportId'))
    exported, imported = int(export.get('totalSubscriptions') or 0), int(report.get('loadedSubscriptions') or 0)
    if exported != imported:
        return False, '%s: the export totals %s subscriptions for %s, we imported %s.' % (
            label, exported, export.get('publisherReportId'), imported)
    return True, '%s: %s subscriptions match the publisher export %s.' % (label, imported, export.get('publisherReportId'))


def reconcile(evidence):
    ev = dict(evidence)
    current, previous = ev.get('currentReport'), ev.get('previousReport')
    expected_end = str(ev.get('expectedPeriodEnd'))[:10]
    previous_end = _previous_expected_end(str(ev.get('periodStart'))[:10])

    checks = []

    age = _hours_since(ev['asOf'], ev.get('ingestedAt'))
    fresh = age is not None and age <= FRESHNESS_HOURS
    checks.append({'code': 'import_fresh', 'ok': fresh,
                   'detail': 'The current import is %.1f hours old (limit %d).' % (age, FRESHNESS_HOURS) if age is not None
                   else 'The current import has no extraction timestamp.'})

    for code, report, end, label in (('current_complete', current, expected_end, 'Current week'),
                                     ('previous_complete', previous, previous_end, 'Previous week')):
        ok, detail = _coverage(report, end, label)
        checks.append({'code': code, 'ok': ok, 'detail': detail})

    for code, report, label in (('current_reconciled', current, 'Current week'),
                                ('previous_reconciled', previous, 'Previous week')):
        ok, detail = _ingestion(report, label)
        checks.append({'code': code, 'ok': ok, 'detail': detail})

    exports = ev.get('exports') or {}
    for code, report, export, label in (('current_matches_export', current, exports.get('current'), 'Current week'),
                                        ('previous_matches_export', previous, exports.get('previous'), 'Previous week')):
        ok, detail = _matches_export(report, export, label)
        checks.append({'code': code, 'ok': ok, 'detail': detail})

    current_subs, previous_subs = ev.get('activeSubscriptions'), ev.get('previousSubscriptions')
    baseline = previous_subs is not None and previous_subs > 0
    checks.append({'code': 'baseline_available', 'ok': baseline,
                   'detail': 'The previous week has a positive baseline.' if baseline
                   else 'The previous week has no positive baseline, so percentage change is undefined.'})

    comparable = all(c['ok'] for c in checks if c['code'] != 'import_fresh')
    ev['growthPct'] = (
        float(((Decimal(current_subs) / Decimal(previous_subs) - 1) * 100).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
        if comparable and current_subs is not None and previous_subs else None)

    source_total = sum(row['activeSubscriptions'] for row in ev.get('sourceSnapshots', []))
    ev['sourceTotal'] = source_total
    declared = (current or {}).get('declaredSubscriptions')
    ev['reconciliationDelta'] = (None if current_subs is None or declared is None
                                 else current_subs - int(declared))
    ev['checks'] = checks

    failed = [c['detail'] for c in checks if not c['ok']]
    return {'evidence': ev, 'quality': {'status': 'insufficient' if failed else 'ready', 'reasons': failed}}


if __name__ == '__main__':
    json.dump(reconcile(json.load(sys.stdin)), sys.stdout, allow_nan=False)
