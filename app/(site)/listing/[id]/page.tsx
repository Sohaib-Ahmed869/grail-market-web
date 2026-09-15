import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Gallery from "../../components/Gallery";
import {
  aud, certLinks, gameLabel, gradeLabel, listingById, sellerById,
} from "../../lib/market";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const l = await listingById(id);
  if (!l) return { title: "Listing not found · GrailMarket" };
  return {
    title: `${l.card_name} · ${gradeLabel(l)} · ${aud(l.price, l.currency)} · GrailMarket`,
    description: [l.set_name, gradeLabel(l), `Asking ${aud(l.price, l.currency)}`].filter(Boolean).join(" · "),
  };
}

/**
 * One listing, for anybody with the link.
 *
 * The API only answers for a live listing here — a reserved, sold or in-review
 * listing is visible to the people on it, and a visitor with no session is
 * none of them — so anything else is a plain 404.
 *
 * Wording follows the app's rule: nothing on this page says the card is
 * genuine. A certificate is linked to the grading company's own register for
 * the buyer to check; "verified" appears only on the SELLER, where an identity
 * check stands behind it.
 */
export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const l = await listingById(id);
  if (!l) notFound();

  const [seller, certs] = await Promise.all([
    sellerById(l.seller_id),
    l.is_raw ? Promise.resolve([]) : certLinks(l.grader, l.cert_number),
  ]);

  const raw = l.is_raw || !l.grader;
  const market = l.market_value != null && Number(l.market_value) > 0 ? Number(l.market_value) : null;
  const vsMarket = market ? Math.round(((Number(l.price) - market) / market) * 100) : null;
  const deepLink = `grailmarket://listing/${encodeURIComponent(l.listing_id)}`;
  const rating = seller?.reputation?.average != null && seller.reputation.count > 0
    ? `${seller.reputation.average.toFixed(1)} ★ from ${seller.reputation.count} rating${seller.reputation.count === 1 ? "" : "s"}`
    : "No ratings yet";

  return (
    <div className="gs-wrap">
      <div className="gs-crumb">
        <Link href="/market">Marketplace</Link> <span aria-hidden>/</span> {l.card_name}
      </div>

      <div className="gs-detail">
        <Gallery photos={l.photos ?? []} fallback={l.image_url} alt={l.card_name} />

        <div>
          <h1 className="gs-title">{l.card_name}</h1>
          <p className="gs-sub">
            {[l.set_name, l.card_number ? `#${l.card_number.replace(/^#/, "")}` : null, gameLabel(l.game)].filter(Boolean).join(" · ")}
          </p>
          <div className="gs-tags">
            <span className={`gs-tag${raw ? "" : " gs-tag-navy"}`}>{gradeLabel(l)}</span>
            {l.photo_verified && <span className="gs-tag">All angles photographed</span>}
            {l.featured && <span className="gs-tag">Featured</span>}
          </div>

          <div className="gs-panel">
            <div className="gs-price">{aud(l.price, l.currency)}</div>
            <div className="gs-price-note">
              {market
                ? `Asking price. Market value when listed ${aud(market, l.currency)}${vsMarket != null && vsMarket !== 0 ? ` (${vsMarket > 0 ? "+" : ""}${vsMarket}%)` : ""}.`
                : "Asking price. Offers are made in the app."}
            </div>
            <div className="gs-cta">
              <a className="gs-btn gs-btn-primary" href={deepLink}>Make an offer in the GrailMarket app</a>
            </div>
            <div className="gs-stores" aria-label="Get the app">
              <span className="gs-store"><span>Coming soon on the</span><b>App Store</b></span>
              <span className="gs-store"><span>Coming soon on</span><b>Google Play</b></span>
            </div>
            <p className="gs-note">
              Payment and handover are arranged between you and the seller — GrailMarket records the deal but
              does not hold money. Check the card in person before you pay.
            </p>
          </div>

          <div className="gs-panel">
            <h3>Details</h3>
            <dl className="gs-dl">
              <dt>Condition</dt>
              <dd>{raw ? "Raw (ungraded)" : `Graded ${gradeLabel(l)}`}</dd>
              {!raw && l.cert_number && (
                <>
                  <dt>Certificate</dt>
                  <dd>
                    {l.cert_number}
                    {certs.length > 0 && (
                      <>
                        {" · "}
                        {certs.map((c) => (
                          <a key={c.url} className="gs-link" href={c.url} target="_blank" rel="noopener noreferrer">
                            Check on {c.grader}&rsquo;s register
                          </a>
                        ))}
                      </>
                    )}
                  </dd>
                </>
              )}
              {l.condition_note && (
                <>
                  <dt>Seller&rsquo;s note</dt>
                  <dd>{l.condition_note}</dd>
                </>
              )}
              {l.delivery?.length > 0 && (
                <>
                  <dt>Handover</dt>
                  <dd>{l.delivery.join(", ")}</dd>
                </>
              )}
              {l.suburb && (
                <>
                  <dt>Location</dt>
                  <dd>{l.suburb}</dd>
                </>
              )}
              {l.live_at && (
                <>
                  <dt>Listed</dt>
                  <dd>{new Date(l.live_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</dd>
                </>
              )}
            </dl>
          </div>

          {seller && (
            <div className="gs-panel">
              <h3>Seller</h3>
              <div className="gs-seller">
                <div className="gs-avatar">
                  {seller.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={seller.avatar} alt="" />
                  ) : (
                    (seller.name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
                    {seller.name ?? "GrailMarket member"}
                    {seller.verified && <span className="gs-tick" aria-label="Identity verified">✓</span>}
                  </div>
                  <div className="gs-muted" style={{ fontSize: 14 }}>
                    <span className="gs-stars">{rating}</span>
                    {` · ${seller.sold} sold · ${seller.live} for sale`}
                  </div>
                  {seller.memberSince && (
                    <div className="gs-muted" style={{ fontSize: 13 }}>
                      Member since {new Date(seller.memberSince).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
                    </div>
                  )}
                </div>
              </div>
              {seller.verified && (
                <p className="gs-note">
                  Identity verified means this seller passed an ID check. It is a check on the person, not on the card.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
