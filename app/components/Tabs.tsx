import Link from 'next/link';

/**
 * Two audiences, two views. The client report opens by default; the evidence used to reach it lives
 * behind the review tab, where an operator (or an auditor) can inspect it.
 */
export function CaseTabs({
  brandId,
  marketplace,
  active,
}: {
  brandId: string;
  marketplace: string;
  active: 'report' | 'review';
}) {
  const base = `/case/${brandId}/${marketplace}`;
  const tabs = [
    { key: 'report' as const, label: 'Client report', hint: 'What the client receives', href: base },
    {
      key: 'review' as const,
      label: 'Review',
      hint: 'Evidence, checks and history',
      href: `${base}?view=review`,
    },
  ];

  return (
    <nav className="tabs" aria-label="Case views">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`tab${active === tab.key ? ' tab--active' : ''}`}
          aria-current={active === tab.key ? 'page' : undefined}
        >
          <span className="tab__label">{tab.label}</span>
          <span className="tab__hint">{tab.hint}</span>
        </Link>
      ))}
    </nav>
  );
}
