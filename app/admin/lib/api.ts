"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BannerTone,
  BillingState,
  Capability,
  Confidence,
  ConflictKind,
  ConflictStatus,
  Game,
  Grader,
  Listing,
  ListingStatus,
  Member,
  MemberRole,
  MemberStatus,
  PlanKey,
  Role,
  SupportTier,
  Ticket,
  TicketPriority,
  TicketStatus,
  VerificationLevel,
  VerificationTier,
} from "./data";

/**
 * The console's client for the admin API.
 *
 * Everything goes through /api/admin, which is this app's own server holding
 * the token — see app/api/admin/[...path]/route.ts. Nothing in here knows the
 * API's address or its credential, deliberately.
 *
 * The wire shape is normalised into the same `Listing` the console already
 * draws, so `checksFor`, `flagsFor` and `overMarket` keep working against real
 * rows. Normalising at the boundary is the point: the store holds "pokemon"
 * and the console's type says "Pokémon", and exactly one place should know
 * that.
 */

/* ==========================================================================
   Wire types — what the API actually sends
   ========================================================================== */

type WireListing = {
  id: string;
  card: string;
  art?: string | null;
  setLine: string;
  game: string;
  grader: string;
  grade: string;
  labelGrade?: string | null;
  cert: string;
  askPrice: number;
  currency: string;
  marketPrice: number;
  marketSource: "comps" | "listing" | "none";
  confidence: string;
  sampleSize: number;
  tier: string;
  status: string;
  seller: {
    id: string;
    handle: string;
    name: string;
    initials: string;
    sales: number;
    rating: number;
    reviews: number;
    verified: boolean;
  };
  submitted: string;
  releasedAt?: string | null;
  reviewedBy?: string | null;
  claimedBy?: string | null;
  slaHours: number;
  photos: number;
  views: number;
  watchers: number;
  flags: string[];
  note?: string | null;
  rejectReason?: string | null;
};

export type Comp = {
  id: string;
  price: number;
  currency: string;
  soldAt: string;
  grader: string | null;
  grade: string | null;
  source: string;
  ref: string;
  /** Held out of the quoted figure. The API decides this, not the console. */
  outlier: boolean;
  why?: string;
};

export type Photo = { angle: string; url: string };

/** A decision already taken on another of this seller's listings. */
export type HistoryEntry = {
  id: string;
  card: string;
  setName: string | null;
  status: string;
  price: number;
  reason: string | null;
  by: string | null;
  at: string;
};

/** A listing as the console draws it, plus the fields only the API can know. */
export type AdminListing = Listing & {
  currency: string;
  marketSource: "comps" | "listing" | "none";
  claimedBy?: string;
  rejectReason?: string;
  sellerId: string;
  sellerVerified: boolean;
};

export type QueueCounts = {
  queue: number;
  seller: number;
  market: number;
  closed: number;
  all: number;
};

/* ==========================================================================
   Normalising
   ========================================================================== */

const GAMES: Record<string, Game> = {
  pokemon: "Pokémon",
  "pokémon": "Pokémon",
  magic: "Magic",
  mtg: "Magic",
  yugioh: "Yu-Gi-Oh!",
  "yu-gi-oh": "Yu-Gi-Oh!",
  "yu-gi-oh!": "Yu-Gi-Oh!",
  onepiece: "One Piece",
  "one piece": "One Piece",
  sports: "Sports",
};

const GRADERS: Grader[] = ["PSA", "BGS", "CGC", "SGC", "TAG", "Raw"];

const STATUSES: ListingStatus[] = [
  "awaiting", "in-review", "info-requested", "live", "sold", "paused", "withdrawn", "rejected",
];

/**
 * Card art.
 *
 * The store holds a URL from the card catalogue; the seeded fixtures held a
 * slug under public/cards. Both still arrive, so both are understood, and a
 * listing with no image at all falls through to the drawn slab rather than to
 * a broken one.
 */
function art(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  return v;
}

