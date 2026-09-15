"use client";

import { useState } from "react";

const ANGLE: Record<string, string> = {
  front: "Front", back: "Back", label: "Label", "label-back": "Label back",
  "top-left": "Top left corner", "top-right": "Top right corner",
  "bottom-left": "Bottom left corner", "bottom-right": "Bottom right corner",
  "edge-top": "Top edge", "edge-bottom": "Bottom edge",
};

/** The seller's photographs, one large and the rest as thumbnails. */
export default function Gallery({
  photos, fallback, alt,
}: {
  photos: { angle: string; url: string }[];
  fallback: string | null;
  alt: string;
}) {
  const shots = photos.length ? photos : fallback ? [{ angle: "catalogue", url: fallback }] : [];
  const [at, setAt] = useState(0);
  const main = shots[at];

  return (
    <div>
      <div className="gs-gallery-main">
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={main.url} alt={`${alt} — ${ANGLE[main.angle] ?? "photo"}`} />
        ) : (
          <span className="gs-muted">No photos yet</span>
        )}
      </div>
      {shots.length > 1 && (
        <div className="gs-thumbs" role="list">
          {shots.map((p, i) => (
            <button
              key={`${p.angle}:${i}`}
              type="button"
              role="listitem"
              className="gs-thumb"
              aria-current={i === at}
              aria-label={ANGLE[p.angle] ?? `Photo ${i + 1}`}
              onClick={() => setAt(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {photos.length === 0 && fallback && (
        <p className="gs-note">Catalogue image shown — the seller&rsquo;s own photos are in the app.</p>
      )}
    </div>
  );
}
