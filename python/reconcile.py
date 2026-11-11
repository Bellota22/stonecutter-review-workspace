"""Weekly source-to-mart reconciliation: evidence fan-out plus fitness-for-decision checks.

The mart only knows what our import loaded. The publisher header carries control totals, so every
check below compares what we have against what the publisher declared for the same report. A week
that cannot be proven complete and comparable produces no growth figure at all -- missing or
truncated evidence is unknown, not zero.

Each check returns two strings: `detail` is the short measurement shown in the checks card, and
`limitation` is the client-facing sentence used when the check blocks a decision.
"""
import json
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

FRESHNESS_HOURS = 48


def _check(code, ok, detail, limitation=''):
    return {'code': code, 'ok': ok, 'detail': detail, 'limitation': limitation}


def _hours_since(as_of, timestamp):
    if not timestamp:
        return None
    return (datetime.fromisoformat(as_of) - datetime.fromisoformat(timestamp)).total_seconds() / 3600


def _previous_expected_end(period_start):
    return (date.fromisoformat(period_start) - timedelta(days=1)).isoformat()


def _coverage(code, report, expected_end, label):
    if not report:
        return _check(code, False, 'no report for this week',
                      '%s: no publisher report was selected for this week.' % label)
    end = str(report.get('periodEnd'))[:10]
    if report.get('status') != 'complete':
        return _check(code, False, 'partial, covers through %s (week ends %s)' % (end, expected_end),
                      '%s: the selected report is partial and covers only through %s, not the full week ending %s.'
                      % (label, end, expected_end))
    if end != expected_end:
        return _check(code, False, 'covers through %s but the week ends %s' % (end, expected_end),
                      '%s: the selected report covers through %s but the week ends %s.' % (label, end, expected_end))
    return _check(code, True, 'complete through %s' % expected_end)


def _ingestion(code, report, label):
    if not report:
        return _check(code, False, 'no report for this week', '%s: no publisher report was selected.' % label)
    loaded_offers, declared_offers = int(report.get('loadedOffers') or 0), int(report.get('declaredOfferCount') or 0)
    loaded_subs = int(report.get('loadedSubscriptions') or 0)
    declared_subs = int(report.get('declaredSubscriptions') or 0)
    if loaded_offers != declared_offers or loaded_subs != declared_subs:
        return _check(
            code, False,
            'imported %s of %s offers (%s of %s subs)' % (loaded_offers, declared_offers, loaded_subs, declared_subs),
            '%s: imported %s of %s offers (%s of %s subscriptions) from %s.'
            % (label, loaded_offers, declared_offers, loaded_subs, declared_subs, report.get('publisherReportId')))
    return _check(code, True, '%s offers and %s subs match the header' % (loaded_offers, loaded_subs))


def _matches_export(code, report, export, label):
    if export is None:
        return _check(code, False, 'the export has no current report for this week',
                      '%s: the publisher export has no current report for this week.' % label)
    if report is None:
        return _check(code, False, 'no report selected, the export has %s' % export.get('publisherReportId'),
                      '%s: no report was selected, the export has %s.' % (label, export.get('publisherReportId')))
    if report.get('publisherReportId') != export.get('publisherReportId'):
        return _check(code, False,
                      'we counted %s, the export says %s' % (report.get('publisherReportId'), export.get('publisherReportId')),
                      '%s: we counted %s, the publisher export says %s is current.'
                      % (label, report.get('publisherReportId'), export.get('publisherReportId')))
    exported, imported = int(export.get('totalSubscriptions') or 0), int(report.get('loadedSubscriptions') or 0)
    if exported != imported:
        return _check(code, False, 'the export totals %s, we imported %s' % (exported, imported),
                      '%s: the export totals %s subscriptions for %s, we imported %s.'
                      % (label, exported, export.get('publisherReportId'), imported))
    return _check(code, True, '%s match the export %s' % (imported, export.get('publisherReportId')))


def reconcile(evidence):
    ev = dict(evidence)
    current, previous = ev.get('currentReport'), ev.get('previousReport')
    expected_end = str(ev.get('expectedPeriodEnd'))[:10]
    previous_end = _previous_expected_end(str(ev.get('periodStart'))[:10])

    checks = []

    age = _hours_since(ev['asOf'], ev.get('ingestedAt'))
    fresh = age is not None and age <= FRESHNESS_HOURS
    checks.append(_check(
        'import_fresh', fresh,
        '%.1f h old (limit %d h)' % (age, FRESHNESS_HOURS) if age is not None else 'no extraction timestamp',
        '' if fresh else 'The latest import is %s hours old, beyond the %d hour limit.'
        % ('%.1f' % age if age is not None else 'an unknown number of', FRESHNESS_HOURS)))

    checks.append(_coverage('current_complete', current, expected_end, 'Current week'))
    checks.append(_coverage('previous_complete', previous, previous_end, 'Previous week'))
    checks.append(_ingestion('current_reconciled', current, 'Current week'))
    checks.append(_ingestion('previous_reconciled', previous, 'Previous week'))

    exports = ev.get('exports') or {}
    checks.append(_matches_export('current_matches_export', current, exports.get('current'), 'Current week'))
    checks.append(_matches_export('previous_matches_export', previous, exports.get('previous'), 'Previous week'))

    current_subs, previous_subs = ev.get('activeSubscriptions'), ev.get('previousSubscriptions')
    baseline = previous_subs is not None and previous_subs > 0
    checks.append(_check(
        'baseline_available', baseline,
        '%s subscriptions in the previous week' % previous_subs if baseline else 'no positive baseline',
        '' if baseline else 'The previous week has no positive baseline, so percentage change is undefined.'))

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

    failed = [c['limitation'] or c['detail'] for c in checks if not c['ok']]
    return {'evidence': ev, 'quality': {'status': 'insufficient' if failed else 'ready', 'reasons': failed}}


if __name__ == '__main__':
    json.dump(reconcile(json.load(sys.stdin)), sys.stdout, allow_nan=False)