function normalise(w: WireListing): AdminListing {
  const game = GAMES[String(w.game ?? "").toLowerCase()] ?? "Pokémon";
  const grader = (GRADERS.find((g) => g === w.grader) ?? "Raw") as Grader;
  return {
    id: w.id,
    card: w.card,
    art: art(w.art),
    setLine: w.setLine || "Set unknown",
    game,
    grader,
    grade: w.grade,
    labelGrade: w.labelGrade ?? undefined,
    cert: w.cert,
    askPrice: w.askPrice,
    currency: w.currency,
    marketPrice: w.marketPrice,
    marketSource: w.marketSource ?? "none",
    confidence: (["high", "medium", "low"].includes(w.confidence)
      ? w.confidence
      : "low") as Confidence,
    sampleSize: w.sampleSize,
    tier: (["grail", "high-value", "standard"].includes(w.tier)
      ? w.tier
      : "standard") as VerificationTier,
    status: (STATUSES.includes(w.status as ListingStatus)
      ? w.status
      : "withdrawn") as ListingStatus,
    seller: {
      handle: w.seller.handle,
      name: w.seller.name,
      initials: w.seller.initials,
      sales: w.seller.sales,
      rating: w.seller.rating,
      reviews: w.seller.reviews,
    },
    sellerId: w.seller.id,
    sellerVerified: w.seller.verified,
    submitted: w.submitted,
    releasedAt: w.releasedAt ?? undefined,
    reviewedBy: w.reviewedBy ?? undefined,
    claimedBy: w.claimedBy ?? undefined,
    slaHours: w.slaHours,
    photos: w.photos,
    views: w.views,
    watchers: w.watchers,
    flags: Array.isArray(w.flags) ? w.flags : [],
    note: w.note ?? undefined,
    rejectReason: w.rejectReason ?? undefined,
  };
}

/* ==========================================================================
   Calling
   ========================================================================== */

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * The operator's session token.
 *
 * Held in localStorage under one key, read once at module load so the first
 * request of a page already carries it. It is the same token the app's own
 * sign-in mints — staff are members with a role — so there is nothing
 * admin-specific about it except where it is kept.
 */
const TOKEN_KEY = "gm-admin-token";

let sessionToken = "";
try {
  sessionToken = globalThis.localStorage?.getItem(TOKEN_KEY) ?? "";
} catch {
  /* private mode or blocked storage: no session, which the console handles */
}

export const sessionActive = () => Boolean(sessionToken);

export function setSessionToken(token: string | null) {
  sessionToken = token ?? "";
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* the session still works for this tab; it just will not survive a reload */
  }
}

/** Sign in. Refused unless the account holds a console role — see the route. */
export async function signIn(email: string, password: string): Promise<Me> {
  const res = await fetch("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!body || body.error) {
    throw new ApiError(body?.error ?? "bad-response", body?.message ?? `The API answered ${res.status}.`);
  }
  setSessionToken(body.token);
  return body.me as Me;
}

export function signOut() {
  setSessionToken(null);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("bad-response", `The API answered ${res.status} with something that is not JSON.`);
  }
  // The API answers 200 with an `error` key rather than an HTTP status for
  // domain refusals — a rejection with no reason is not a 400, it is an
  // answer. Both shapes end up here as the same thrown error.
  if (body?.error) throw new ApiError(body.error, body.message ?? body.error);
  if (!res.ok) throw new ApiError("http-" + res.status, `The API answered ${res.status}.`);
  return body as T;
}

const post = <T,>(path: string, body: unknown) =>
  call<T>(path, { method: "POST", body: JSON.stringify(body) });

/* ==========================================================================
   Who is signed in
   ========================================================================== */

export type Me = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  capabilities: Capability[];
  slaHours: number;
  /** True when the API is standing in for a sign-in screen it has not got. */
  devAuth?: boolean;
};

/**
 * The operator, from the API.
 *
 * This is the only place the role comes from. The console keeps its own copy
 * of the capability table so it can hide controls it knows will be refused,
 * but the copy is an interface and this is the answer.
 */
export const fetchMe = () => call<Me>("me");

export type ListingsPage = { listings: AdminListing[]; counts: QueueCounts; slaHours: number };

export async function fetchListings(q: {
  view?: string;
  search?: string;
  tier?: string;
}): Promise<ListingsPage> {
  const p = new URLSearchParams();
  if (q.view) p.set("view", q.view);
  if (q.search) p.set("q", q.search);
  if (q.tier && q.tier !== "all") p.set("tier", q.tier);
  const r = await call<{ listings: WireListing[]; counts: QueueCounts; slaHours: number }>(
    `listings?${p.toString()}`,
  );
  return { listings: r.listings.map(normalise), counts: r.counts, slaHours: r.slaHours };
}

export async function fetchListing(id: string) {
  const r = await call<{
    listing: WireListing;
    comps: Comp[];
    photos: Photo[];
    history: HistoryEntry[];
  }>(`listings/${id}`);
  return { listing: normalise(r.listing), comps: r.comps, photos: r.photos, history: r.history };
}

export const claimListing = (id: string) =>
  post<{ listing: WireListing }>(`listings/${id}/claim`, {}).then((r) => normalise(r.listing));

