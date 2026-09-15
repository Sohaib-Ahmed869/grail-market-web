import { apiBase } from "../../lib/apibase";

/**
 * The public marketplace, read on the server.
 *
 * Everything here runs in a server component, so it uses `apiBase()` — the
 * server's own view of the API, read at request time — rather than the
 * browser base baked into the bundle. Nothing is signed in: these are the
 * three routes the API answers for anybody (GET /listings, GET /listings/:id,
 * GET /sellers/:id), and what they return is the public allowlist in the
 * backend's listings/publicshape.ts.
 *
 * Buying and selling stay in the app. The client deferred web selling, and a
 * member session on the web does not exist yet, so this is a shop window: it
 * shows what is for sale and hands the visitor to the app to make an offer.
 */

export type Photo = { angle: string; url: string };

export type Listing = {
  listing_id: string;
  seller_id: string;
  catalog_id: string | null;
  card_name: string;
  set_name: string | null;
  card_number: string | null;
  game: string | null;
  image_url: string | null;
  grader: string | null;
  grade: string | null;
  cert_number: string | null;
  is_raw: boolean;
  condition_note: string | null;
  price: string | number;
  currency: string;
  market_value: string | number | null;
  delivery: string[];
  suburb: string | null;
  status: string;
  photos: Photo[];
  photo_verified: boolean;
  featured: boolean;
  live_at: string | null;
  created_at: string;
};

export type Seller = {
  sellerId: string;
  name: string | null;
  avatar: string | null;
  memberSince: string | null;
  verified: boolean;
  live: number;
  sold: number;
  reputation: {
    count: number;
    average: number | null;
    recent: { stars: number; comment: string | null; createdAt: string; raterRole: string }[];
  } | null;
  metrics?: { completionRate: number | null; medianReplyHours: number | null } | null;
};

export type CertLink = { grader: string; url: string };

/** Which filters the marketplace understands — the same names GET /listings
 *  takes, so the page URL and the API call are one set of parameters. */
export const FILTER_KEYS = [
  "q", "game", "set", "number", "grader", "graded", "grade", "language", "min", "max", "sort",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;

export const PAGE_SIZE = 24;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // The API being down is shown as such by the page, not thrown as a 500.
    return null;
  }
}

export function filtersFrom(sp: Record<string, string | string[] | undefined>): Filters {
  const out: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = sp[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    if (s) out[k] = s.slice(0, 80);
  }
  return out;
}

export async function browse(filters: Filters, offset: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String(Math.max(0, offset)));
  return getJson<{ listings: Listing[]; next: number | null }>(`/listings?${p}`);
}

export async function listingById(id: string) {
  const r = await getJson<{ listing?: Listing; error?: string }>(`/listings/${encodeURIComponent(id)}`);
  return r?.listing ?? null;
}

export async function sellerById(id: string) {
  const r = await getJson<Seller & { error?: string }>(`/sellers/${encodeURIComponent(id)}`);
  return r && !r.error ? r : null;
}

/** Sellers for a page of listings, one request per distinct seller. */
export async function sellersFor(listings: Listing[]): Promise<Map<string, Seller>> {
  const ids = [...new Set(listings.map((l) => l.seller_id).filter(Boolean))];
  const found = await Promise.all(ids.map((id) => sellerById(id)));
  return new Map(found.filter((s): s is Seller => s != null).map((s) => [s.sellerId, s]));
}

/** The grading company's own register for a certificate — the API decides
 *  the URL, so the web and the app link to the same place. */
export async function certLinks(grader: string | null, cert: string | null): Promise<CertLink[]> {
  if (!grader || !cert) return [];
  const r = await getJson<{ kind?: string; links?: CertLink[] }>(
    `/market/lookup?q=${encodeURIComponent(`${grader} ${cert}`)}`,
  );
  return r?.kind === "cert" ? (r.links ?? []).filter((l) => l.grader.toUpperCase() === grader.toUpperCase()) : [];
}

// ---- display ---------------------------------------------------------------

/** A$ with cents below ten dollars and whole dollars above — the rule the app
 *  uses, so a 24-cent card is never printed as A$0. */
export function aud(n: string | number | null | undefined, currency = "AUD"): string {
  const v = Number(n);
  if (n == null || !Number.isFinite(v)) return "—";
  const symbol = currency === "AUD" ? "A$" : `${currency} `;
  const digits = Math.abs(v) < 10 ? 2 : 0;
  return `${symbol}${v.toLocaleString("en-AU", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export const GAMES: { id: string; label: string }[] = [
  { id: "pokemon", label: "Pokémon" },
  { id: "onepiece", label: "One Piece" },
  { id: "mtg", label: "Magic: The Gathering" },
  { id: "yugioh", label: "Yu-Gi-Oh!" },
  { id: "lorcana", label: "Lorcana" },
  { id: "digimon", label: "Digimon" },
  { id: "swu", label: "Star Wars Unlimited" },
  { id: "fab", label: "Flesh and Blood" },
];

export const GRADERS = ["PSA", "BGS", "CGC", "SGC", "TAG", "ACE"];

export const SORTS: { id: string; label: string }[] = [
  { id: "", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
];

export const LANGUAGES: { id: string; label: string }[] = [
  { id: "", label: "Any language" },
  { id: "en", label: "English" },
  { id: "ja", label: "Japanese" },
  { id: "other", label: "Other languages" },
];

export const gameLabel = (id: string | null) => GAMES.find((g) => g.id === id)?.label ?? null;

/** The one photograph a grid tile shows: the seller's first photo, else the
 *  catalogue picture, else nothing. The first, not the front: the browse route
 *  signs only the first photo (the bucket is private), so any other one would
 *  be a link that answers 403. */
export const coverOf = (l: Listing): string | null => l.photos?.[0]?.url ?? l.image_url ?? null;

export const gradeLabel = (l: Pick<Listing, "grader" | "grade" | "is_raw">): string =>
  l.is_raw || !l.grader ? "Raw" : `${l.grader} ${l.grade ?? ""}`.trim();
