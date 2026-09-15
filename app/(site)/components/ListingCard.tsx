import Link from "next/link";
import { aud, coverOf, gradeLabel, type Listing, type Seller } from "../lib/market";

/** One listing in the marketplace grid: the photo, what it is, the asking
 *  price, and who is selling it. Flat white, lifted by shadow. */
export default function ListingCard({ listing: l, seller }: { listing: Listing; seller?: Seller }) {
  const cover = coverOf(l);
  const raw = l.is_raw || !l.grader;
  return (
    <Link href={`/listing/${encodeURIComponent(l.listing_id)}`} className="gs-card">
      <div className="gs-card-art">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={l.card_name} loading="lazy" />
        ) : (
          <span className="gs-card-noart">No photo yet</span>
        )}
        <span className={`gs-badge${raw ? " gs-badge-raw" : ""}`}>{gradeLabel(l)}</span>
        {l.featured && <span className="gs-featured">Featured</span>}
      </div>
      <div className="gs-card-body">
        <span className="gs-card-name">{l.card_name}</span>
        <span className="gs-card-set">
          {[l.set_name, l.card_number ? `#${l.card_number.replace(/^#/, "")}` : null].filter(Boolean).join(" · ") || " "}
        </span>
        <span className="gs-card-price">{aud(l.price, l.currency)}</span>
        {seller?.name ? (
          <span className="gs-card-seller">
            {seller.verified && <span className="gs-tick" aria-label="Identity verified seller">✓</span>}
            {seller.name}
            {l.suburb ? ` · ${l.suburb}` : ""}
          </span>
        ) : l.suburb ? (
          <span className="gs-card-seller">{l.suburb}</span>
        ) : null}
      </div>
    </Link>
  );
}