export const decideListing = (
  id: string,
  decision: "approve" | "reject" | "request",
  reason: string,
  note?: string,
) =>
  post<{ listing: WireListing; decidedBy: string }>(`listings/${id}/decision`, {
    decision,
    reason,
    note,
  }).then((r) => ({ listing: normalise(r.listing), decidedBy: r.decidedBy }));

export const setMarketState = (id: string, action: "pause" | "resume" | "withdraw", reason?: string) =>
  post<{ listing: WireListing }>(`listings/${id}/market`, { action, reason }).then((r) =>
    normalise(r.listing),
  );

/* ==========================================================================
   The hook the pages use
   ========================================================================== */

export type Loadable<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
};

/**
 * Load, and reload on demand.
 *
 * The reload counter rather than a bare `reload()` is what keeps a decision
 * honest: after a write the queue is re-read from the API instead of being
 * patched locally, so what is on screen is what the database says.
 */
export function useListings(q: { view: string; search: string; tier: string }): Loadable<ListingsPage> {
  const [data, setData] = useState<ListingsPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const seq = ++latest.current;
    setLoading(true);
    fetchListings(q)
      .then((r) => {
        // A slower earlier request must not overwrite a faster later one —
        // typing in the search box fires one per keystroke.
        if (seq !== latest.current) return;
        setData(r);
        setError(null);
      })
      .catch((e) => {
        if (seq !== latest.current) return;
        setError(e instanceof ApiError ? e : new ApiError("unknown", String(e)));
      })
      .finally(() => {
        if (seq === latest.current) setLoading(false);
      });
    // q is destructured so the effect keys on the values, not the object
  }, [q.view, q.search, q.tier, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

/* ==========================================================================
   Members, the team, and the conduct board
   ========================================================================== */

/** A member as the API returns them. Structurally the console's `Member`
 *  minus the fields the store cannot answer yet — see `normaliseMember`. */
type WireMember = {
  id: string;
  handle: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  status: string;
  plan: string;
  billing: string;
  verification: string;
  joined: string;
  lastSeen: string;
  lastSeenDays: number;
  country: string;
  sales: number;
  purchases: number;
  listed: number;
  liveListings: number;
  volume: number;
  rating: number;
  strikes: number;
  verifiedSeller: boolean;
  tags: string[];
  note?: string | null;
};

export type AdminMember = Member;

export type TimelineEntry = {
  kind: "listing" | "offer" | "review";
  ref: string;
  title: string;
  detail: string | null;
  at: string;
  by: string | null;
  amount: number | null;
};

export type AdminStaff = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  title: string;
  status: "active" | "restricted" | "revoked";
  since: string;
  grantedBy: string | null;
};

const MEMBER_STATUS: MemberStatus[] = ["active", "restricted", "revoked", "pending"];
const PLANS: PlanKey[] = ["none", "starter", "collector", "dealer"];
const BILLING: BillingState[] = ["active", "past-due", "cancelled", "none"];
const LEVELS: VerificationLevel[] = ["none", "mobile", "id-submitted", "id-verified"];
const MEMBER_ROLES: MemberRole[] = ["buyer", "seller", "buyer-seller", "consignor"];

/** Widen at the boundary, once, so every screen downstream has a real union
 *  rather than a string it has to guess about. Anything unrecognised falls to
 *  the safest member of its set, never the most permissive. */
function normaliseMember(w: WireMember): Member {
  const pick = <T extends string>(set: T[], v: string, fallback: T): T =>
    (set as string[]).includes(v) ? (v as T) : fallback;
  return {
    ...w,
    role: pick(MEMBER_ROLES, w.role, "buyer"),
    status: pick(MEMBER_STATUS, w.status, "pending"),
    plan: pick(PLANS, w.plan, "none"),
    billing: pick(BILLING, w.billing, "none"),
    verification: pick(LEVELS, w.verification, "none"),
    note: w.note ?? undefined,
  };
}

export async function fetchMembers(q: {
  search?: string;
  status?: string;
  plan?: string;
  verification?: string;
}): Promise<Member[]> {
  const p = new URLSearchParams();
  if (q.search) p.set("q", q.search);
  if (q.status && q.status !== "all") p.set("status", q.status);
  if (q.plan && q.plan !== "all") p.set("plan", q.plan);
  if (q.verification && q.verification !== "all") p.set("verification", q.verification);
  const r = await call<{ members: WireMember[] }>(`members?${p.toString()}`);
  return r.members.map(normaliseMember);
}

export async function fetchMember(id: string) {
  const r = await call<{ member: WireMember; timeline: TimelineEntry[] }>(`members/${id}`);
  return { member: normaliseMember(r.member), timeline: r.timeline };
}

