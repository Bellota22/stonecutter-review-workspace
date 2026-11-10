from reconcile import reconcile


def report(status, period_end, declared, loaded=None, declared_offers=100, loaded_offers=None):
    loaded = declared if loaded is None else loaded
    loaded_offers = declared_offers if loaded_offers is None else loaded_offers
    return dict(reportId='%s-r1' % period_end, publisherReportId='pub-%s' % period_end, status=status,
                periodStart='2026-09-28' if status == 'complete' else '2026-09-21', periodEnd=period_end,
                generatedAt='%sT02:00:00+00:00' % period_end, extractedAt='%sT03:00:00+00:00' % period_end,
                declaredOfferCount=declared_offers,
                declaredSubscriptions=declared,
                loadedOffers=loaded_offers,
                loadedSubscriptions=loaded)


def example():
    return dict(activeSubscriptions=115, previousSubscriptions=100,
                sourceSnapshots=[dict(reportId='current', activeSubscriptions=115)],
                sourceReports=['current'], sourceComplete=True, sourcePeriodEnd='2026-10-04',
                previousSourceComplete=True, previousSourcePeriodEnd='2026-09-27',
                periodStart='2026-09-28', expectedPeriodEnd='2026-10-04',
                asOf='2026-10-06T12:00:00Z', ingestedAt='2026-10-06T03:00:00+00:00',
                currentReport=report('complete', '2026-10-04', 115),
                previousReport=report('complete', '2026-09-27', 100))


def test_complete_comparable_snapshots():
    result = reconcile(example())
    assert result['evidence']['growthPct'] == 15
    assert result['evidence']['sourceTotal'] == 115
    assert result['evidence']['reconciliationDelta'] == 0
    assert result['quality']['status'] == 'ready'


def test_missing_import_is_visible():
    evidence = example()
    evidence['ingestedAt'] = None
    assert reconcile(evidence)['quality']['status'] == 'insufficient'


def test_zero_baseline_has_no_percentage_growth():
    evidence = example()
    evidence['previousSubscriptions'] = 0
    assert reconcile(evidence)['evidence']['growthPct'] is None


def test_partial_current_week_has_no_comparable_growth():
    evidence = example()
    evidence['activeSubscriptions'] = 8400
    evidence['previousSubscriptions'] = 7800
    evidence['currentReport'] = report('partial', '2026-10-02', 8400)
    result = reconcile(evidence)
    assert result['evidence']['growthPct'] is None
    assert result['quality']['status'] == 'insufficient'
    assert any('partial' in reason and '2026-10-02' in reason for reason in result['quality']['reasons'])


def test_truncated_import_blocks_growth():
    evidence = example()
    evidence['previousSubscriptions'] = 5213
    evidence['previousReport'] = report('complete', '2026-09-27', 6300, loaded=5213, declared_offers=120, loaded_offers=100)
    result = reconcile(evidence)
    assert result['evidence']['growthPct'] is None
    assert result['quality']['status'] == 'insufficient'
    assert any('100 of 120' in reason for reason in result['quality']['reasons'])
    assert result['evidence']['reconciliationDelta'] == 0


def test_coverage_that_ends_early_is_not_the_week():
    evidence = example()
    evidence['currentReport'] = report('complete', '2026-10-03', 115)
    result = reconcile(evidence)
    assert result['evidence']['growthPct'] is None
    assert any('covers through 2026-10-03' in reason for reason in result['quality']['reasons'])


def test_every_check_is_reported_for_the_interface():
    result = reconcile(example())
    codes = [check['code'] for check in result['evidence']['checks']]
    assert codes == ['import_fresh', 'current_complete', 'previous_complete',
                     'current_reconciled', 'previous_reconciled', 'baseline_available']
