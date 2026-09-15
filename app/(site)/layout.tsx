import type { Metadata } from "next";
import Link from "next/link";
import "./site.css";

export const metadata: Metadata = {
  title: "GrailMarket · Marketplace",
  description: "Graded and raw trading cards for sale from verified Australian collectors.",
};

/**
 * The public site: the marketplace, a listing, and the existing scan page
 * linked from the header.
 *
 * Its own look rather than the scan page's dark theme — the brand's navy and
 * gold on a light ground, flat surfaces lifted by shadow, the same as the app
 * — and every rule scoped under `.gs` so nothing here leaks into /admin or
 * /scan, which share the root layout.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gs">
      <header className="gs-head">
        <div className="gs-wrap gs-head-row">
          <Link href="/market" className="gs-brand" aria-label="GrailMarket marketplace">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-horizontal.svg" alt="GrailMarket" height={34} />
          </Link>
          <nav className="gs-nav" aria-label="Main">
            <Link href="/market">Marketplace</Link>
            <Link href="/scan">Scan a card</Link>
          </nav>
          <a className="gs-btn gs-btn-primary gs-head-cta" href="grailmarket://">Open the app</a>
        </div>
      </header>

      <div className="gs-body">{children}</div>

      <footer className="gs-foot">
        <div className="gs-wrap gs-foot-row">
          <span>© {new Date().getFullYear()} GrailMarket</span>
          <span className="gs-muted">
            Payment and handover are arranged between buyer and seller. GrailMarket does not hold money
            and does not certify that any card is genuine.
          </span>
        </div>
      </footer>
    </div>
  );
}