export const setMemberStanding = (id: string, standing: string, reason: string) =>
  post<{ member: WireMember }>(`members/${id}/standing`, { standing, reason }).then((r) =>
    normaliseMember(r.member),
  );

export const annotateMember = (id: string, patch: { tags?: string[]; note?: string }) =>
  post<{ member: WireMember }>(`members/${id}/notes`, patch).then((r) => normaliseMember(r.member));

/**
 * Write to members, from the console.
 *
 * Answers with what actually happened, split three ways, because they are
 * different facts: `delivered` is how many have it in the app next time they
 * open it, `pushed` is how many had a device to interrupt, and `failed` is how
 * many got neither. A member with no device registered is a normal outcome and
 * not a failure.
 */
export const messageMembers = (memberIds: string[], subject: string, body: string) =>
  post<{ delivered: number; pushed: number; failed: number; of: number }>("members/message", {
    memberIds,
    subject,
    body,
  });

export const fetchStaff = () => call<{ staff: AdminStaff[] }>("staff").then((r) => r.staff);

export const setStaffRole = (id: string, role: Role) =>
  post<{ staff: AdminStaff[] }>(`staff/${id}/role`, { role }).then((r) => r.staff);

/**
 * Take the console role away.
 *
 * A separate call rather than `setStaffRole(id, "member")`, because `Role` is
 * the union of *console* roles and "member" is the absence of one — widening
 * the type to carry it would let "member" be offered anywhere a role is
 * chosen. At the API it is the same single write: a member is a member with a
 * role on them, so revoking is one UPDATE and there is no second record.
 */
export const revokeStaff = (id: string) =>
  post<{ staff: AdminStaff[] }>(`staff/${id}/role`, { role: "member" }).then((r) => r.staff);

/**
 * Give an existing account a console role.
 *
 * Not "invite": the console cannot create an account. A person signs up like
 * anybody else and is then granted a role — `users.role` is a column, so
 * revoking is one write and there is no second record to keep in step. An
 * address nobody has signed up with is refused by name rather than queued as
 * a pending invitation nothing will deliver.
 */
export const grantStaff = (email: string, role: Role, why?: string) =>
  post<{ staff: AdminStaff[] }>("staff/grant", { email, role, why }).then((r) => r.staff);

/* =============================================================== settings */

/** The operational knobs. Values only — the words for them live on the page,
 *  because how a threshold is worded is a rendering decision. */
export type Settings = {
  grailFloor: number;
  highValueFloor: number;
  autoClear: boolean;
  autoClearHours: number;
  sampleRate: number;
  requireCert: boolean;
  blockLowConfidence: boolean;
  minPhotos: number;
  sessionHours: number;
  pauseOnReport: boolean;
  reportWindowDays: number;
  autoEscalateHours: number;
  strikeLimit: number;
  allowRaw: boolean;
  interceptOn: boolean;
};

export const fetchSettings = () =>
  call<{ settings: Settings; canEdit: boolean }>("settings");

/** `changed` names the keys that actually moved, so the page can say what it
 *  saved rather than claiming it saved everything. */
export const saveSettings = (patch: Partial<Settings>) =>
  post<{ settings: Settings; changed: string[] }>("settings", patch);

/* ================================================================ account

   Your own account, not a member's. These go through /api/auth rather than
   /api/admin: the API reads whose password is being changed from the session
   token, which is the only thing that can answer that question.
   ======================================================================== */

async function authCall<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const out = await res.json().catch(() => null);
  if (!out || out.error) {
    throw new ApiError(out?.error ?? "bad-response", out?.message ?? `The API answered ${res.status}.`);
  }
  return out as T;
}

export const updateProfile = (patch: { name?: string; phone?: string | null }) =>
  authCall<{ user: { name: string; email: string; phone?: string | null } }>("profile", patch);

export const changePassword = (current: string, next: string) =>
  authCall<{ ok: true }>("password", { current, next });

/* ============================================================== dashboard */

export type Dashboard = {
  stats: {
    liveListings: number;
    queueDepth: number;
    breached: number;
    openReports: number;
    members: number;
  };
  money: {
    mrr: number;
    subscribers: number;
    tiers: {
      id: string;
      name: string;
      price: number;
      quota: number | null;
      subscribers: number;
      mrr: number;
    }[];
    /** This calendar month, read out of Stripe's own webhook payloads. */
    collected: number;
    failed: number;
    failedAccounts: number;
  };
  funnel: { key: string; label: string; value: number }[];
  /** Twelve weeks, GMV in thousands against verifications cleared. */
  gmv: { label: string; gmv: number; verified: number }[];
  queueMix: { label: string; value: number; color: string }[];
};

