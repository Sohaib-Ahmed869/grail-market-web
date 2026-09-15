import type { Metadata } from "next";
import Link from "next/link";
import FilterPanel from "../components/FilterPanel";
import ListingCard from "../components/ListingCard";
import {
  GAMES, LANGUAGES, PAGE_SIZE, SORTS, browse, filtersFrom, sellersFor, type Filters,
} from "../lib/market";

export const metadata: Metadata = {
  title: "Marketplace · GrailMarket",
  description: "Graded and raw trading cards for sale from Australian collectors.",
};

/* Rendered per request: listings go live and sell all day, and a cached page
   showing a card that was bought an hour ago is worse than a slower one. */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MarketPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters = filtersFrom(sp);
  const offset = Math.max(0, Math.floor(Number(Array.isArray(sp.offset) ? sp.offset[0] : sp.offset) || 0));

  const page = await browse(filters, offset);
  const listings = page?.listings ?? [];
  const sellers = await sellersFor(listings);

  const linkWith = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k));
    return `/market${p.size ? `?${p}` : ""}`;
  };

  const pills = activePills(filters);
  const from = listings.length ? offset + 1 : 0;
  const to = offset + listings.length;

  return (
    <div className="gs-wrap">
      <section className="gs-hero">
        <h1>Marketplace</h1>
        <p>Cards for sale from collectors across Australia. Make an offer in the GrailMarket app.</p>
        <form className="gs-search" action="/market" method="get" role="search">
          {Object.entries(filters).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input
            name="q"
            className="gs-field"
            placeholder="Search by card, set or number — e.g. charizard base"
            defaultValue={filters.q ?? ""}
            aria-label="Search listings"
          />
          <button type="submit" className="gs-btn gs-btn-primary" style={{ height: 52 }}>Search</button>
        </form>
      </section>

      <div className="gs-market">
        <FilterPanel filters={filters} />

        <section aria-live="polite">
          <div className="gs-results-head">
            <h2>
              {page == null
                ? "Listings unavailable"
                : listings.length
                  ? `Showing ${from}–${to}`
                  : "No listings"}
            </h2>
            <span className="gs-muted" style={{ fontSize: 14 }}>
              {SORTS.find((s) => s.id === (filters.sort ?? ""))?.label ?? "Featured"}
            </span>
          </div>

          {pills.length > 0 && (
            <div className="gs-active">
              {pills.map((p) => (
                <Link key={p.key} className="gs-pill" href={linkWith({ [p.key]: null })} aria-label={`Remove ${p.label}`}>
                  {p.label} <span aria-hidden>×</span>
                </Link>
              ))}
            </div>
          )}

          {page == null ? (
            <div className="gs-empty">
              <h3>The marketplace couldn&rsquo;t be loaded</h3>
              <p>Try again in a moment.</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="gs-empty">
              <h3>{pills.length || filters.q ? "Nothing matches those filters" : "Nothing listed yet"}</h3>
              <p>{pills.length || filters.q ? "Remove a filter or try fewer search words." : "New listings appear here as soon as they go live."}</p>
            </div>
          ) : (
            <div className="gs-grid">
              {listings.map((l) => <ListingCard key={l.listing_id} listing={l} seller={sellers.get(l.seller_id)} />)}
            </div>
          )}

          {(offset > 0 || page?.next != null) && (
            <nav className="gs-pager" aria-label="Pages">
              <Link
                className="gs-btn gs-btn-quiet"
                aria-disabled={offset === 0}
                href={linkWith({ offset: offset - PAGE_SIZE > 0 ? String(offset - PAGE_SIZE) : null })}
              >
                ← Previous
              </Link>
              <Link
                className="gs-btn gs-btn-primary"
                aria-disabled={page?.next == null}
                href={linkWith({ offset: page?.next != null ? String(page.next) : null })}
              >
                Next →
              </Link>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

function activePills(f: Filters): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (f.game) out.push({ key: "game", label: GAMES.find((g) => g.id === f.game)?.label ?? f.game });
  if (f.graded === "true") out.push({ key: "graded", label: "Graded" });
  if (f.graded === "false") out.push({ key: "graded", label: "Raw" });
  if (f.grader) out.push({ key: "grader", label: f.grader });
  if (f.grade) out.push({ key: "grade", label: `Grade ${f.grade}` });
  if (f.language) out.push({ key: "language", label: LANGUAGES.find((l) => l.id === f.language)?.label ?? f.language });
  if (f.set) out.push({ key: "set", label: f.set });
  if (f.number) out.push({ key: "number", label: `#${f.number}` });
  if (f.min) out.push({ key: "min", label: `From A$${f.min}` });
  if (f.max) out.push({ key: "max", label: `Up to A$${f.max}` });
  if (f.q) out.push({ key: "q", label: `“${f.q}”` });
  return out;
}
