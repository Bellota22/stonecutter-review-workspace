import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Stonecutter · Review workspace',
  description: 'Marketplace operations review of weekly client reports',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="masthead">
          <div className="brandmark">
            <strong>Stonecutter</strong>
            <span>Marketplace operations</span>
          </div>
          <div className="masthead__meta">
            <span>Reporting week 28 Sep – 4 Oct 2026</span>
            <Link href="/" className="button button--ghost">All scopes</Link>
          </div>
        </header>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