export const fetchDashboard = () => call<Dashboard>("dashboard");

/* ============================================================== attention */

/** One thing past a line, for the bell. Derived on every read — there is no
 *  admin-notification table and nothing here is dismissible. */
export type Attention = {
  key: string;
  title: string;
  count: number;
  href: string;
  tone: "bad" | "warn";
};

export const fetchAttention = () => call<{ items: Attention[] }>("attention");

/* ============================================================== audit log */

export const AUDIT_AREAS = [
  "listing",
  "member",
  "conduct",
  "support",
  "billing",
  "pricing",
  "settings",
  "staff",
] as const;

export type AuditArea = (typeof AUDIT_AREAS)[number];

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  area: AuditArea;
  action: string;
  target: string;
  detail?: string;
  weight: "high" | "normal";
};

/**
 * The log, filtered by the database.
 *
 * Every argument goes to the API rather than being applied to a bundled array:
 * the page promises seven years of retention underneath itself, and nothing
 * that long is coming down the wire to be filtered in a browser.
 */
export async function fetchAudit(q: {
  area?: string;
  actor?: string;
  weight?: string;
  search?: string;
}) {
  const p = new URLSearchParams();
  if (q.area && q.area !== "all") p.set("area", q.area);
  if (q.actor && q.actor !== "all") p.set("actor", q.actor);
  if (q.weight && q.weight !== "all") p.set("weight", q.weight);
  if (q.search) p.set("q", q.search);
  return call<{
    entries: AuditEntry[];
    actors: string[];
    totals: { all: number; high: number };
  }>(`audit?${p.toString()}`);
}

/* ========================================================== announcements */

export type AnnouncementChannel = "push" | "email" | "banner";
/* The tone is shared with the console's own vocabulary rather than restated:
   `bannerToneLabel` in data.ts is how each one is worded on screen, and two
   copies of the union is how a fourth tone gets added to one of them. */
export type { BannerTone };

export type Announcement = {
  id: string;
  title: string;
  body: string;
  channels: AnnouncementChannel[];
  audience: string;
  tone: BannerTone;
  state: "scheduled" | "sent" | "live" | "cancelled" | "taken-down";
  at: string;
  until?: string;
  by: string;
  /** How many accounts it was addressed to, counted when it went. */
  reach?: number;
  /**
   * Whether anything actually left the building.
   *
   * False until a push or email provider is wired. The console says so rather
   * than implying a member received something — "sent to 5,218" over a
   * dispatcher that does not exist is the one claim this page must not make.
   */
  delivered: boolean;
};

/** A segment and how many accounts are currently in it. `reach` is null when
 *  the API could not count it, which is not the same as nobody being in it. */
export type Audience = { key: string; reach: number | null };

export const fetchAnnouncements = () =>
  call<{ announcements: Announcement[]; banner: Announcement | null; segments: Audience[] }>(
    "announcements",
  );

export const createAnnouncement = (a: {
  title: string;
  body: string;
  channels: AnnouncementChannel[];
  audience: string;
  tone: BannerTone;
  when: "now" | "later";
  at?: string;
  until?: string;
}) => post<{ announcement: Announcement }>("announcements", a).then((r) => r.announcement);

export const setAnnouncementState = (id: string, state: "cancelled" | "taken-down") =>
  post<{ announcement: Announcement }>(`announcements/${id}/state`, { state }).then(
    (r) => r.announcement,
  );

/* ============================================================== reporting */

/**
 * One report in the catalogue, and the series behind it.
 *
 * `available` is the half that matters. A report whose source the API could
 * not read keeps its row — the catalogue says what is reported on, not what
 * happened to answer this minute — but carries no numbers, and the panel draws
 * the reason instead of a flat line at zero.
 */
export type ReportSeries = {
  id: string;
  name: string;
  detail: string;
  cadence: string;
  category: "Marketplace" | "Moderation" | "Trust and safety" | "Members";
  chart: "Area chart" | "Line chart" | "Column chart" | "Table";
  unit: "k" | "n" | "%";
  format: string;
  available: boolean;
  unavailable?: string;
  headline: string;
  headlineLabel: string;
  /** The bucket names, from the API. Days for a short period, weeks for a
   *  long one — the console does not decide this and must not assume weeks. */
  labels: string[];
  trend: number[];
};

export type ReportsPayload = {
  period: { key: string; label: string; days: number; from: string; to: string };
  kpis: {
    key: string;
    label: string;
    value: string;
    delta: { dir: "up" | "down" | "flat"; text: string } | null;
    foot: string;
    tone?: "navy" | "gold";
  }[];
  gameSplit: { label: string; value: number; amount: string }[];
  decisionSplit: { label: string; value: number; color: string }[];
  conflictOutcomes: { label: string; value: number }[];
  throughput: {
    /** Percentage decided inside the 24h target, or null when nothing was. */
    onTime: number | null;
    medianLabel: string;
    breached: number;
    decided: number;
  };
  reports: ReportSeries[];
};

/** The period keys the API understands. Sent as-is; it falls back to 30 days
 *  rather than erroring on one it does not know. */
export const REPORT_PERIODS: { key: string; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "quarter", label: "This quarter" },
  { key: "ytd", label: "Year to date" },
];

export const fetchReports = (period: string) =>
  call<ReportsPayload>(`reports?period=${encodeURIComponent(period)}`);

/* ------------------------------------------------------ reports & conduct */

export type CaseParty = {
  id: string;
  handle: string;
  name: string;
  initials: string;
  verified: boolean;
  /** Holds a console role. */
  staff: boolean;
  /** Cases previously raised against this person, this one excluded. */
  priorCases: number;
  /** When they joined. */
  joined: string | null;
};

export type AdminCase = {
  id: string;
  kind: ConflictKind;
  status: ConflictStatus;
  opened: string;
  ageHours: number;
  amount: number;
  detail: string;
  raisedBy: CaseParty;
  against: CaseParty;
  involvesStaff: boolean;
  raiserRole: string;
  listing: {
    id: string;
    card: string;
    setLine: string;
    grader: string;
    grade: string;
    art?: string;
  } | null;
  claimedBy?: string;
  outcome?: string;
  outcomeNote?: string;
  decidedBy?: string;
  decidedAt?: string;
};

export type CaseMessage = {
  id: string;
  by: string;
  byId: string;
  kind: string;
  body: string | null;
  photos: string[];
  at: string;
};

export type CaseCounts = Record<string, number>;

export async function fetchCases(state?: string, party?: string) {
  const p = new URLSearchParams();
  if (state && state !== "all") p.set("state", state);
  if (party && party !== "all") p.set("party", party);
  return call<{ cases: AdminCase[]; counts: CaseCounts }>(`cases?${p.toString()}`);
}

export async function fetchCase(id: string) {
  const r = await call<{ case: AdminCase; thread: CaseMessage[] }>(`cases/${id}`);
  return { record: r.case, thread: r.thread };
}

export const claimCase = (id: string) =>
  post<{ case: AdminCase }>(`cases/${id}/claim`, {}).then((r) => r.case);

export const setCaseState = (id: string, state: string, note?: string) =>
  post<{ case: AdminCase }>(`cases/${id}/state`, { state, note }).then((r) => r.case);

export const decideCase = (
  id: string,
  d: { outcome: string; note: string; againstId?: string },
) => post<{ case: AdminCase }>(`cases/${id}/decision`, d).then((r) => r.case);

/* ==========================================================================
   The support desk
   ========================================================================== */

type WireTicket = {
  id: string;
  subject: string;
  preview: string;
  status: string;
  priority: string;
  tier: string;
  category: string;
  member: { id: string; handle: string; name: string; initials: string; role: string };
  opened: string;
  lastReply: string;
  slaHours: number;
  answered: boolean;
  assignee?: string | null;
  listingId?: string | null;
  disputeId?: string | null;
};

export type AdminTicketMessage = {
  id: string;
  from: "member" | "admin" | "system";
  author: string;
  at: string;
  body: string;
  /** An internal note. Never sent to the member. */
  internal: boolean;
};

export type TicketContext = {
  listings: {
    id: string;
    card: string;
    grader: string | null;
    grade: string | null;
    price: number;
    status: string;
  }[];
  cases: { id: string; reason: string; status: string; at: string }[];
};

const TICKET_STATUS: TicketStatus[] = ["new", "open", "waiting", "resolved"];
const TICKET_PRIORITY: TicketPriority[] = ["urgent", "high", "normal", "low"];
const SUPPORT_TIERS: SupportTier[] = ["tier-1", "tier-2", "trust-safety"];

/** The console's `Ticket`, minus the thread — that is fetched with the record.
 *  Widened at the boundary so no screen downstream guesses at a string. */
export type AdminTicket = Omit<Ticket, "thread" | "member"> & {
  member: Ticket["member"] & { id: string };
};

function normaliseTicket(w: WireTicket): AdminTicket {
  const pick = <T extends string>(set: T[], v: string, fallback: T): T =>
    (set as string[]).includes(v) ? (v as T) : fallback;
  return {
    id: w.id,
    subject: w.subject,
    preview: w.preview,
    status: pick(TICKET_STATUS, w.status, "new"),
    priority: pick(TICKET_PRIORITY, w.priority, "normal"),
    tier: pick(SUPPORT_TIERS, w.tier, "tier-1"),
    category: w.category,
    member: {
      id: w.member.id,
      handle: w.member.handle,
      name: w.member.name,
      initials: w.member.initials,
      role: (["buyer", "seller", "buyer-seller", "consignor"] as string[]).includes(w.member.role)
        ? (w.member.role as MemberRole)
        : "buyer",
    },
    opened: w.opened,
    lastReply: w.lastReply,
    slaHours: w.slaHours,
    answered: w.answered,
    assignee: w.assignee ?? undefined,
  };
}

export async function fetchTickets(status?: string) {
  const p = new URLSearchParams();
  if (status && status !== "all") p.set("status", status);
  const r = await call<{
    tickets: WireTicket[];
    counts: Record<string, number>;
    replyTarget: Record<string, number>;
  }>(`tickets?${p.toString()}`);
  return { tickets: r.tickets.map(normaliseTicket), counts: r.counts, replyTarget: r.replyTarget };
}

export async function fetchTicket(id: string) {
  const r = await call<{
    ticket: WireTicket;
    thread: AdminTicketMessage[];
    context: TicketContext;
  }>(`tickets/${id}`);
  return { ticket: normaliseTicket(r.ticket), thread: r.thread, context: r.context };
}

export const replyToTicket = (id: string, body: string, internal = false) =>
  post<{ ticket: WireTicket; thread: AdminTicketMessage[] }>(`tickets/${id}/reply`, {
    body,
    internal,
  }).then((r) => ({ ticket: normaliseTicket(r.ticket), thread: r.thread }));

export const setTicketState = (
  id: string,
  patch: { status?: string; priority?: string; tier?: string; assign?: boolean },
) => post<{ ticket: WireTicket }>(`tickets/${id}/state`, patch).then((r) => normaliseTicket(r.ticket));

export const openTicket = (t: {
  memberId: string;
  subject: string;
  body: string;
  category?: string;
  priority?: string;
}) => post<{ ticket: WireTicket }>("tickets", t).then((r) => normaliseTicket(r.ticket));

/** One message to both sides. `delivery` is what actually happened, which is
 *  not the same as what was attempted — see `messageMembers`. */
export const messageBothParties = (id: string, body: string) =>
  post<{
    case: AdminCase;
    thread: CaseMessage[];
    delivery: { delivered: number; pushed: number; of: number };
  }>(`cases/${id}/message`, { body }).then((r) => ({
    record: r.case,
    thread: r.thread,
    delivery: r.delivery,
  }));

/* ==========================================================================
   Subscriptions and boosts

   Two different kinds of money, and neither is a commission: a plan is a
   recurring charge Stripe holds, a boost is a one-off charge for putting one
   listing in front of people. No money passes through the platform between two
   members, which is why nothing here refunds anything.
   ========================================================================== */

export type AdminPlan = {
  id: "starter" | "collector" | "dealer";
  name: string;
  blurb: string;
  /** A month, as Stripe is configured to charge. Read back from Stripe once
   *  the plan has been synced; the API's own fallback until it has. */
  price: number;
  currency: string;
  /** "month" or "year", from the Stripe price. */
  interval: string;
  /** Live listings allowed at once. null = no ceiling. */
  quota: number | null;
  perks: string[];
  /** Empty until the Stripe price is configured on the API. */
  stripePriceId: string;
  stripePriceEnv: string;
  /** The Stripe product. Editing a plan needs one. */
  stripeProductId: string;
  /** When Stripe last confirmed the figures above. Null means never — what is
   *  on screen is the API's fallback, not what anybody is charged. */
  syncedAt: string | null;
  subscribers: number;
  pastDue: number;
  cancelled: number;
  mrr: number;
  /** Months given away on this plan, all time. */
  comped: number;
};

export type BoostState = "active" | "scheduled" | "expired" | "paid-not-applied" | "comped";

export type AdminBoost = {
  id: string;
  tier: "day" | "week" | "month";
  tierName: string;
  listingId: string;
  card: string;
  userId: string;
  handle: string;
  name: string;
  amount: number;
  state: BoostState;
  purchased: string;
  appliedAt: string | null;
  expiresAt: string | null;
  stuckHours: number | null;
  fault: string | null;
  compedBy: string | null;
  compReason: string | null;
};

export type AdminBoostTier = {
  key: "day" | "week" | "month";
  name: string;
  amountCents: number;
  days: number;
  featured: boolean;
  detail: string;
};

export type BillingEventKind =
  | "subscribed"
  | "paid"
  | "payment-failed"
  | "cancelled"
  | "plan-changed"
  | "abandoned"
  | "refunded";

export type AdminBillingEvent = {
  id: string;
  kind: BillingEventKind;
  /** Stripe's own event type, for anyone who has to go and look it up. */
  type: string;
  userId: string | null;
  handle: string;
  name: string;
  planId: string | null;
  amount: number | null;
  at: string;
  reason: string | null;
};

export type Commerce = {
  plans: AdminPlan[];
  boosts: AdminBoost[];
  billing: AdminBillingEvent[];
  boostTiers: AdminBoostTier[];
  /** Whether the API can talk to Stripe at all, and whether this operator may
   *  change anything there. Without both, the plan controls are buttons that
   *  cannot work and the page says so instead of failing on the click. */
  stripe: { configured: boolean; canEdit: boolean };
};

export const fetchCommerce = () => call<Commerce>("commerce");

export const applyBoost = (id: string) =>
  post<{ boost: AdminBoost | null; daysAdded: number }>(`boosts/${id}/apply`, {});

export const compBoost = (id: string, reason: string) =>
  post<{ boost: AdminBoost | null }>(`boosts/${id}/comp`, { reason });

export const compPlan = (planId: string, memberId: string, reason: string, months = 1) =>
  post<{ plans: AdminPlan[] }>(`plans/${planId}/comp`, { memberId, reason, months });

/** Read the plans back from Stripe and refresh what the console caches.
 *  `problems` names any plan Stripe would not answer for, by name. */
export const syncPlans = () =>
  post<{ plans: AdminPlan[]; problems: string[] }>("plans/sync", {});

/**
 * Change a plan, at Stripe.
 *
 * The name and blurb are an update to the Stripe product. The price is not:
 * a Stripe price is immutable, so the API creates a new one and points the
 * product at it. Anybody already subscribed keeps the price they signed up
 * on — the confirm step says so, because it is not what "changed the price"
 * sounds like it means.
 */
export const editPlan = (
  planId: string,
  patch: { name?: string; blurb?: string; price?: number },
) => post<{ plans: AdminPlan[] }>(`plans/${planId}`, patch).then((r) => r.plans);

/* ==========================================================================
   The price engine
   ========================================================================== */

export type FeedHealth = {
  key: string;
  name: string;
  covers: string;
  status: "healthy" | "degraded" | "stale" | "down";
  lastSync: string | null;
  sinceHours: number | null;
  staleAfter: number;
  rows: number;
  rejectRate: number;
  note?: string;
};

/** One (card, grading company, grade) the engine holds a figure for. Never a
 *  grade on its own — see the API's invariant 1. */
export type GradeSet = {
  catalogId: string;
  card: string;
  setLine: string;
  game: string;
  grader: string;
  grade: string;
  price: number | null;
  /** Which currency that figure is in. Graded providers answer in USD while
   *  our own ledger is in AUD, and printing a bare $ across both is a fifty
   *  per cent error with nothing on screen to see. */
  currency: string;
  low: number | null;
  high: number | null;
  median: number | null;
  sampleSize: number;
  confidence: string;
  source: string;
  lastSaleAt: string | null;
  fetchedAt: string | null;
  ledgerSales: number;
};

/** One confirmed sale on our own ledger. Distinct from the listing queue's
 *  `Comp`, which is a market comparison rather than a ledger row. */
export type EngineComp = {
  id: string;
  catalogId: string;
  card: string;
  setLine: string;
  grader: string | null;
  grade: string | null;
  price: number;
  currency: string;
  soldAt: string;
  source: string;
  ref: string;
  rawTitle: string | null;
  excluded: boolean;
  why: string | null;
  ruledBy: string | null;
};

export type PriceEngine = { feeds: FeedHealth[]; sets: GradeSet[]; excluded: EngineComp[] };

export const fetchPriceEngine = () => call<PriceEngine>("price-engine");

export function fetchComps(catalogId: string, grader: string | null, grade: string | null) {
  const p = new URLSearchParams({ catalogId });
  // Both or neither. The API refuses a grade without a grading company, and
  // sending one anyway would only turn an invariant into an error message.
  if (grader && grade) {
    p.set("grader", grader);
    p.set("grade", grade);
  }
  return call<{ comps: EngineComp[]; median: number | null }>(`price-engine/comps?${p.toString()}`);
}

export const ruleOnComp = (saleId: string, excluded: boolean, reason: string) =>
  post<{ excluded: EngineComp[] }>(`price-engine/comps/${saleId}`, { excluded, reason });
