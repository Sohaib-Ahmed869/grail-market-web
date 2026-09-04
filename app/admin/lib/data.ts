/**
 * Admin CMS sample data.
 *
 * Every export here is a stand-in for an endpoint that does not exist yet —
 * `grail-market-backend` today is identification + valuation only, with no
 * marketplace, member or moderation tables behind it. The shapes are written
 * the way the API should return them, so wiring the real thing up later is a
 * matter of replacing the constant with a fetch and keeping the type.
 *
 * Domain vocabulary follows the backend's rules: a grade always belongs to a
 * (card, grading company) pair, prices carry confidence and a sample size, and
 * nothing is quoted without saying where the figure came from.
 */

/* ==========================================================================
   Shared primitives
   ========================================================================== */

export type Grader = "PSA" | "BGS" | "CGC" | "SGC" | "TAG" | "Raw";
export type Game = "Pokémon" | "Magic" | "Yu-Gi-Oh!" | "One Piece" | "Sports";
export type Confidence = "high" | "medium" | "low";

/** How a listing is routed. Anything above the review floor stops here first. */
export type VerificationTier = "grail" | "high-value" | "standard";

/**
 * One listing's whole life, in one field.
 *
 * The first three are before it is on sale — waiting on us, open on a
 * moderator's screen, or waiting on the seller to send what was asked for.
 * There is deliberately no "approved but not yet published" state between
 * them and `live`: approving a listing is what publishes it, and a step that
 * only a human remembers to take is a step listings get stuck on.
 */
export type ListingStatus =
  | "awaiting"
  | "in-review"
  | "info-requested"
  | "live"
  | "sold"
  | "paused"
  | "withdrawn"
  | "rejected";

/**
 * What a case is about.
 *
 * These are conduct cases, not commerce disputes. No money passes through
 * Grail Market, so there is nothing here about payment, delivery or damage —
 * a member reports another member's behaviour, and the outcome lands on
 * standing rather than on funds.
 */
export type ConflictKind =
  | "not-as-described"
  | "off-platform"
  | "no-show"
  | "threats"
  | "counterfeit";

export type ConflictStatus = "open" | "awaiting-evidence" | "escalated" | "resolved";

export type MemberStatus = "active" | "restricted" | "revoked" | "pending";

/** Which subscription the member is on. `none` is a browser who never paid. */
export type PlanKey = "none" | "starter" | "collector" | "dealer";

/** What Stripe says about the subscription, which is not the same as standing. */
export type BillingState = "active" | "past-due" | "cancelled" | "none";

/**
 * How far an account got through the funnel.
 *
 * These are the same four steps the dashboard counts, and the last two are the
 * provider's decision, not ours — we hold the outcome and no documents. A
 * moderator can send an account back to `mobile`, which is what "reset
 * verification" does; nothing here can move it forward.
 */
export type VerificationLevel = "none" | "mobile" | "id-submitted" | "id-verified";

export type MemberRole = "buyer" | "seller" | "buyer-seller" | "consignor";

export type TicketStatus = "new" | "open" | "waiting" | "resolved";
export type TicketPriority = "urgent" | "high" | "normal" | "low";

/**
 * Who holds a ticket.
 *
 * Three rungs, in order. Tier 1 is the outsourced desk and sees only its own
 * queue; Tier 2 is the team lead and gets listing and trade history for the
 * ticket in hand; Trust and safety is Grail Market staff and is where conduct
 * and threats end up.
 */
export type SupportTier = "tier-1" | "tier-2" | "trust-safety";

export const supportTierLabel: Record<SupportTier, string> = {
  "tier-1": "Tier 1",
  "tier-2": "Tier 2",
  "trust-safety": "Trust & safety",
};

export const supportTierDetail: Record<SupportTier, string> = {
  "tier-1": "Outsourced desk. Their own queue only, with no ID data, no member records and no listing tools.",
  "tier-2": "Outsourced team lead. Escalations, plus listing and trade history for the ticket in hand.",
  "trust-safety": "Grail Market staff. Conduct, threats, and the ID exceptions the provider could not settle.",
};

/**
 * The ladder, in order.
 *
 * Escalation reads this and moves exactly one rung. There is deliberately no
 * way to hand a ticket sideways to another agent on the same tier: a ticket
 * that has already defeated one Tier 1 agent will defeat the next one, and
 * passing it along the row is how a member waits three days for the same
 * answer nobody at that tier can give.
 */
export const TIER_LADDER: SupportTier[] = ["tier-1", "tier-2", "trust-safety"];

/** The next rung up, or null at the top. */
export const nextTier = (t: SupportTier): SupportTier | null =>
  TIER_LADDER[TIER_LADDER.indexOf(t) + 1] ?? null;

/**
 * First-reply target, in hours, by priority.
 *
 * The clock is on the FIRST reply, not on resolution: what a member is owed
 * is an answer from a person, and a target that counted until the ticket
 * closed would reward closing it before it was solved.
 */
export const SLA_TARGET_HOURS: Record<TicketPriority, number> = {
  urgent: 1,
  high: 4,
  normal: 8,
  low: 24,
};

/* ==========================================================================
   The signed-in operator (a placeholder until auth lands)
   ========================================================================== */

/* ==========================================================================
   Marketplace rules

   Categories, the terms that stop a listing, and the words that make the
   platform look twice at a message. All three are lists a person edits, which
   is the reason they are here and not in code: the useful entry is the one
   somebody adds the morning after they see a new trick.
   ========================================================================== */

export type Category = {
  key: string;
  name: string;
  /** Off means nothing new can be listed in it; live listings are untouched. */
  live: boolean;
  /** Sub-classes the listing form offers under it. */
  kinds: string[];
  listings: number;
};

export const categories: Category[] = [
  { key: "pokemon", name: "Pokémon", live: true, kinds: ["Singles", "Sealed", "Promo"], listings: 4820 },
  { key: "magic", name: "Magic", live: true, kinds: ["Singles", "Sealed"], listings: 1541 },
  { key: "yugioh", name: "Yu-Gi-Oh!", live: true, kinds: ["Singles", "Sealed"], listings: 903 },
  { key: "onepiece", name: "One Piece", live: true, kinds: ["Singles", "Sealed"], listings: 612 },
  { key: "sports", name: "Sports", live: true, kinds: ["Singles", "Relic", "Autograph"], listings: 2288 },
  {
    key: "memorabilia",
    name: "Memorabilia",
    live: false,
    kinds: ["Signed", "Game-used"],
    listings: 0,
  },
];

/** What a matched term does. Blocking is a decision; flagging is a queue. */
export type TermAction = "block" | "flag";

export type BannedTerm = {
  term: string;
  action: TermAction;
  /** Why it is on the list — the thing a later reader always wants. */
  reason: string;
  /** Hits in the last 30 days. A rule that never fires is worth removing. */
  hits: number;
};

/**
 * Terms that stop or flag a LISTING.
 *
 * Deliberately about what is being sold, not about how someone talks. A
 * listing that says "proxy" is describing a card we do not sell; a message
 * that says "bank transfer" is a different problem, handled below.
 */
export const bannedTerms: BannedTerm[] = [
  { term: "proxy", action: "block", reason: "Not a real card. The single most common counterfeit listing word.", hits: 41 },
  { term: "custom", action: "flag", reason: "Sometimes a legitimate art card, usually not. Worth a human.", hits: 126 },
  { term: "replica", action: "block", reason: "Explicitly a copy.", hits: 18 },
  { term: "reprint", action: "flag", reason: "Legitimate for some sets, misleading for others.", hits: 73 },
  { term: "not authentic", action: "block", reason: "Says so itself.", hits: 4 },
  { term: "psa ready", action: "flag", reason: "Implies a grade the card does not carry.", hits: 55 },
  { term: "gem mint (raw)", action: "flag", reason: "A grade claim on an ungraded card.", hits: 31 },
];

/**
 * The off-platform chat interceptor.
 *
 * A member asking another to settle direct is the single highest-harm thing
 * that happens in messages: it strips the identity check off both sides, and
 * once it is off-platform there is nothing anyone here can do. The list is
 * words, not intent, so it over-matches on purpose — the action for most of
 * it is a warning to the sender rather than a block, and only the payment
 * rails hold a message for review.
 */
export type InterceptAction = "warn" | "hold" | "escalate";

export const interceptActionLabel: Record<InterceptAction, string> = {
  warn: "Warn the sender",
  hold: "Hold for review",
  escalate: "Escalate to Trust & safety",
};

export type InterceptTerm = {
  term: string;
  action: InterceptAction;
  group: "payment" | "contact" | "intent";
  hits: number;
};

export const interceptTerms: InterceptTerm[] = [
  { term: "bank transfer", action: "hold", group: "payment", hits: 88 },
  { term: "paypal", action: "hold", group: "payment", hits: 214 },
  { term: "payid", action: "hold", group: "payment", hits: 167 },
  { term: "venmo", action: "hold", group: "payment", hits: 12 },
  { term: "cash app", action: "hold", group: "payment", hits: 9 },
  { term: "direct deposit", action: "hold", group: "payment", hits: 44 },
  { term: "whatsapp", action: "warn", group: "contact", hits: 301 },
  { term: "instagram", action: "warn", group: "contact", hits: 288 },
  { term: "telegram", action: "warn", group: "contact", hits: 51 },
  { term: "my number is", action: "warn", group: "contact", hits: 96 },
  { term: "off platform", action: "escalate", group: "intent", hits: 27 },
  { term: "avoid the fees", action: "escalate", group: "intent", hits: 63 },
  { term: "cut out the middleman", action: "escalate", group: "intent", hits: 19 },
];

/**
 * Listing fees.
 *
 * The brief says "once they are agreed", and they have not been — so the
 * numbers are here, editable, and switched off. Shipping a fee schedule that
 * is live by default because somebody typed a placeholder into it is the
 * failure this flag exists to prevent.
 */
export const listingFees = {
  agreed: false,
  /** AUD, charged per listing beyond the allowance. */
  perListing: 1.5,
  /** Free listings per member per calendar month, before the fee applies. */
  freeAllowance: 5,
  /** Whether the allowance resets monthly or is a lifetime grant. */
  resets: "monthly" as "monthly" | "once",
  /** Fees never apply below this ask — a $4 card cannot carry a $1.50 fee. */
  floor: 25,
};

/* ==========================================================================
   Audit log

   Who did what, and when. Every decision in this console lands here, and the
   entries are append-only: an action that can be edited afterwards is not a
   record of anything.
   ========================================================================== */

/* The audit log used to live here: a seeded array, a session array, and a
   `logAudit` that appended to it. It is now a table the API owns and writes
   on every real action — see `admin_audit` and GET /admin/audit. A
   client-side copy could only ever hold what this one tab had done, which is
   the opposite of what an audit log is for. */

/* --------------------------------------------------------------------------
   Roles

   The five in the operations brief, and nothing else. Support is split into
   two tiers because the outsourcing argument depends on it: a Tier 1 agent
   sitting offshore can be given a queue without being given the member
   directory, the ID exceptions or the listing tools, and that separation is
   the whole reason the desk can be run by people outside the company.
   -------------------------------------------------------------------------- */

export type Role = "tier-1" | "tier-2" | "moderator" | "trust-safety" | "owner";

export const ROLES: {
  key: Role;
  label: string;
  /** Who actually holds it, from the brief's table. */
  who: string;
  /** What it sees, in the same words the brief uses. */
  sees: string;
}[] = [
  {
    key: "tier-1",
    label: "Support · Tier 1",
    who: "Outsourced team",
    sees: "Their own queue only. No ID data, no member records, no listing tools.",
  },
  {
    key: "tier-2",
    label: "Support · Tier 2",
    who: "Outsourced team lead",
    sees: "Escalations, plus listing and trade history for the ticket in hand.",
  },
  {
    key: "moderator",
    label: "Moderator",
    who: "Grail Market",
    sees: "Listing queue: approve, reject, ask for more photos. No billing, no ID.",
  },
  {
    key: "trust-safety",
    label: "Trust & safety",
    who: "Grail Market",
    sees: "Reports, conduct outcomes, and the ID exceptions the provider could not settle.",
  },
  {
    key: "owner",
    label: "Owner",
    who: "Grail Market",
    sees: "Everything, including subscriptions, the price engine and the audit log.",
  },
];

export const roleLabel = (r: Role) => ROLES.find((x) => x.key === r)?.label ?? r;

/**
 * What a role is allowed to do.
 *
 * Capabilities rather than page names, because the same page shows different
 * things to different people: a moderator opens a member record and must not
 * see the plan or the verification level on it, which is a rule about fields,
 * not about routes.
 */
export type Capability =
  | "dashboard.read"
  | "listings.review"
  | "members.read"
  | "members.act"
  | "team.read"
  | "conduct.decide"
  | "support.read"
  | "support.reply"
  | "id.exceptions"
  | "billing.read"
  | "pricing.read"
  | "reports.read"
  | "audit.read"
  | "announce.write"
  | "settings.write";

const CAPABILITIES: Record<Role, Capability[]> = {
  "tier-1": ["support.read", "support.reply"],
  /* Tier 2 gets trade context inside a ticket — see `support.read` in the
     support desk — but still no member directory of its own. */
  "tier-2": ["support.read", "support.reply"],
  moderator: ["dashboard.read", "listings.review", "members.read"],
  "trust-safety": [
    "dashboard.read",
    "members.read",
    "members.act",
    "conduct.decide",
    "support.read",
    "support.reply",
    "id.exceptions",
  ],
  owner: [
    "dashboard.read",
    "listings.review",
    "members.read",
    "members.act",
    "team.read",
    "conduct.decide",
    "support.read",
    "support.reply",
    "id.exceptions",
    "billing.read",
    "pricing.read",
    "reports.read",
    "audit.read",
    "announce.write",
    "settings.write",
  ],
};

/**
 * What each permission is called on screen.
 *
 * The keys are for the code; nobody using this console should ever be shown
 * `listings.review` and asked to work out what it means.
 */
export const capabilityLabel: Record<Capability, string> = {
  "dashboard.read": "See the dashboard",
  "listings.review": "Review the listing queue",
  "members.read": "Open member records",
  "members.act": "Change a member's standing",
  "team.read": "See the admin team",
  "conduct.decide": "Decide reports and conduct cases",
  "support.read": "Work the support queue",
  "support.reply": "Reply to members",
  "id.exceptions": "See ID check outcomes",
  "billing.read": "See subscriptions and boosts",
  "pricing.read": "See the price engine",
  "reports.read": "See reports",
  "audit.read": "See the audit log",
  "announce.write": "Send announcements",
  "settings.write": "Change settings",
};

export const can = (role: Role, c: Capability) => CAPABILITIES[role].includes(c);

/** Everything a role may reach, for the "your scope is" panel. */
export const capabilitiesOf = (role: Role) => CAPABILITIES[role];

/**
 * Which capability each route needs.
 *
 * IMPORTANT: this gates the interface, not the data. Hiding a route in the
 * browser stops an agent wandering into a page they have no business in; it
 * does not stop anyone who can type a URL and read a network response. The
 * same table has to exist on the API before any of this is a security
 * boundary, and until the admin API exists there is nothing to put it in.
 */
export const ROUTE_CAPABILITY: { path: string; param?: [string, string]; cap: Capability }[] = [
  { path: "/admin/listings", cap: "listings.review" },
  { path: "/admin/conflicts", cap: "conduct.decide" },
  { path: "/admin/support", cap: "support.read" },
  { path: "/admin/members", param: ["scope", "team"], cap: "team.read" },
  { path: "/admin/members", cap: "members.read" },
  { path: "/admin/pricing", cap: "billing.read" },
  { path: "/admin/price-engine", cap: "pricing.read" },
  { path: "/admin/audit", cap: "audit.read" },
  { path: "/admin/announcements", cap: "announce.write" },
  { path: "/admin/reports", cap: "reports.read" },
  { path: "/admin/settings", cap: "settings.write" },
  { path: "/admin", cap: "dashboard.read" },
];

/** Where to send someone who has no business on the page they opened. */
export const homeFor = (role: Role): { href: string; label: string } =>
  can(role, "dashboard.read")
    ? { href: "/admin", label: "Dashboard" }
    : { href: "/admin/support", label: "your support queue" };

export const operator = {
  name: "Ayna Sulaiman",
  email: "ayna.sulaiman@calcite.live",
  role: "owner" as Role,
  initials: "AS",
};

/* ==========================================================================
   Dashboard
   ========================================================================== */

export type Stat = {
  key: string;
  label: string;
  value: string;
  delta?: { dir: "up" | "down" | "flat"; text: string };
  foot?: string;
  tone?: "navy" | "gold" | "plain";
};

export const dashboardStats: Stat[] = [
  {
    key: "pending",
    label: "Awaiting verification",
    value: "18",
    delta: { dir: "up", text: "+5" },
    foot: "6 breach SLA within 4h",
    tone: "navy",
  },
  {
    key: "gmv",
    label: "GMV · last 30 days",
    value: "$412,880",
    delta: { dir: "up", text: "11.4%" },
    foot: "vs. $370,600 prior period",
    tone: "gold",
  },
  {
    key: "conflicts",
    label: "Open conduct cases",
    value: "4",
    delta: { dir: "down", text: "2" },
    foot: "1 with Trust and safety",
  },
  {
    key: "members",
    label: "Active members",
    value: "6,412",
    delta: { dir: "up", text: "3.2%" },
    foot: "38 restricted · 11 revoked",
  },
];

/** 12 weeks of GMV against the count of verifications cleared. */
export const gmvSeries = [
  { label: "W1", gmv: 61, verified: 24 },
  { label: "W2", gmv: 68, verified: 31 },
  { label: "W3", gmv: 59, verified: 27 },
  { label: "W4", gmv: 74, verified: 35 },
  { label: "W5", gmv: 81, verified: 33 },
  { label: "W6", gmv: 77, verified: 39 },
  { label: "W7", gmv: 92, verified: 44 },
  { label: "W8", gmv: 88, verified: 41 },
  { label: "W9", gmv: 103, verified: 48 },
  { label: "W10", gmv: 114, verified: 52 },
  { label: "W11", gmv: 108, verified: 47 },
  { label: "W12", gmv: 127, verified: 58 },
];

/* Tokens, not literal hex: a slice painted #1a2632 disappeared against the
   dark theme's surface, and so did its key in the legend. */
/* Tier names only. The thresholds used to ride along in the label, which a
   legend column 70px wide could only truncate — and the tier chips on every
   other page already carry the same three names. */
export const queueMix = [
  { label: "Grail tier", value: 6, color: "var(--navy-500)" },
  { label: "High value", value: 12, color: "var(--gold)" },
  { label: "Standard", value: 143, color: "var(--gold-300)" },
];

/* --------------------------------------------------------------------------
   Subscriptions

   The three plans as they are actually sold — A$5 Starter, A$10 Collector,
   A$20 Dealer — carrying the same identities and listing quotas as
   `grail-market-backend/src/billing/plans.ts`, which is the only place today
   that gets them right. The pricing page still holds an older, different set;
   correcting that is its own job, so this lives beside it rather than
   rewriting it from underneath.
   -------------------------------------------------------------------------- */

export type SubscriptionTier = {
  key: "starter" | "collector" | "dealer";
  name: string;
  /** Monthly, in AUD. Stripe holds the amount that is actually charged. */
  price: number;
  /**
   * Live listings allowed at once. null = no ceiling.
   *
   * This is the enforcement point, and the reason a plan exists at all — the
   * sell flow checks it before publishing. It is deliberately a quota and not
   * a commission rate: Grail Market takes no cut of a sale, because no money
   * passes through it.
   */
  quota: number | null;
  blurb: string;
  perks: string[];
  /** Empty until billing is configured — Stripe holds the charged amount. */
  stripePriceId: string;
  subscribers: number;
  /** The same headcount a month ago, so movement can be stated, not implied. */
  priorSubscribers: number;
  /** A token, not a literal — see the note on `queueMix`. */
  color: string;
};

/**
 * The three plans, as `grail-market-backend/src/billing/plans.ts` has them.
 *
 * That file is the source of truth — it is what the sell flow enforces — and
 * this is the console's mirror of it. They were allowed to disagree once: the
 * admin console carried a free Collector, a $39 Dealer and a custom House
 * tier priced on commission, none of which existed anywhere else. A plan
 * table nobody can act on is worse than no plan table, because a support
 * agent reads it and quotes it.
 */
export const subscriptionTiers: SubscriptionTier[] = [
  {
    key: "starter",
    name: "Starter",
    price: 5,
    quota: 1,
    blurb: "One live listing at a time.",
    perks: ["One live listing", "Unlimited price checks", "Save a collection"],
    stripePriceId: "STRIPE_PRICE_STARTER",
    subscribers: 2840,
    priorSubscribers: 2612,
    color: "var(--gold-300)",
  },
  {
    key: "collector",
    name: "Collector",
    price: 10,
    quota: 10,
    blurb: "Up to 10 live listings.",
    perks: [
      "Everything in Starter",
      "10 live listings",
      "Bulk scan up to 25 cards",
      "Priority support",
    ],
    stripePriceId: "STRIPE_PRICE_COLLECTOR",
    subscribers: 1663,
    priorSubscribers: 1498,
    color: "var(--gold)",
  },
  {
    key: "dealer",
    name: "Dealer",
    price: 20,
    quota: null,
    blurb: "Unlimited listings + featured credits.",
    perks: [
      "Everything in Collector",
      "Unlimited live listings",
      "Featured listing credits",
    ],
    stripePriceId: "STRIPE_PRICE_DEALER",
    subscribers: 402,
    priorSubscribers: 371,
    color: "var(--navy-500)",
  },
];

/* --------------------------------------------------------------------------
   Subscription arithmetic

   The price engine's fixtures, the boost ledger and the billing feed used to
   live here as sample data. All three are read from the API now — see
   `lib/api.ts` — and the copies were deleted rather than left beside them, so
   there is no second set of figures for a page to drift back onto.
   -------------------------------------------------------------------------- */

/** How many times a failed charge is retried, and when. Policy rather than
 *  sample data: it is what the ladder on the billing tab describes. */
export const DUNNING_LADDER = ["Immediately", "After 3 days", "After 5 days", "After 7 days"];

/** What a tier bills in a month at today's headcount. */
export const mrrOf = (t: SubscriptionTier) => t.price * t.subscribers;

export const totalMrr = subscriptionTiers.reduce((s, t) => s + mrrOf(t), 0);

export const priorMrr = subscriptionTiers.reduce(
  (s, t) => s + t.price * t.priorSubscribers,
  0
);

export const totalSubscribers = subscriptionTiers.reduce((s, t) => s + t.subscribers, 0);

/**
 * Cash against the month's billing, which is not the same number as MRR.
 *
 * A card that fails, a plan an agent comped and a mid-month start all move
 * what was collected and leave MRR untouched — that gap is the reason both
 * figures are on the dashboard instead of one standing in for the other.
 */
export const subscriptionRevenue = {
  /** Settled this month. `collected + failed` is the month's MRR. */
  collected: 37_860,
  failed: 1_010,
  /** Accounts sitting in dunning behind that figure. */
  failedAccounts: 92,
};

/* --------------------------------------------------------------------------
   Verification funnel

   Where a new account stops on its way to being able to trade. The last two
   steps are the provider's decision rather than ours — we hold "verified or
   not verified" and no documents — so these are counts of outcomes returned
   to us, never of anything we store.
   -------------------------------------------------------------------------- */

export type FunnelStage = { key: string; label: string; value: number };

/** Last 30 days, one cohort followed through. */
export const verificationFunnel: FunnelStage[] = [
  { key: "created", label: "Account created", value: 1284 },
  { key: "mobile", label: "Mobile confirmed", value: 1102 },
  { key: "submitted", label: "ID submitted", value: 806 },
  { key: "approved", label: "ID approved", value: 731 },
];

export type ActivityItem = {
  id: string;
  tone: "ok" | "warn" | "bad" | "gold" | "plain";
  icon: "check" | "alert" | "ban" | "card" | "message" | "shield";
  text: string;
  actor: string;
  time: string;
};

export const activity: ActivityItem[] = [
  {
    id: "a1",
    tone: "ok",
    icon: "check",
    text: "Verified **1999 Base Set Charizard · PSA 10** and released it to the listing queue",
    actor: "Ayna Sulaiman",
    time: "12 minutes ago",
  },
  {
    id: "a2",
    tone: "bad",
    icon: "ban",
    text: "Revoked access for **@vault_flipper** after three authenticity strikes in 30 days",
    actor: "Ayna Sulaiman",
    time: "48 minutes ago",
  },
  {
    id: "a3",
    tone: "warn",
    icon: "alert",
    text: "Case **CF-2291** escalated to Trust and safety after 72 hours open with no finding",
    actor: "System",
    time: "1 hour ago",
  },
  {
    id: "a4",
    tone: "gold",
    icon: "card",
    text: "**2003 LeBron James Topps Chrome · BGS 9.5** entered grail-tier review at $14,200",
    actor: "System",
    time: "2 hours ago",
  },
  {
    id: "a5",
    tone: "plain",
    icon: "message",
    text: "Replied to support ticket **SP-1180** about an off-platform contact warning",
    actor: "Marco Reyes",
    time: "3 hours ago",
  },
  {
    id: "a6",
    tone: "ok",
    icon: "shield",
    text: "Case **CF-2287** closed with a formal warning against **@galar_pc** for off-platform contact",
    actor: "Ayna Sulaiman",
    time: "5 hours ago",
  },
  {
    id: "a7",
    tone: "warn",
    icon: "alert",
    text: "**@cardsbyjules** rejected. Slab label photo unreadable, resubmission requested",
    actor: "Priya Nandakumar",
    time: "6 hours ago",
  },
];

/* ==========================================================================
   Listing queue

   One record for a listing's whole life, from the moment a seller submits it
   to the day it leaves the market.

   It used to be two: a `Submission` a moderator verified, and a `Listing`
   that then had to be published. That split put half of one queue on one
   page and half on another, and made "approved" and "on sale" two separate
   acts a human had to remember to perform in order. The feature set asks for
   one thing — every new listing is read by a human before it goes live — so
   approving a listing publishes it, and one status field says where in that
   life the record currently sits.
   ========================================================================== */

export type Listing = {
  id: string;
  card: string;
  /** Slug under `public/cards/`; absent means the drawn slab stands in. */
  art?: string;
  setLine: string;
  game: Game;
  grader: Grader;
  /** The grade as the seller stated it. */
  grade: string;
  /**
   * What the slab label actually reads, where our own read of the label
   * macro disagrees with the seller. Absent means the two matched.
   */
  labelGrade?: string;
  /** The grading company's certificate number; "—" for a raw card. */
  cert: string;
  /** What the seller is asking. */
  askPrice: number;
  /** What the price engine quotes. 0 = too few comparable sales to say. */
  marketPrice: number;
  confidence: Confidence;
  sampleSize: number;
  tier: VerificationTier;
  status: ListingStatus;
  seller: {
    handle: string;
    name: string;
    initials: string;
    sales: number;
    rating: number;
    /** Reviews left by counterparties — the count behind the rating. */
    reviews: number;
  };
  submitted: string;
  /** Set when it was approved. Absent while it is still in the queue. */
  releasedAt?: string;
  /** Who approved it. Absent on a standard-tier listing that auto-cleared. */
  reviewedBy?: string;
  /** Hours left on the review target. Negative is over. */
  slaHours: number;
  /** Angles the seller supplied. Under `MIN_ANGLES` raises a flag. */
  photos: number;
  views: number;
  watchers: number;
  /** Free text from a moderator. Rule-raised flags are derived, not stored. */
  flags: string[];
  note?: string;
};

/** Waiting on a decision from us, or on a reply from the seller. */
export const IN_QUEUE: ListingStatus[] = ["awaiting", "in-review", "info-requested"];

/** Waiting on us specifically — the ones a moderator can actually decide. */
export const DECIDABLE: ListingStatus[] = ["awaiting", "in-review"];

export const listings: Listing[] = [
  {
    id: "LS-9051",
    card: "Charizard #4",
    art: "pokemon-charizard",
    setLine: "1999 Base Set · Unlimited · Holo",
    game: "Pokémon",
    grader: "PSA",
    grade: "10",
    cert: "PSA 88214417",
    askPrice: 18500,
    marketPrice: 17250,
    confidence: "high",
    sampleSize: 34,
    tier: "grail",
    status: "awaiting",
    seller: { handle: "@holo_vault", name: "Daniel Wu", initials: "DW", sales: 214, rating: 4.9, reviews: 198 },
    submitted: "2026-08-31T09:12:00Z",
    slaHours: 3,
    photos: 6,
    views: 0,
    watchers: 0,
    flags: ["First grail-tier listing from this seller"],
  },
  {
    id: "LS-9050",
    card: "LeBron James #111",
    setLine: "2003 Topps Chrome · Rookie Refractor",
    game: "Sports",
    grader: "BGS",
    grade: "9.5",
    cert: "BGS 0016482991",
    askPrice: 14200,
    marketPrice: 13100,
    confidence: "high",
    sampleSize: 21,
    tier: "grail",
    status: "in-review",
    seller: { handle: "@courtsidecards", name: "Marcus Hale", initials: "MH", sales: 512, rating: 4.8, reviews: 471 },
    submitted: "2026-08-31T07:40:00Z",
    slaHours: 5,
    photos: 4,
    views: 0,
    watchers: 0,
    flags: ["Subgrades not visible in the photos supplied"],
    note: "Asked the seller for a straight-on shot of the subgrade block.",
  },
  {
    id: "LS-9048",
    card: "Black Lotus",
    art: "magic-black-lotus",
    setLine: "1993 Alpha · Unlimited border check pending",
    game: "Magic",
    grader: "CGC",
    grade: "8.5",
    cert: "CGC 4128866003",
    askPrice: 26900,
    marketPrice: 24400,
    confidence: "medium",
    sampleSize: 9,
    tier: "grail",
    status: "awaiting",
    seller: { handle: "@alphaonly", name: "Rosa Iqbal", initials: "RI", sales: 76, rating: 5.0, reviews: 71 },
    submitted: "2026-08-31T05:02:00Z",
    slaHours: 1,
    photos: 8,
    views: 0,
    watchers: 0,
    flags: ["Alpha vs Beta border needs manual confirmation"],
  },
  {
    id: "LS-9045",
    card: "Pikachu Illustrator",
    art: "pokemon-pikachu",
    setLine: "1998 Promo · CoroCoro contest",
    game: "Pokémon",
    grader: "PSA",
    grade: "7",
    cert: "PSA 61099437",
    askPrice: 172000,
    marketPrice: 0,
    confidence: "low",
    sampleSize: 2,
    tier: "grail",
    status: "info-requested",
    seller: { handle: "@kanto_archive", name: "Yuki Tanaka", initials: "YT", sales: 31, rating: 4.7, reviews: 28 },
    submitted: "2026-08-30T22:18:00Z",
    slaHours: -4,
    photos: 11,
    views: 0,
    watchers: 0,
    flags: ["Provenance documents requested"],
    note: "Waiting on the 2021 auction house invoice before this can move.",
  },
  {
    id: "LS-9042",
    card: "Monkey D. Luffy · Leader Parallel",
    setLine: "OP-01 Romance Dawn · Manga Rare",
    game: "One Piece",
    grader: "PSA",
    grade: "10",
    cert: "PSA 90441208",
    askPrice: 4850,
    marketPrice: 4600,
    confidence: "high",
    sampleSize: 47,
    tier: "high-value",
    status: "awaiting",
    seller: { handle: "@grandline_gr", name: "Sofia Marchetti", initials: "SM", sales: 148, rating: 4.9, reviews: 133 },
    submitted: "2026-08-30T18:55:00Z",
    slaHours: 8,
    photos: 12,
    views: 0,
    watchers: 0,
    flags: [],
  },
  {
    id: "LS-9039",
    card: "Blue-Eyes White Dragon",
    art: "yugioh-blue-eyes",
    setLine: "2002 LOB · 1st Edition · North America",
    game: "Yu-Gi-Oh!",
    grader: "BGS",
    grade: "9",
    /* The seller stated 9; our read of the label macro says 8.5. */
    labelGrade: "8.5",
    cert: "BGS 0014220875",
    askPrice: 3400,
    marketPrice: 2950,
    confidence: "medium",
    sampleSize: 14,
    tier: "high-value",
    status: "in-review",
    seller: { handle: "@duelistdepot", name: "Amir Farooq", initials: "AF", sales: 89, rating: 4.6, reviews: 77 },
    submitted: "2026-08-30T14:30:00Z",
    slaHours: 12,
    photos: 4,
    views: 0,
    watchers: 0,
    flags: [],
  },
  {
    id: "LS-9036",
    card: "Umbreon VMAX #215",
    art: "pokemon-umbreon",
    setLine: "2021 Evolving Skies · Alt Art Secret",
    game: "Pokémon",
    grader: "PSA",
    grade: "10",
    cert: "PSA 79554120",
    askPrice: 2280,
    marketPrice: 2210,
    confidence: "high",
    sampleSize: 126,
    tier: "high-value",
    status: "live",
    seller: { handle: "@moonbreon_co", name: "Elena Petrova", initials: "EP", sales: 366, rating: 5.0, reviews: 341 },
    submitted: "2026-08-29T11:20:00Z",
    releasedAt: "2026-08-29T12:02:00Z",
    reviewedBy: "Ayna Sulaiman",
    slaHours: 0,
    photos: 12,
    views: 1840,
    watchers: 96,
    flags: [],
    note: "Cert matched PSA's register, photos consistent with the label.",
  },
  {
    id: "LS-9034",
    card: "Giannis Antetokounmpo #340",
    setLine: "2013 Panini Prizm · Rookie",
    game: "Sports",
    grader: "PSA",
    grade: "10",
    cert: "PSA 74008812",
    askPrice: 6900,
    marketPrice: 6450,
    confidence: "high",
    sampleSize: 58,
    tier: "grail",
    status: "live",
    seller: { handle: "@courtsidecards", name: "Marcus Hale", initials: "MH", sales: 512, rating: 4.8, reviews: 471 },
    submitted: "2026-08-28T20:15:00Z",
    releasedAt: "2026-08-29T09:41:00Z",
    reviewedBy: "Marco Reyes",
    slaHours: 0,
    photos: 11,
    views: 2210,
    watchers: 141,
    flags: [],
  },
  {
    id: "LS-9032",
    card: "Mox Sapphire",
    art: "magic-mox-sapphire",
    setLine: "1993 Beta · Border verified",
    game: "Magic",
    grader: "BGS",
    grade: "8",
    cert: "BGS 0011903447",
    askPrice: 9750,
    marketPrice: 9900,
    confidence: "high",
    sampleSize: 17,
    tier: "grail",
    status: "live",
    seller: { handle: "@alphaonly", name: "Rosa Iqbal", initials: "RI", sales: 76, rating: 5.0, reviews: 71 },
    submitted: "2026-08-30T18:40:00Z",
    releasedAt: "2026-08-31T08:10:00Z",
    reviewedBy: "Ayna Sulaiman",
    slaHours: 0,
    photos: 10,
    views: 340,
    watchers: 22,
    flags: [],
  },
  {
    id: "LS-9028",
    card: "Lugia #9",
    art: "pokemon-lugia",
    setLine: "2000 Neo Genesis · 1st Edition Holo",
    game: "Pokémon",
    grader: "CGC",
    grade: "9.5",
    cert: "CGC 4009122188",
    askPrice: 3120,
    marketPrice: 3050,
    confidence: "high",
    sampleSize: 31,
    tier: "high-value",
    status: "live",
    seller: { handle: "@johto_grails", name: "Takumi Kondo", initials: "TK", sales: 143, rating: 4.8, reviews: 126 },
    submitted: "2026-08-28T09:05:00Z",
    releasedAt: "2026-08-28T16:20:00Z",
    reviewedBy: "Priya Nandakumar",
    slaHours: 0,
    photos: 10,
    views: 980,
    watchers: 54,
    flags: [],
  },
  {
    id: "LS-9024",
    card: "Shohei Ohtani #660",
    setLine: "2018 Topps Update · Rookie Debut",
    game: "Sports",
    grader: "PSA",
    grade: "10",
    cert: "PSA 68221904",
    askPrice: 1420,
    marketPrice: 1390,
    confidence: "high",
    sampleSize: 92,
    tier: "high-value",
    status: "sold",
    seller: { handle: "@pacificrim_pc", name: "Hana Nakamura", initials: "HN", sales: 208, rating: 4.9, reviews: 190 },
    submitted: "2026-08-23T18:30:00Z",
    releasedAt: "2026-08-24T10:00:00Z",
    reviewedBy: "Marco Reyes",
    slaHours: 0,
    photos: 10,
    views: 3410,
    watchers: 202,
    flags: [],
  },
  {
    id: "LS-9019",
    card: "Roronoa Zoro · Parallel",
    setLine: "OP-02 Paramount War",
    game: "One Piece",
    grader: "PSA",
    grade: "9",
    cert: "PSA 90118840",
    askPrice: 640,
    marketPrice: 610,
    confidence: "high",
    sampleSize: 64,
    tier: "standard",
    status: "live",
    seller: { handle: "@grandline_gr", name: "Sofia Marchetti", initials: "SM", sales: 148, rating: 4.9, reviews: 133 },
    submitted: "2026-08-27T11:10:00Z",
    releasedAt: "2026-08-27T13:55:00Z",
    slaHours: 0,
    photos: 10,
    views: 512,
    watchers: 18,
    flags: [],
  },
  {
    id: "LS-9014",
    card: "Dark Magician Girl",
    art: "yugioh-dark-magician-girl",
    setLine: "2003 MFC · 1st Edition Secret Rare",
    game: "Yu-Gi-Oh!",
    grader: "BGS",
    grade: "9",
    cert: "BGS 0013774209",
    askPrice: 2050,
    marketPrice: 1980,
    confidence: "high",
    sampleSize: 44,
    tier: "high-value",
    status: "paused",
    seller: { handle: "@duelistdepot", name: "Amir Farooq", initials: "AF", sales: 89, rating: 4.6, reviews: 77 },
    submitted: "2026-08-21T15:40:00Z",
    releasedAt: "2026-08-22T08:30:00Z",
    reviewedBy: "Ayna Sulaiman",
    slaHours: 0,
    photos: 10,
    views: 1105,
    watchers: 63,
    flags: [],
    note: "Paused by the seller while they are away.",
  },
  {
    id: "LS-9008",
    card: "Blastoise #2",
    art: "pokemon-blastoise",
    setLine: "1999 Base Set · Shadowless Holo",
    game: "Pokémon",
    grader: "PSA",
    grade: "9",
    cert: "PSA 55401277",
    askPrice: 5400,
    marketPrice: 5250,
    confidence: "high",
    sampleSize: 27,
    tier: "grail",
    status: "withdrawn",
    seller: { handle: "@vault_flipper", name: "Chris Doyle", initials: "CD", sales: 12, rating: 3.4, reviews: 9 },
    submitted: "2026-08-18T12:00:00Z",
    releasedAt: "2026-08-18T19:12:00Z",
    reviewedBy: "Priya Nandakumar",
    slaHours: 0,
    photos: 10,
    views: 760,
    watchers: 27,
    flags: [],
    note: "Pulled when the seller's account was restricted.",
  },
  {
    id: "LS-9002",
    card: "Mickey Mantle #311",
    setLine: "1952 Topps · Reprint suspected",
    game: "Sports",
    grader: "Raw",
    grade: "None",
    cert: "None",
    askPrice: 41000,
    marketPrice: 0,
    confidence: "low",
    sampleSize: 0,
    tier: "grail",
    status: "rejected",
    seller: { handle: "@vault_flipper", name: "Chris Doyle", initials: "CD", sales: 12, rating: 3.4, reviews: 9 },
    submitted: "2026-08-28T16:05:00Z",
    reviewedBy: "Ayna Sulaiman",
    slaHours: 0,
    photos: 9,
    views: 0,
    watchers: 0,
    flags: ["Print dot pattern inconsistent with 1952 stock", "Third authenticity strike"],
    note: "Rejected. Escalated to member review, then access revoked.",
  },
];

/* --------------------------------------------------------------------------
   The automatic checks

   Every flag on a listing is worked out here rather than stored on the
   record. A stored flag goes stale the moment the seller adds the angle you
   asked for, and the two the feature set names — the angle count, and the
   slab label against the stated grade — are both things the row already
   knows.

   `checksFor` returns the whole set, passes included: a reviewer needs to
   see that a check ran and cleared, not infer it from an absent warning.
   `flagsFor` is the failing subset, which is what a table cell, a tile and a
   queue count want.
   -------------------------------------------------------------------------- */

/**
 * Ten angles: front, back, all four slab edges, all four corners. Under that
 * a crack or a re-seal can sit outside every frame, which is the one thing a
 * photo set exists to rule out.
 */
export const MIN_ANGLES = 10;

/** An ask this far over the quoted market figure is worth pointing at. */
export const OVER_MARKET_PCT = 10;

export type ListingCheck = {
  key: string;
  /** What the check tests, phrased so it reads the same either way. */
  rule: string;
  passed: boolean;
  /** The finding, when it failed. */
  label: string;
  detail: string;
  tone: "bad" | "warn";
  /** Raised by a rule, as against typed by a moderator. */
  automatic: boolean;
};

/** How far the ask sits above the market figure, or null if there isn't one. */
export const overMarket = (l: Listing) =>
  l.marketPrice > 0 ? (l.askPrice / l.marketPrice - 1) * 100 : null;

export function checksFor(l: Listing): ListingCheck[] {
  const over = overMarket(l);

  const out: ListingCheck[] = [
    {
      key: "angles",
      rule: `${MIN_ANGLES} angles supplied`,
      passed: l.photos >= MIN_ANGLES,
      label: `${l.photos} of ${MIN_ANGLES} angles`,
      detail: `Front, back, four slab edges and four corners are required. ${Math.max(
        0,
        MIN_ANGLES - l.photos
      )} still missing.`,
      tone: "bad",
      automatic: true,
    },
    {
      key: "label",
      rule: "Slab label matches the stated grade",
      passed: !l.labelGrade || l.labelGrade === l.grade,
      label: `Label reads ${l.grader} ${l.labelGrade ?? l.grade}`,
      detail: `The label macro reads ${l.grader} ${
        l.labelGrade ?? l.grade
      } against a stated grade of ${l.grader} ${
        l.grade
      }. Check the cert against the register before this goes anywhere.`,
      tone: "bad",
      automatic: true,
    },
    {
      key: "price",
      rule: `Ask within ${OVER_MARKET_PCT}% of market`,
      passed: over === null || over < OVER_MARKET_PCT,
      label: over === null ? "No market figure to check against" : `Ask sits ${Math.round(over)}% over market`,
      detail:
        over === null
          ? "Too few comparable sales to quote a figure at all."
          : `Measured against the price engine's figure, from ${l.sampleSize} comparable ${l.grader} ${l.grade} sales.`,
      tone: "warn",
      automatic: true,
    },
    {
      key: "confidence",
      rule: "Price confidence above low",
      passed: l.confidence !== "low",
      label: "The quoted price cannot be confirmed",
      detail: `${l.sampleSize} comparable sale${
        l.sampleSize === 1 ? "" : "s"
      } on record. A figure is withheld rather than guessed.`,
      tone: "warn",
      automatic: true,
    },
  ];

  /* A moderator's own note is a finding, not a rule — it has no passing
     state, so it only ever appears as something that failed. */
  for (const f of l.flags) {
    out.push({
      key: f,
      rule: f,
      passed: false,
      label: f,
      detail: "Raised by a moderator on review.",
      tone: "warn",
      automatic: false,
    });
  }

  return out;
}

/** Only the checks that failed — what a row, a tile and a count want. */
export const flagsFor = (l: Listing) => checksFor(l).filter((c) => !c.passed);

/* --------------------------------------------------------------------------
   The member record

   Where a decision lands. A rejection reason that only raises a toast has
   not been written anywhere, which was the whole complaint: the seller is
   told a reason, and nothing keeps it. Until the admin API exists this is
   that store — seeded history plus an append-only list of what this session
   decided, read back by handle.
   -------------------------------------------------------------------------- */

/**
 * Everything that can land on a member's record.
 *
 * The record is meant to be the whole history in one place — listings,
 * offers, trades, reviews, tickets and conduct — so the union covers all six
 * rather than only the decisions this console happens to take. `plan` and
 * `verification` are here because changing either is an admin action a member
 * can be told about later, and an action nobody can point to is not one.
 */
export type MemberEventKind =
  | "listing-approved"
  | "listing-rejected"
  | "info-requested"
  | "listing-live"
  | "offer"
  | "trade"
  | "review"
  | "ticket"
  | "conduct"
  | "plan"
  | "boost"
  | "verification"
  | "note";

/** How each kind reads in a filter, and which side of the record it is on. */
export const eventKindLabel: Record<MemberEventKind, string> = {
  "listing-approved": "Listing approved",
  "listing-rejected": "Listing rejected",
  "info-requested": "Information requested",
  "listing-live": "Listing live",
  offer: "Offer",
  trade: "Trade",
  review: "Review",
  ticket: "Ticket",
  conduct: "Conduct action",
  plan: "Plan change",
  boost: "Boost",
  verification: "Verification",
  note: "Staff note",
};

/**
 * The groups the timeline filter offers.
 *
 * Six buttons, not twelve: a moderator asks "what did they sell" or "has this
 * one been in trouble", never "show me info-requested only".
 */
export const eventGroups: { key: string; label: string; kinds: MemberEventKind[] }[] = [
  {
    key: "listings",
    label: "Listings",
    kinds: ["listing-approved", "listing-rejected", "info-requested", "listing-live"],
  },
  { key: "trades", label: "Offers & trades", kinds: ["offer", "trade"] },
  { key: "reviews", label: "Reviews", kinds: ["review"] },
  { key: "tickets", label: "Tickets", kinds: ["ticket"] },
  { key: "conduct", label: "Conduct", kinds: ["conduct"] },
  { key: "account", label: "Account", kinds: ["plan", "boost", "verification", "note"] },
];

export type MemberEvent = {
  id: string;
  at: string;
  /** Whose record this is written to. */
  handle: string;
  kind: MemberEventKind;
  title: string;
  /** The reason, word for word, where the decision carried one. */
  detail?: string;
  by: string;
  /** The listing it came from. */
  ref?: string;
};

const seededEvents: MemberEvent[] = [
  /* ---------------------------------------------------- @courtsidecards */
  {
    id: "EV-2044",
    at: "2026-08-31T08:05:00Z",
    handle: "@courtsidecards",
    kind: "conduct",
    title: "Case escalated to Trust and safety",
    detail: "CF-2291 open past 72 hours with no finding. Listings remain paused.",
    by: "System",
    ref: "CF-2291",
  },
  {
    id: "EV-2043",
    at: "2026-08-28T16:02:00Z",
    handle: "@courtsidecards",
    kind: "conduct",
    title: "Reported by @bucks_collector: not as described",
    detail: "Buyer says the slab brought to the meet was a PSA 9, not the listed PSA 10.",
    by: "System",
    ref: "CF-2291",
  },
  {
    id: "EV-2042",
    at: "2026-08-27T11:20:00Z",
    handle: "@courtsidecards",
    kind: "review",
    title: "Review received: 2 stars",
    detail: "“Card was fine but he argued about the meeting point for two days.”",
    by: "@nrg_cards",
  },

  /* ------------------------------------------------------ @moonbreon_co */
  {
    id: "EV-2041",
    at: "2026-08-29T12:02:00Z",
    handle: "@moonbreon_co",
    kind: "listing-approved",
    title: "Listing approved: Umbreon VMAX #215",
    by: "Ayna Sulaiman",
    ref: "LS-9036",
  },
  {
    id: "EV-2040",
    at: "2026-08-29T09:14:00Z",
    handle: "@moonbreon_co",
    kind: "trade",
    title: "Trade completed: Charizard VMAX #020",
    detail: "$8,400 · met in person, both sides confirmed.",
    by: "System",
    ref: "LS-8974",
  },
  {
    id: "EV-2039",
    at: "2026-08-28T19:35:00Z",
    handle: "@moonbreon_co",
    kind: "review",
    title: "Review received: 5 stars",
    detail: "“Exactly as described, packed properly, straightforward to deal with.”",
    by: "@galar_pc",
  },
  {
    id: "EV-2036",
    at: "2026-08-26T13:02:00Z",
    handle: "@moonbreon_co",
    kind: "offer",
    title: "Offer received: $6,100 on Lugia #9",
    detail: "Declined by the seller. Asking was $7,400.",
    by: "@neo_era",
    ref: "LS-9036",
  },
  {
    id: "EV-2035",
    at: "2026-07-04T10:00:00Z",
    handle: "@moonbreon_co",
    kind: "plan",
    title: "Plan changed: Collector to Dealer",
    detail: "Upgraded by the member. Live-listing ceiling lifted.",
    by: "System",
  },

  /* ------------------------------------------------------ @vault_flipper */
  {
    id: "EV-2038",
    at: "2026-08-28T17:41:00Z",
    handle: "@vault_flipper",
    kind: "conduct",
    title: "Access revoked",
    detail: "Third authenticity strike inside 30 days. Escalated to member review.",
    by: "Ayna Sulaiman",
  },
  {
    id: "EV-2037",
    at: "2026-08-28T16:44:00Z",
    handle: "@vault_flipper",
    kind: "listing-rejected",
    title: "Listing rejected: Mickey Mantle #311",
    detail:
      "The print dot pattern is inconsistent with 1952 Topps stock. Do not relist this card without a grading company's opinion.",
    by: "Ayna Sulaiman",
    ref: "LS-9002",
  },
  {
    id: "EV-2034",
    at: "2026-08-25T14:10:00Z",
    handle: "@vault_flipper",
    kind: "ticket",
    title: "Ticket opened: “Why was my listing pulled?”",
    detail: "Answered by Tier 1, escalated to Trust and safety the same day.",
    by: "Marco Reyes",
    ref: "SP-1171",
  },

  /* ------------------------------------------------------ @duelistdepot */
  {
    id: "EV-2033",
    at: "2026-08-27T09:18:00Z",
    handle: "@duelistdepot",
    kind: "listing-rejected",
    title: "Listing rejected: Dark Magician Girl (first submission)",
    detail: "Only four angles supplied. Ten are required, including all four corners.",
    by: "Marco Reyes",
  },
  {
    id: "EV-2032",
    at: "2026-08-26T12:00:00Z",
    handle: "@duelistdepot",
    kind: "conduct",
    title: "Restricted: listing privileges paused",
    detail: "Two reports of coordinated bidding on their own listings. Buying unaffected.",
    by: "Ayna Sulaiman",
  },
  {
    id: "EV-2031",
    at: "2026-08-30T07:22:00Z",
    handle: "@duelistdepot",
    kind: "ticket",
    title: "Ticket opened: “Cannot list, account says restricted”",
    detail: "Explained the restriction and what closes it.",
    by: "Marco Reyes",
    ref: "SP-1190",
  },
  {
    id: "EV-2024",
    at: "2026-08-22T08:30:00Z",
    handle: "@duelistdepot",
    kind: "listing-approved",
    title: "Listing approved: Dark Magician Girl",
    by: "Ayna Sulaiman",
    ref: "LS-9014",
  },

  /* ------------------------------------------------------ @pacificrim_pc */
  {
    id: "EV-2030",
    at: "2026-08-30T09:06:00Z",
    handle: "@pacificrim_pc",
    kind: "conduct",
    title: "Reported by @nrg_cards: no-show",
    detail: "Agreed a meet, did not attend, stopped replying. 72h to answer.",
    by: "System",
    ref: "CF-2289",
  },
  {
    id: "EV-2029",
    at: "2026-08-24T10:00:00Z",
    handle: "@pacificrim_pc",
    kind: "listing-approved",
    title: "Listing approved: Shohei Ohtani #660",
    by: "Marco Reyes",
    ref: "LS-9024",
  },
  {
    id: "EV-2028",
    at: "2026-08-12T06:40:00Z",
    handle: "@pacificrim_pc",
    kind: "plan",
    title: "Payment failed: Collector",
    detail: "Card declined. Third attempt scheduled; access unchanged while it retries.",
    by: "System",
  },

  /* -------------------------------------------------------- @holo_vault */
  {
    id: "EV-2027",
    at: "2026-08-31T06:10:00Z",
    handle: "@holo_vault",
    kind: "conduct",
    title: "Report upheld against @galar_pc",
    detail: "Their report of off-platform contact was upheld. No action against this account.",
    by: "Ayna Sulaiman",
    ref: "CF-2287",
  },
  {
    id: "EV-2026",
    at: "2026-08-26T10:00:00Z",
    handle: "@holo_vault",
    kind: "ticket",
    title: "Ticket opened: “Buyer asking to settle direct”",
    detail: "Correct escalation. Screenshots attached to the case.",
    by: "Ayna Sulaiman",
    ref: "SP-1194",
  },
  {
    id: "EV-2025",
    at: "2026-08-21T15:25:00Z",
    handle: "@holo_vault",
    kind: "trade",
    title: "Trade completed: Blastoise #2",
    detail: "$5,400 · shipped, delivery confirmed by the buyer.",
    by: "System",
    ref: "LS-9008",
  },

  /* ------------------------------------------------------ @kanto_archive */
  {
    id: "EV-2023",
    at: "2026-08-30T11:15:00Z",
    handle: "@kanto_archive",
    kind: "ticket",
    title: "Ticket opened: “Grail-tier review open five days”",
    detail: "Second reviewer required at this value. 48h commitment given.",
    by: "Ayna Sulaiman",
    ref: "SP-1192",
  },
  {
    id: "EV-2022",
    at: "2026-08-24T09:00:00Z",
    handle: "@kanto_archive",
    kind: "info-requested",
    title: "Information requested: Pikachu Illustrator",
    detail: "Auction invoice and chain of ownership since 2021.",
    by: "Ayna Sulaiman",
    ref: "VF-4815",
  },
  {
    id: "EV-2021",
    at: "2026-08-19T08:00:00Z",
    handle: "@kanto_archive",
    kind: "verification",
    title: "ID submitted to the provider",
    detail: "Awaiting the DVS result. No documents held on our side.",
    by: "System",
  },
  {
    id: "EV-2019",
    at: "2026-08-20T14:12:00Z",
    handle: "@kanto_archive",
    kind: "note",
    title: "Staff note",
    detail:
      "High-value consignor, slow to answer. Give provenance requests the full seven days before expiring them.",
    by: "Priya Nandakumar",
  },

  /* ------------------------------------------------------ @sunsetbinder */
  {
    id: "EV-2018",
    at: "2026-06-02T09:00:00Z",
    handle: "@sunsetbinder",
    kind: "plan",
    title: "Payment failed: Starter",
    detail: "Second failure. Plan prompt emailed; no reply.",
    by: "System",
  },
  {
    id: "EV-2017",
    at: "2026-05-01T09:00:00Z",
    handle: "@sunsetbinder",
    kind: "listing-live",
    title: "Last listing went live: Pikachu VMAX #044",
    detail: "Expired unsold after 30 days. Nothing listed since.",
    by: "System",
  },

  /* -------------------------------------------------------- @johto_grails */
  {
    id: "EV-2016",
    at: "2026-08-30T18:41:00Z",
    handle: "@johto_grails",
    kind: "conduct",
    title: "Reported by @neo_era: threats",
    detail: "Routed straight to Trust and safety. Messaging between the two accounts closed.",
    by: "System",
    ref: "CF-2288",
  },
  {
    id: "EV-2015",
    at: "2026-08-14T11:05:00Z",
    handle: "@johto_grails",
    kind: "review",
    title: "Review received: 5 stars",
    detail: "“Knows the Neo sets better than anyone. Would buy again.”",
    by: "@neo_era",
  },
];

/** Written during this session. Newest first, ahead of the seeded history. */
const sessionEvents: MemberEvent[] = [];

/**
 * Append to a member's record.
 *
 * Returns the entry so the caller can show exactly what was filed, rather
 * than a paraphrase of it in a toast.
 */
export function writeToRecord(e: Omit<MemberEvent, "id" | "at">): MemberEvent {
  const entry: MemberEvent = {
    ...e,
    id: `EV-${9000 + sessionEvents.length}`,
    at: new Date().toISOString(),
  };
  sessionEvents.unshift(entry);

  /* This no longer writes to the audit log. The log is a table the API owns
     and writes itself on every real action; an entry appended here would
     exist only in this tab, and a moderator checking the log after a decision
     taken anywhere else would not find it. The member record below is still a
     fixture, and goes the same way when the dashboard is wired. */

  return entry;
}

/** One member's record, newest first. */
export const recordFor = (handle: string) =>
  [...sessionEvents, ...seededEvents].filter((e) => e.handle === handle);

/* --------------------------------------------------------------------------
   Tags, and the fields a moderator can change

   Same shape as the event store above and for the same reason: there is no
   admin API yet, so a change made here has to live somewhere the next render
   can read it back. Overrides are keyed by handle and layered over the
   fixture, so a member the session never touched still reads straight from
   `members`.
   -------------------------------------------------------------------------- */

type MemberOverride = {
  tags?: string[];
  plan?: PlanKey;
  verification?: VerificationLevel;
};

const overrides = new Map<string, MemberOverride>();

/** The member as it stands now — fixture underneath, session changes on top. */
export function memberNow(m: Member): Member {
  const o = overrides.get(m.handle);
  return o ? { ...m, ...o } : m;
}

export const tagsFor = (m: Member) => memberNow(m).tags;

export function setTags(handle: string, tags: string[]) {
  overrides.set(handle, { ...overrides.get(handle), tags });
}

export function setPlan(handle: string, plan: PlanKey) {
  overrides.set(handle, { ...overrides.get(handle), plan });
}

export function setVerification(handle: string, verification: VerificationLevel) {
  overrides.set(handle, { ...overrides.get(handle), verification });
}

/**
 * Tags already in use, for the suggestion list.
 *
 * Free text with a datalist rather than a fixed vocabulary: the useful labels
 * are the ones a moderator invents mid-case, and a closed list would send
 * them back to the note field to say it in prose where nothing can find it.
 */
export const knownTags = () => {
  const all = new Set<string>();
  for (const m of members) for (const t of memberNow(m).tags) all.add(t);
  return [...all].sort();
};

/* --------------------------------------------------------------------------
   Segments

   Who to look at, and who to send something to. Each one is a predicate over
   the member list so the same definition drives the filter bar and the
   audience count on a message — a segment that means one thing on screen and
   another in the send dialog is worse than no segment at all.
   -------------------------------------------------------------------------- */

/** Not seen for this long and they count as lapsed. */
export const LAPSED_DAYS = 90;

export type Segment = {
  key: string;
  label: string;
  /** Shown under the filter so the definition is never guessed at. */
  detail: string;
  match: (m: Member) => boolean;
};

export const segments: Segment[] = [
  {
    key: "all",
    label: "Everyone",
    detail: "Every record in the directory.",
    match: () => true,
  },
  {
    key: "lapsed",
    label: "Lapsed",
    detail: `Not seen in ${LAPSED_DAYS} days or more, and not revoked.`,
    match: (m) => m.lastSeenDays >= LAPSED_DAYS && m.status !== "revoked",
  },
  {
    key: "never-listed",
    label: "Never listed",
    detail: "Has never published a listing, however long they have been here.",
    match: (m) => m.listed === 0,
  },
  {
    key: "unverified",
    label: "Stuck in verification",
    detail: "Started the funnel and never came out of it.",
    match: (m) => memberNow(m).verification !== "id-verified",
  },
  {
    key: "billing",
    label: "Billing needs attention",
    detail: "Payment failed or the subscription was cancelled.",
    match: (m) => m.billing === "past-due" || m.billing === "cancelled",
  },
  {
    key: "at-risk",
    label: "At risk",
    detail: "Carrying a strike, restricted, or reported and still open.",
    match: (m) => m.strikes > 0 || m.status === "restricted",
  },
];

/* --------------------------------------------------------------------------
   Comms

   Push and email to a segment. Templates are the three the brief names, and
   each one says which channel it is actually suited to — a policy change that
   goes out as a push notification and nowhere else has not been sent.
   -------------------------------------------------------------------------- */

export type CommsTemplate = {
  key: string;
  label: string;
  /** What it is for, in the sender's words. */
  detail: string;
  subject: string;
  body: string;
  channels: ("push" | "email")[];
};

export const commsTemplates: CommsTemplate[] = [
  {
    key: "digest",
    label: "Price-alert digest",
    detail: "Weekly movement on the cards they watch. The one people opt into.",
    subject: "This week on your watchlist",
    body: "Three cards you follow moved more than 5% this week. Open Grail Market to see the comparable sales behind each figure.",
    channels: ["push", "email"],
  },
  {
    key: "plan",
    label: "Plan prompt",
    detail: "For members at their listing ceiling, or with a failed payment.",
    subject: "You are at your listing limit",
    body: "Your plan allows a set number of live listings at once. Upgrading lifts the ceiling immediately; nothing you have already listed is affected.",
    channels: ["push", "email"],
  },
  {
    key: "policy",
    label: "Policy change",
    detail: "Email only. A rule change has to be readable later, not swiped away.",
    subject: "A change to the Grail Market rules",
    body: "We are changing how reports and conduct cases are handled. The full text is on the policy page; this email is the record that you were told.",
    channels: ["email"],
  },
];


/* ==========================================================================
   Conflict resolution
   ========================================================================== */

export type ConflictEvent = {
  at: string;
  by: string;
  side: "buyer" | "seller" | "admin" | "system";
  text: string;
};

export type Conflict = {
  id: string;
  kind: ConflictKind;
  status: ConflictStatus;
  opened: string;
  /**
   * What the trade between the two was worth. Context for how serious the
   * case is — nothing is held against it, because nothing passes through us.
   */
  amount: number;
  /** Whose conduct is being reported. The outcome lands on this account. */
  against: "buyer" | "seller";
  listing: { id: string; card: string; setLine: string; grader: Grader; grade: string; game: Game; art?: string };
  buyer: { handle: string; name: string; initials: string; joined: string; disputes: number };
  seller: { handle: string; name: string; initials: string; joined: string; disputes: number };
  buyerClaim: string;
  sellerClaim: string;
  evidence: { label: string; from: "buyer" | "seller"; kind: "photo" | "document" | "tracking" }[];
  timeline: ConflictEvent[];
  ageHours: number;
};

export const conflicts: Conflict[] = [
  {
    id: "CF-2291",
    kind: "not-as-described",
    status: "escalated",
    opened: "2026-08-28T14:20:00Z",
    amount: 6900,
    against: "seller",
    listing: {
      id: "LS-9041",
      card: "Giannis Antetokounmpo #340",
      setLine: "2013 Panini Prizm · Rookie",
      grader: "PSA",
      grade: "10",
      game: "Sports",
    },
    buyer: {
      handle: "@bucks_collector",
      name: "Owen Fitzgerald",
      initials: "OF",
      joined: "Mar 2024",
      disputes: 1,
    },
    seller: {
      handle: "@courtsidecards",
      name: "Marcus Hale",
      initials: "MH",
      joined: "Jan 2023",
      disputes: 4,
    },
    buyerClaim:
      "The slab he brought to the meet is a PSA 9, not the PSA 10 in the listing. The cert on the label does not match the one in the listing photos, and he had the listing open on his phone.",
    sellerClaim:
      "I brought the exact slab I photographed. The buyer is comparing against a screenshot from a different listing of mine. I have two Giannis Prizms and both were live that week.",
    evidence: [
      { label: "Slab label close-up, taken at the meet", from: "buyer", kind: "photo" },
      { label: "Original listing photo set (6)", from: "seller", kind: "photo" },
      { label: "Message thread, full export", from: "buyer", kind: "document" },
      { label: "PSA register lookup, both certs", from: "seller", kind: "document" },
    ],
    timeline: [
      { at: "28 Aug, 14:20", by: "Owen Fitzgerald", side: "buyer", text: "Reported @courtsidecards. The card shown in the listing was not the card brought." },
      { at: "28 Aug, 16:02", by: "System", side: "system", text: "Seller's live listings paused pending review. Both accounts notified." },
      { at: "29 Aug, 09:15", by: "Marcus Hale", side: "seller", text: "Submitted the original photo set and register lookups for both certs." },
      { at: "30 Aug, 11:40", by: "Marco Reyes", side: "admin", text: "Both certs are genuine and both are his. Cannot yet establish which one was listed." },
      { at: "31 Aug, 08:05", by: "System", side: "system", text: "Escalated to Trust and safety, open past 72 hours with no finding." },
    ],
    ageHours: 78,
  },
  {
    id: "CF-2289",
    kind: "no-show",
    status: "awaiting-evidence",
    opened: "2026-08-30T09:05:00Z",
    amount: 1420,
    against: "seller",
    listing: {
      id: "LS-9031",
      card: "Shohei Ohtani #660",
      setLine: "2018 Topps Update · Rookie Debut",
      grader: "PSA",
      grade: "10",
      game: "Sports",
    },
    buyer: {
      handle: "@nrg_cards",
      name: "Jade Lim",
      initials: "JL",
      joined: "Nov 2025",
      disputes: 0,
    },
    seller: {
      handle: "@pacificrim_pc",
      name: "Hana Nakamura",
      initials: "HN",
      joined: "Jun 2024",
      disputes: 1,
    },
    buyerClaim:
      "We agreed a time and a place and she confirmed that morning. She did not turn up and has not answered two messages since. I travelled 40 minutes each way.",
    sellerClaim: "Awaiting a response from the seller.",
    evidence: [
      { label: "Message thread confirming the meet", from: "buyer", kind: "document" },
      { label: "Screenshots of two unanswered follow-ups", from: "buyer", kind: "document" },
    ],
    timeline: [
      { at: "30 Aug, 09:05", by: "Jade Lim", side: "buyer", text: "Reported @pacificrim_pc. Agreed a meet, did not attend, stopped replying." },
      { at: "30 Aug, 09:06", by: "System", side: "system", text: "Seller given 72h to answer. Their listing is held off the market until they do." },
      { at: "31 Aug, 10:00", by: "System", side: "system", text: "Reminder sent to the seller. 24h remaining before the case decides without them." },
    ],
    ageHours: 30,
  },
  {
    id: "CF-2288",
    kind: "threats",
    status: "open",
    opened: "2026-08-30T18:40:00Z",
    amount: 3120,
    against: "seller",
    listing: {
      id: "LS-9036",
      card: "Lugia #9",
      art: "pokemon-lugia",
      setLine: "2000 Neo Genesis · 1st Edition Holo",
      grader: "CGC",
      grade: "9.5",
      game: "Pokémon",
    },
    buyer: {
      handle: "@neo_era",
      name: "Tom Bennett",
      initials: "TB",
      joined: "Feb 2025",
      disputes: 0,
    },
    seller: {
      handle: "@johto_grails",
      name: "Takumi Kondo",
      initials: "TK",
      joined: "Aug 2023",
      disputes: 0,
    },
    buyerClaim:
      "I asked one question about the seam on the case and he told me he knows the area I live in and that I should think carefully about my next message. I have stopped replying. I want it on record.",
    sellerClaim:
      "I was angry and I typed something stupid. I did not mean it as a threat and I apologised in the thread twenty minutes later.",
    evidence: [
      { label: "Message thread, unedited export", from: "buyer", kind: "document" },
      { label: "Screenshots of the two messages", from: "buyer", kind: "photo" },
      { label: "Seller's apology, sent 21 minutes later", from: "seller", kind: "document" },
    ],
    timeline: [
      { at: "30 Aug, 18:40", by: "Tom Bennett", side: "buyer", text: "Reported @johto_grails. Threatening message referencing where he lives." },
      { at: "30 Aug, 18:41", by: "System", side: "system", text: "Routed straight to Trust and safety. Messaging between the two accounts closed." },
      { at: "31 Aug, 07:30", by: "Ayna Sulaiman", side: "admin", text: "Thread preserved unedited in case this goes to police. Buyer asked whether he should report it himself." },
    ],
    ageHours: 21,
  },
  {
    id: "CF-2285",
    kind: "counterfeit",
    status: "open",
    opened: "2026-08-29T12:15:00Z",
    amount: 5400,
    against: "seller",
    listing: {
      id: "LS-9008",
      card: "Blastoise #2",
      art: "pokemon-blastoise",
      setLine: "1999 Base Set · Shadowless Holo",
      grader: "PSA",
      grade: "9",
      game: "Pokémon",
    },
    buyer: {
      handle: "@shadowless_only",
      name: "Ines Duarte",
      initials: "ID",
      joined: "Sep 2024",
      disputes: 0,
    },
    seller: {
      handle: "@vault_flipper",
      name: "Chris Doyle",
      initials: "CD",
      joined: "Jul 2026",
      disputes: 5,
    },
    buyerClaim:
      "The slab looks resealed. The label font weight is off and there is adhesive residue on the inner lip. This is the third listing of his I have queried this month.",
    sellerClaim: "Bought it this way at a show. I have no way to know.",
    evidence: [
      { label: "Macro shots of the seam (8)", from: "buyer", kind: "photo" },
      { label: "PSA register lookup", from: "buyer", kind: "document" },
    ],
    timeline: [
      { at: "29 Aug, 12:15", by: "Ines Duarte", side: "buyer", text: "Reported @vault_flipper. Suspected resealed slab." },
      { at: "29 Aug, 12:16", by: "System", side: "system", text: "Fifth report against this account in 30 days. Flagged to Trust and safety." },
      { at: "30 Aug, 15:00", by: "Ayna Sulaiman", side: "admin", text: "Listing withdrawn pending review. The seller's other listings pulled off the market." },
    ],
    ageHours: 45,
  },
  {
    id: "CF-2287",
    kind: "off-platform",
    status: "resolved",
    opened: "2026-08-26T10:00:00Z",
    amount: 8400,
    against: "buyer",
    listing: {
      id: "LS-8974",
      card: "Charizard VMAX #020",
      setLine: "2020 Champion's Path · Secret Rare",
      grader: "PSA",
      grade: "10",
      game: "Pokémon",
    },
    buyer: {
      handle: "@galar_pc",
      name: "Ryan Osei",
      initials: "RO",
      joined: "Apr 2025",
      disputes: 2,
    },
    seller: {
      handle: "@holo_vault",
      name: "Daniel Wu",
      initials: "DW",
      joined: "Feb 2023",
      disputes: 1,
    },
    buyerClaim:
      "I asked to settle it directly to save us both the trouble. I did not know that was against the rules.",
    sellerClaim:
      "He asked me twice to take the sale off-platform, the second time after I had already said no. Screenshotting rather than replying, as the help page says to.",
    evidence: [
      { label: "Screenshots of both requests", from: "seller", kind: "photo" },
      { label: "Message thread export", from: "seller", kind: "document" },
    ],
    timeline: [
      { at: "26 Aug, 10:00", by: "Daniel Wu", side: "seller", text: "Reported @galar_pc. Asked twice to complete the sale off-platform." },
      { at: "27 Aug, 14:20", by: "Ryan Osei", side: "buyer", text: "Accepted that it happened. Says he did not know the rule." },
      { at: "31 Aug, 06:10", by: "Ayna Sulaiman", side: "admin", text: "Formal warning recorded against @galar_pc. First offence, admitted, nothing lost by the seller. A second one restricts the account." },
    ],
    ageHours: 120,
  },
];

export const conflictKindLabel: Record<ConflictKind, string> = {
  "not-as-described": "Not as described",
  "off-platform": "Asked me to go off-platform",
  "no-show": "No-show",
  threats: "Threats or harassment",
  counterfeit: "Counterfeit or tampered slab",
};

/**
 * What closing a case can actually do.
 *
 * Grail Market holds no funds, so there is no refund to award and no payout
 * to release. Every outcome here acts on standing — what the account may do
 * and what its record says — which is the only lever the platform has.
 *
 * `severity` orders them; `escalates` marks the two that a Tier 1 or Tier 2
 * agent cannot apply on their own.
 */
export type ConductAction = {
  key: string;
  title: string;
  detail: string;
  severity: 0 | 1 | 2 | 3 | 4;
  tone: "ok" | "warn" | "bad";
  /** Needs Trust and safety, not a moderator. */
  escalates?: boolean;
};

export const conductActions: ConductAction[] = [
  {
    key: "none",
    title: "No action",
    detail:
      "The report is closed without a finding. It stays on both records as a case that was raised and answered, so a pattern is still visible later.",
    severity: 0,
    tone: "ok",
  },
  {
    key: "warn",
    title: "Warn",
    detail:
      "A formal warning, worded by you, sent to the member and written to their record. Says which rule was broken and what a second one costs.",
    severity: 1,
    tone: "warn",
  },
  {
    key: "restrict",
    title: "Restrict",
    detail:
      "Listing and selling stop; browsing and buying continue. Live listings come off the market. Lifted by a lead moderator, never automatically.",
    severity: 2,
    tone: "warn",
  },
  {
    key: "close",
    title: "Close the account",
    detail:
      "Sign-in blocked, every listing pulled, the handle retired so it cannot be re-registered. The member is emailed the reason recorded here.",
    severity: 3,
    tone: "bad",
    escalates: true,
  },
  {
    key: "police",
    title: "Refer to police",
    detail:
      "For threats, stalking and fraud. The case, the message thread and the verified identity go to Trust and safety, who make the report. Identity is released on lawful request only.",
    severity: 4,
    tone: "bad",
    escalates: true,
  },
];

/* ==========================================================================
   Members
   ========================================================================== */

export type Member = {
  id: string;
  handle: string;
  name: string;
  initials: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  /** What they pay for, and what Stripe says about it. */
  plan: PlanKey;
  billing: BillingState;
  /** How far through the funnel — see `VerificationLevel`. */
  verification: VerificationLevel;
  joined: string;
  lastSeen: string;
  /**
   * The same figure as `lastSeen`, as a number.
   *
   * Segmenting by activity cannot be done against "12 minutes ago" — the
   * string is for reading, this is for filtering, and they are written from
   * the same fact so they cannot disagree.
   */
  lastSeenDays: number;
  country: string;
  sales: number;
  purchases: number;
  /** Listings ever published. 0 is the never-listed cohort. */
  listed: number;
  /** Live on the market right now — what a plan downgrade has to fit under. */
  liveListings: number;
  volume: number;
  rating: number;
  strikes: number;
  verifiedSeller: boolean;
  /** Internal labels. Never shown to the member. */
  tags: string[];
  note?: string;
};

export const planLabel: Record<PlanKey, string> = {
  none: "No plan",
  starter: "Starter",
  collector: "Collector",
  dealer: "Dealer",
};

export const verificationLabel: Record<VerificationLevel, string> = {
  none: "Unverified",
  mobile: "Mobile confirmed",
  "id-submitted": "ID submitted",
  "id-verified": "ID verified",
};

export const billingLabel: Record<BillingState, string> = {
  active: "Billing active",
  "past-due": "Payment failed",
  cancelled: "Cancelled",
  none: "Never subscribed",
};

/** Live-listing ceiling per plan. null = no ceiling. Mirrors `subscriptionTiers`. */
export const planQuota: Record<PlanKey, number | null> = {
  none: 0,
  starter: 1,
  collector: 10,
  dealer: null,
};

export const members: Member[] = [
  {
    id: "MB-1042",
    handle: "@moonbreon_co",
    name: "Elena Petrova",
    initials: "EP",
    email: "elena@moonbreon.co",
    role: "buyer-seller",
    status: "active",
    plan: "dealer",
    billing: "active",
    verification: "id-verified",
    joined: "2023-05-14",
    lastSeen: "12 minutes ago",
    lastSeenDays: 0,
    country: "Portugal",
    sales: 366,
    purchases: 91,
    listed: 402,
    liveListings: 24,
    volume: 428400,
    rating: 5.0,
    strikes: 0,
    verifiedSeller: true,
    tags: ["top-seller", "fast-dispatch"],
  },
  {
    id: "MB-0987",
    handle: "@courtsidecards",
    name: "Marcus Hale",
    initials: "MH",
    email: "marcus@courtsidecards.com",
    role: "seller",
    status: "active",
    plan: "dealer",
    billing: "active",
    verification: "id-verified",
    joined: "2023-01-09",
    lastSeen: "1 hour ago",
    lastSeenDays: 0,
    country: "United States",
    sales: 512,
    purchases: 14,
    listed: 610,
    liveListings: 31,
    volume: 741200,
    rating: 4.8,
    strikes: 1,
    verifiedSeller: true,
    tags: ["high-volume", "watch"],
    note: "One open not-as-described case (CF-2291). Listings paused while it runs.",
  },
  {
    id: "MB-1188",
    handle: "@vault_flipper",
    name: "Chris Doyle",
    initials: "CD",
    email: "cdoyle.trades@mail.com",
    role: "seller",
    status: "revoked",
    plan: "collector",
    billing: "cancelled",
    verification: "id-verified",
    joined: "2026-07-02",
    lastSeen: "48 minutes ago",
    lastSeenDays: 0,
    country: "Ireland",
    sales: 12,
    purchases: 3,
    listed: 18,
    liveListings: 0,
    volume: 21800,
    rating: 3.4,
    strikes: 3,
    verifiedSeller: false,
    tags: ["repeat-reports"],
    note: "Access revoked 31 Aug after three authenticity strikes in 30 days. Two listings withdrawn, and CF-2285 is still open.",
  },
  {
    id: "MB-0771",
    handle: "@holo_vault",
    name: "Daniel Wu",
    initials: "DW",
    email: "dan@holovault.io",
    role: "buyer-seller",
    status: "active",
    plan: "dealer",
    billing: "active",
    verification: "id-verified",
    joined: "2023-02-27",
    lastSeen: "3 hours ago",
    lastSeenDays: 0,
    country: "Singapore",
    sales: 214,
    purchases: 158,
    listed: 240,
    liveListings: 12,
    volume: 512900,
    rating: 4.9,
    strikes: 0,
    verifiedSeller: true,
    tags: ["trusted"],
  },
  {
    id: "MB-1301",
    handle: "@duelistdepot",
    name: "Amir Farooq",
    initials: "AF",
    email: "amir@duelistdepot.net",
    role: "seller",
    status: "restricted",
    plan: "collector",
    billing: "active",
    verification: "id-verified",
    joined: "2024-11-18",
    lastSeen: "9 hours ago",
    lastSeenDays: 0,
    country: "United Arab Emirates",
    sales: 89,
    purchases: 22,
    listed: 96,
    liveListings: 0,
    volume: 96300,
    rating: 4.6,
    strikes: 2,
    verifiedSeller: false,
    tags: ["under-review"],
    note: "Listing privileges paused after two pricing-manipulation reports. Buying still allowed.",
  },
  {
    id: "MB-1420",
    handle: "@alphaonly",
    name: "Rosa Iqbal",
    initials: "RI",
    email: "rosa@alphaonly.cards",
    role: "consignor",
    status: "active",
    plan: "dealer",
    billing: "active",
    verification: "id-verified",
    joined: "2025-03-30",
    lastSeen: "22 minutes ago",
    lastSeenDays: 0,
    country: "United Kingdom",
    sales: 76,
    purchases: 4,
    listed: 88,
    liveListings: 9,
    volume: 318700,
    rating: 5.0,
    strikes: 0,
    verifiedSeller: true,
    tags: ["consignment"],
  },
  {
    id: "MB-1512",
    handle: "@grandline_gr",
    name: "Sofia Marchetti",
    initials: "SM",
    email: "sofia.m@grandline.gr",
    role: "buyer-seller",
    status: "active",
    plan: "collector",
    billing: "active",
    verification: "id-verified",
    joined: "2024-08-04",
    lastSeen: "5 hours ago",
    lastSeenDays: 0,
    country: "Greece",
    sales: 148,
    purchases: 203,
    listed: 160,
    liveListings: 6,
    volume: 187500,
    rating: 4.9,
    strikes: 0,
    verifiedSeller: true,
    tags: ["raised-a-report"],
  },
  {
    id: "MB-1633",
    handle: "@kanto_archive",
    name: "Yuki Tanaka",
    initials: "YT",
    email: "yuki@kantoarchive.jp",
    role: "consignor",
    status: "pending",
    plan: "dealer",
    billing: "active",
    verification: "id-submitted",
    joined: "2026-08-19",
    lastSeen: "1 day ago",
    lastSeenDays: 1,
    country: "Japan",
    sales: 31,
    purchases: 0,
    listed: 34,
    liveListings: 2,
    volume: 402000,
    rating: 4.7,
    strikes: 0,
    verifiedSeller: false,
    tags: ["consignment", "grail-tier"],
    note: "Consignor agreement signed, awaiting provenance review on VF-4815.",
  },
  {
    id: "MB-1704",
    handle: "@bucks_collector",
    name: "Owen Fitzgerald",
    initials: "OF",
    email: "owen.fitz@mail.com",
    role: "buyer",
    status: "active",
    plan: "starter",
    billing: "active",
    verification: "id-verified",
    joined: "2024-03-11",
    lastSeen: "2 hours ago",
    lastSeenDays: 0,
    country: "United States",
    sales: 0,
    purchases: 46,
    listed: 0,
    liveListings: 0,
    volume: 88400,
    rating: 4.8,
    strikes: 0,
    verifiedSeller: false,
    tags: [],
  },
  {
    id: "MB-1802",
    handle: "@johto_grails",
    name: "Takumi Kondo",
    initials: "TK",
    email: "takumi@johtograils.jp",
    role: "seller",
    status: "active",
    plan: "collector",
    billing: "active",
    verification: "id-verified",
    joined: "2023-08-21",
    lastSeen: "6 hours ago",
    lastSeenDays: 0,
    country: "Japan",
    sales: 194,
    purchases: 31,
    listed: 210,
    liveListings: 8,
    volume: 264100,
    rating: 4.9,
    strikes: 0,
    verifiedSeller: true,
    tags: [],
  },
  {
    id: "MB-1877",
    handle: "@pacificrim_pc",
    name: "Hana Nakamura",
    initials: "HN",
    email: "hana@pacificrim.pc",
    role: "seller",
    status: "restricted",
    plan: "collector",
    billing: "past-due",
    verification: "id-verified",
    joined: "2024-06-02",
    lastSeen: "4 days ago",
    lastSeenDays: 4,
    country: "Japan",
    sales: 141,
    purchases: 8,
    listed: 150,
    liveListings: 0,
    volume: 112900,
    rating: 4.5,
    strikes: 1,
    verifiedSeller: true,
    tags: ["payment-failed"],
    note: "Listings held off the market while CF-2289 (no-show) is open.",
  },
  {
    id: "MB-1901",
    handle: "@shadowless_only",
    name: "Ines Duarte",
    initials: "ID",
    email: "ines@shadowless.pt",
    role: "buyer",
    status: "active",
    plan: "starter",
    billing: "active",
    verification: "mobile",
    joined: "2024-09-15",
    lastSeen: "8 hours ago",
    lastSeenDays: 0,
    country: "Portugal",
    sales: 0,
    purchases: 62,
    listed: 0,
    liveListings: 0,
    volume: 141600,
    rating: 5.0,
    strikes: 0,
    verifiedSeller: false,
    tags: [],
  },
  {
    id: "MB-1503",
    handle: "@sunsetbinder",
    name: "Priya Raman",
    initials: "PR",
    email: "priya@sunsetbinder.au",
    role: "buyer-seller",
    status: "active",
    plan: "starter",
    billing: "past-due",
    verification: "mobile",
    joined: "2024-02-10",
    lastSeen: "4 months ago",
    lastSeenDays: 124,
    country: "Australia",
    sales: 11,
    purchases: 6,
    listed: 14,
    liveListings: 0,
    volume: 8400,
    rating: 4.4,
    strikes: 0,
    verifiedSeller: false,
    tags: ["lapsed"],
    note: "Card has failed twice since May. Two plan prompts sent, no reply.",
  },
  {
    id: "MB-1209",
    handle: "@tcg_dormant",
    name: "Ben Whitfield",
    initials: "BW",
    email: "ben.whitfield@outlook.com",
    role: "buyer",
    status: "active",
    plan: "none",
    billing: "cancelled",
    verification: "id-verified",
    joined: "2023-09-01",
    lastSeen: "7 months ago",
    lastSeenDays: 214,
    country: "United Kingdom",
    sales: 0,
    purchases: 19,
    listed: 0,
    liveListings: 0,
    volume: 21300,
    rating: 4.8,
    strikes: 0,
    verifiedSeller: false,
    tags: [],
  },
  {
    id: "MB-1990",
    handle: "@newcomer_au",
    name: "Lucy Tran",
    initials: "LT",
    email: "lucy.tran@proton.me",
    role: "buyer",
    status: "pending",
    plan: "starter",
    billing: "active",
    verification: "none",
    joined: "2026-08-30",
    lastSeen: "3 hours ago",
    lastSeenDays: 0,
    country: "Australia",
    sales: 0,
    purchases: 0,
    listed: 0,
    liveListings: 0,
    volume: 0,
    rating: 0,
    strikes: 0,
    verifiedSeller: false,
    tags: ["new"],
  },
];

export const revokeReasons = [
  "Counterfeit or altered item",
  "Repeated authenticity strikes",
  "Payment fraud or chargeback abuse",
  "Shill bidding or price manipulation",
  "Harassment of another member",
  "Duplicate or ban-evading account",
  "Requested by the member",
];

/* ==========================================================================
   Reports

   Nothing here. Every figure the page draws is computed by the API over the
   selected period — see GET /admin/reports and reports.store.ts. The
   fixtures that used to sit here (the catalogue, the KPI row, the decision
   split, the conflict outcomes and the GMV-by-game split) went with the
   wiring rather than staying beside it: a page that has been connected can
   drift back onto a constant that is still exported.
   ========================================================================== */

/* ==========================================================================
   Support
   ========================================================================== */

export type TicketMessage = {
  from: "member" | "admin";
  author: string;
  text: string;
  at: string;
  /** Set on the entry an escalation writes, so the handover reads in place. */
  system?: boolean;
};

export type Ticket = {
  id: string;
  subject: string;
  preview: string;
  status: TicketStatus;
  priority: TicketPriority;
  /** Which rung holds it now. */
  tier: SupportTier;
  category: string;
  member: { handle: string; name: string; initials: string; role: MemberRole };
  opened: string;
  lastReply: string;
  /**
   * Hours left on the first-reply target. Negative is over.
   *
   * Same convention and same sign as `Listing.slaHours`, so the queue badge
   * on both pages can be read the same way without checking which one it is.
   */
  slaHours: number;
  /** Whether a person has answered yet — the clock stops on the first reply. */
  answered: boolean;
  assignee?: string;
  thread: TicketMessage[];
};

export const tickets: Ticket[] = [
  {
    id: "SP-1194",
    subject: "The member I reported is messaging me again",
    preview:
      "CF-2287 closed with a warning four days ago and he has messaged me twice since. I do not want to deal with him.",
    status: "new",
    priority: "urgent",
    tier: "trust-safety",
    category: "Trust and safety",
    member: { handle: "@holo_vault", name: "Daniel Wu", initials: "DW", role: "buyer-seller" },
    opened: "2026-08-31T08:40:00Z",
    lastReply: "45 minutes ago",
    slaHours: -2,
    answered: false,
    thread: [
      {
        from: "member",
        author: "Daniel Wu",
        at: "31 Aug, 08:40",
        text: "CF-2287 closed with a warning four days ago. He has messaged me twice since, once about the same card. I do not want any contact with this account.",
      },
    ],
  },
  {
    id: "SP-1196",
    subject: "Paid for a boost and nothing happened",
    preview:
      "Bought a 7-day boost on Tuesday. The listing is in the same place it was. Nobody has replied.",
    status: "new",
    priority: "normal",
    tier: "tier-1",
    category: "Listings",
    member: { handle: "@johto_grails", name: "Takumi Kondo", initials: "TK", role: "seller" },
    opened: "2026-08-31T04:15:00Z",
    lastReply: "6 hours ago",
    slaHours: 2,
    answered: false,
    thread: [
      {
        from: "member",
        author: "Takumi Kondo",
        at: "31 Aug, 04:15",
        text: "I bought a 7-day boost on LS-9036 on Tuesday and the listing has not moved. Has it been applied or not?",
      },
    ],
  },
  {
    id: "SP-1192",
    subject: "Grail-tier review has been open five days",
    preview:
      "VF-4815 (Pikachu Illustrator) is still sitting in review. I sent the auction invoice on Tuesday. Is anything else needed?",
    status: "open",
    priority: "high",
    tier: "tier-2",
    category: "Verification",
    member: { handle: "@kanto_archive", name: "Yuki Tanaka", initials: "YT", role: "consignor" },
    opened: "2026-08-30T11:15:00Z",
    lastReply: "2 hours ago",
    slaHours: 3,
    answered: true,
    assignee: "Ayna Sulaiman",
    thread: [
      {
        from: "member",
        author: "Yuki Tanaka",
        at: "30 Aug, 11:15",
        text: "VF-4815 is still in review. I sent the 2021 auction invoice on Tuesday. Is anything else needed from me?",
      },
      {
        from: "admin",
        author: "Ayna Sulaiman",
        at: "30 Aug, 15:02",
        text: "Thank you, the invoice arrived. A card at this price with two comparable sales on record needs a second reviewer, which is where it sits now. I will come back to you within 48 hours either way.",
      },
      {
        from: "member",
        author: "Yuki Tanaka",
        at: "31 Aug, 06:20",
        text: "Understood. Happy to supply the original CoroCoro contest documentation if that helps.",
      },
    ],
  },
  {
    id: "SP-1190",
    subject: "Cannot list, account says restricted",
    preview: "I can browse and buy but the sell button is gone. No email explaining why.",
    status: "open",
    priority: "high",
    tier: "tier-2",
    category: "Account",
    member: { handle: "@duelistdepot", name: "Amir Farooq", initials: "AF", role: "seller" },
    opened: "2026-08-30T07:22:00Z",
    lastReply: "1 day ago",
    slaHours: 6,
    answered: true,
    assignee: "Marco Reyes",
    thread: [
      {
        from: "member",
        author: "Amir Farooq",
        at: "30 Aug, 07:22",
        text: "I can browse and buy but the sell button is gone. I did not get an email explaining why.",
      },
      {
        from: "admin",
        author: "Marco Reyes",
        at: "30 Aug, 12:10",
        text: "Listing privileges were paused on 26 August following two reports of coordinated bidding on your listings. Buying is unaffected. The review is with the moderation team and I will update you when it closes.",
      },
    ],
  },
  {
    id: "SP-1187",
    subject: "Which grader do you accept for consignment?",
    preview: "Do you take CGC and SGC slabs for the consignment programme, or PSA and BGS only?",
    status: "waiting",
    priority: "normal",
    tier: "tier-1",
    category: "Verification",
    member: { handle: "@neo_era", name: "Tom Bennett", initials: "TB", role: "buyer" },
    opened: "2026-08-29T16:05:00Z",
    lastReply: "2 days ago",
    slaHours: 19,
    answered: true,
    assignee: "Priya Nandakumar",
    thread: [
      {
        from: "member",
        author: "Tom Bennett",
        at: "29 Aug, 16:05",
        text: "Do you take CGC and SGC slabs for consignment, or PSA and BGS only?",
      },
      {
        from: "admin",
        author: "Priya Nandakumar",
        at: "29 Aug, 17:30",
        text: "All four, plus TAG. Each grader is priced on its own scale. We never convert a grade between companies to reach a figure, so a CGC 9.5 is valued from CGC 9.5 sales only.",
      },
    ],
  },
  {
    id: "SP-1185",
    subject: "Buyer is asking me to complete the sale off-platform",
    preview: "Screenshotting this rather than replying. Handle attached.",
    status: "open",
    priority: "urgent",
    tier: "trust-safety",
    category: "Trust and safety",
    member: { handle: "@grandline_gr", name: "Sofia Marchetti", initials: "SM", role: "buyer-seller" },
    opened: "2026-08-29T09:48:00Z",
    lastReply: "3 hours ago",
    slaHours: 1,
    answered: true,
    assignee: "Ayna Sulaiman",
    thread: [
      {
        from: "member",
        author: "Sofia Marchetti",
        at: "29 Aug, 09:48",
        text: "A buyer messaged asking me to take the sale off-platform to avoid fees. Screenshotting rather than replying. Handle attached.",
      },
      {
        from: "admin",
        author: "Ayna Sulaiman",
        at: "31 Aug, 06:15",
        text: "Exactly the right call, thank you. The account is under review and I have added the screenshots to the case. Do not reply to the message thread.",
      },
    ],
  },
  {
    id: "SP-1180",
    subject: "Why did I get a warning for asking to pay direct?",
    preview: "I offered a bank transfer to save the seller trouble. Now there is a warning on my account.",
    status: "resolved",
    priority: "low",
    tier: "tier-1",
    category: "Trust and safety",
    member: { handle: "@galar_pc", name: "Ryan Osei", initials: "RO", role: "buyer" },
    opened: "2026-08-27T13:00:00Z",
    lastReply: "3 hours ago",
    slaHours: 21,
    answered: true,
    assignee: "Marco Reyes",
    thread: [
      {
        from: "member",
        author: "Ryan Osei",
        at: "27 Aug, 13:00",
        text: "I offered to pay the seller by bank transfer to save us both the trouble. Now there is a warning on my account. I was not trying to scam anyone.",
      },
      {
        from: "admin",
        author: "Marco Reyes",
        at: "31 Aug, 05:40",
        text: "Understood, and it is recorded as a first offence with no loss to the seller. The rule exists because a sale taken off-platform loses the identity check on both sides, and we hold no money so we cannot step in afterwards. The warning stays on the record; nothing else changes about your account.",
      },
    ],
  },
];

export const supportStats: Stat[] = [
  { key: "s1", label: "Unassigned", value: "3", foot: "1 marked urgent", tone: "navy" },
  { key: "s2", label: "Median first reply", value: "1h 48m", delta: { dir: "down", text: "22m" }, foot: "target is 4h", tone: "gold" },
  { key: "s3", label: "Open tickets", value: "24", delta: { dir: "up", text: "+4" }, foot: "6 waiting on a member" },
  { key: "s4", label: "Resolved this week", value: "61", delta: { dir: "up", text: "9%" }, foot: "94% satisfaction" },
];

/* --------------------------------------------------------------------------
   The ticket store

   Same reason as the member record: escalating a ticket or resolving one has
   to survive the next render, and there is no admin API to put it in yet.
   Overrides are keyed by ticket id and layered over the fixture.
   -------------------------------------------------------------------------- */

type TicketOverride = {
  tier?: SupportTier;
  status?: TicketStatus;
  assignee?: string;
  answered?: boolean;
  extra?: TicketMessage[];
};

const ticketOverrides = new Map<string, TicketOverride>();

/** The ticket as it stands now — fixture underneath, session changes on top. */
export function ticketNow(t: Ticket): Ticket {
  const o = ticketOverrides.get(t.id);
  if (!o) return t;
  const { extra, ...rest } = o;
  return { ...t, ...rest, thread: extra ? [...t.thread, ...extra] : t.thread };
}

function patch(id: string, next: TicketOverride) {
  ticketOverrides.set(id, { ...ticketOverrides.get(id), ...next });
}

export function appendMessage(t: Ticket, m: TicketMessage) {
  const cur = ticketOverrides.get(t.id);
  patch(t.id, { extra: [...(cur?.extra ?? []), m] });
}

export function assignTicket(id: string, to: string) {
  patch(id, { assignee: to });
}

export function setTicketStatus(id: string, status: TicketStatus) {
  patch(id, { status });
}

/** The first reply from a person stops the clock. */
export function markAnswered(id: string) {
  patch(id, { answered: true });
}

/**
 * Move a ticket one rung up the ladder.
 *
 * Returns the tier it landed on, or null if it was already at the top —
 * there is nothing above Trust and safety, and a button that pretends
 * otherwise sends a member's problem in a circle.
 */
/* --------------------------------------------------------------------------
   Looking a member up from somewhere else

   The support desk needs the person behind the handle on the ticket — their
   standing, what they have listed, and what they have traded. Tier 1 does not
   get this; Tier 2 and above do, for the ticket in hand only.
   -------------------------------------------------------------------------- */

/** The member record behind a handle, with session changes applied. */
export const memberByHandle = (handle: string) => {
  const m = members.find((x) => x.handle === handle);
  return m ? memberNow(m) : null;
};

/** Everything this member has in the listing queue or on the market. */
export const listingsBy = (handle: string) =>
  listings.filter((l) => l.seller.handle === handle);

export function escalate(t: Ticket): SupportTier | null {
  const to = nextTier(ticketNow(t).tier);
  if (!to) return null;
  patch(t.id, { tier: to, status: "open", assignee: undefined });
  return to;
}

/* --------------------------------------------------------------------------
   Canned replies

   The repeat questions, in the words an agent would actually use. Each one
   carries the body, not just a label: a template that only fills in a subject
   leaves the agent writing the hard part from scratch every time, which is
   the part that ends up inconsistent between one agent and the next.
   -------------------------------------------------------------------------- */

export type CannedReply = {
  key: string;
  label: string;
  body: string;
  /** Shown as a hint so nobody sends the wrong one. */
  when: string;
};

export const cannedReplies: CannedReply[] = [
  {
    key: "id-stuck",
    label: "ID check stuck",
    when: "Submitted to the provider and sitting there.",
    body: "Your ID is with our accredited verification provider, who check it against the government DVS. That check is theirs rather than ours. We are sent the outcome and never hold the documents. Yours is still open, which usually means the photo of the code you wrote out was hard to read. Resubmitting from the app is the fastest way through; it goes to the front of their queue, not the back.",
  },
  {
    key: "listing-rejected",
    label: "Listing rejected",
    when: "They want to know why, or want it back.",
    body: "Your listing was read by a moderator before it could go live, and it was not approved. The reason recorded at the time is on the listing itself and in your account history, word for word. Most rejections are fixable, usually with more photographs or a clearer shot of the slab label. A corrected listing counts as a new submission rather than an appeal. If you think the reason is wrong, reply here and I will have a second moderator look.",
  },
  {
    key: "boost",
    label: "Boost not applied",
    when: "Paid for a boost and the listing is not surfacing.",
    body: "I can see the boost on your account and it is active. A boost lifts a listing within its own category and grade band. It does not move it above listings with a stronger price-confidence score, which is what the front page is ordered by. If the listing is still not appearing where you expect after 24 hours, send me the listing id and I will check it against the ranking directly.",
  },
  {
    key: "restrict",
    label: "Explaining a restriction",
    when: "Selling is paused and they were not sure why.",
    body: "Listing and selling on your account are paused. Browsing and buying are unaffected. The reason and the date are on your member record, and the member is always told which behaviour caused it. A restriction is lifted by a lead moderator rather than on a timer, so replying here with anything that puts it in context is worth doing.",
  },
  {
    key: "grader",
    label: "Which graders we accept",
    when: "Asked before consigning or listing.",
    body: "PSA, BGS, CGC, SGC and TAG. Each grader is priced on its own scale, and we never convert a grade between companies to reach a figure, so a CGC 9.5 is valued from CGC 9.5 sales only. Raw cards are accepted below the high-value floor.",
  },
  {
    key: "offplat",
    label: "Off-platform contact",
    when: "Someone asked them to settle direct.",
    body: "Thank you for reporting it rather than replying. That was exactly the right call. Taking a sale off-platform loses the identity check on both sides, and no money passes through Grail Market, so we cannot step in afterwards. The account is under review and your screenshots are attached to the case. Please do not reply to the thread.",
  },
];

/* ==========================================================================
   Settings
   ========================================================================== */



/* ==========================================================================
   Pricing plans

   Stripe holds the real prices; this is the admin-facing mirror of them.
   Editing a figure here is a write to Stripe, not a local override — which is
   why each plan carries its Stripe price id and the console shows it.
   ========================================================================== */


/* ==========================================================================
   The admin team, as member records

   Same shape the marketplace directory uses, so one card component renders
   both. Accounts here are provisioned in the backend — this console can show
   them and suspend them, never create one.
   ========================================================================== */

export type Staff = {
  id: string;
  name: string;
  initials: string;
  email: string;
  /** One of the five. What they can reach is derived from this, not typed in. */
  role: Role;
  /** How the role reads on their card — usually the role's own label. */
  title: string;
  status: "active" | "restricted" | "revoked";
  location: string;
  since: string;
  lastActive: string;
  decisions: number;
  medianDecision: string;
  rating: number;
  lead: boolean;
  /** Held by the outsourcing partner rather than by Grail Market. */
  outsourced?: boolean;
};

/**
 * What a staff account can reach, as chips.
 *
 * Derived from the role rather than stored beside it — a scope list typed in
 * by hand is a second source of truth that drifts from the one the console
 * actually enforces, which is exactly the state this replaced.
 */
/* --------------------------------------------------------------------------
   Staff accounts: invite, scope, revoke

   Session-local like everything else here. An invite does not create an
   account — it creates a pending one, which is the honest shape: the account
   exists when the person accepts and sets up 2FA, not when a lead types their
   email in.
   -------------------------------------------------------------------------- */

export type Invite = {
  id: string;
  email: string;
  role: Role;
  invitedBy: string;
  at: string;
  /** Partner staff get a shorter window and a named company. */
  company?: string;
};

const invites: Invite[] = [];
const roleOverrides = new Map<string, Role>();
const revoked = new Set<string>();

/** A staff account as it stands now. */
export function staffNow(p: Staff): Staff {
  const role = roleOverrides.get(p.id);
  const out = role ? { ...p, role, title: roleLabel(role) } : p;
  return revoked.has(p.id) ? { ...out, status: "revoked" as const } : out;
}

/* These three used to write to the audit log as well as to their own arrays.
   They no longer do: the log is the API's, and the real staff change goes
   through POST /admin/staff/:id/role, which writes its own entry. An entry
   appended from here would exist only in this tab and would claim an action
   the backend never saw. */

export const pendingInvites = () => [...invites];

export function inviteStaff(email: string, role: Role, by: string, company?: string): Invite {
  const inv: Invite = {
    id: `IN-${400 + invites.length}`,
    email,
    role,
    invitedBy: by,
    at: new Date().toISOString(),
    company,
  };
  invites.unshift(inv);
  return inv;
}

/** Change what an account can reach, by moving the role it holds. */
export function setStaffRole(p: Staff, role: Role, by: string, why: string) {
  const from = staffNow(p).role;
  roleOverrides.set(p.id, role);
}

export function revokeStaff(p: Staff, by: string, why: string) {
  revoked.add(p.id);
}

/* ==========================================================================
   Banner vocabulary

   All that is left of the announcements fixtures. The queue, the history and
   the send itself are the API's — see the `announcements` table and
   GET/POST /admin/announcements. These two are how the console words a tone,
   which is a rendering decision and belongs on this side.
   ========================================================================== */

export type BannerTone = "info" | "outage" | "policy";

export const bannerToneLabel: Record<BannerTone, string> = {
  info: "Information",
  outage: "Outage",
  policy: "Policy change",
};

/* --------------------------------------------------------------------------
   Service accounts

   Deliberately NOT a `Role` and deliberately not in `staff`.

   The brief names five roles and every one of them is a person who signs in.
   A machine that pulls a nightly report is neither — it holds a key, not a
   role, and the only reason it was ever in the roles table is that both were
   lists of things with an email address. Modelling it as a role meant giving
   it one, and the nearest fit was Owner, which is how a reporting bot ends up
   holding `settings.write`. It has its own list and its own literal scope
   instead, which is also the only honest way to answer "who can change the
   price engine" with a number.
   -------------------------------------------------------------------------- */

export type ServiceAccount = {
  id: string;
  name: string;
  initials: string;
  email: string;
  /** What it exists to do, in one line. */
  purpose: string;
  /** Literal, and read-only. Not derived from a role, because it has none. */
  scopes: string[];
  status: "active" | "restricted" | "revoked";
  lastActive: string;
};

export const serviceAccounts: ServiceAccount[] = [
  {
    id: "SVC-001",
    name: "Ops service account",
    initials: "OP",
    email: "ops-bot@grailmarket.app",
    purpose: "Pulls the nightly report set and the audit log export.",
    scopes: ["Reports (read-only)", "Audit log (read-only)"],
    status: "restricted",
    lastActive: "18 minutes ago",
  },
];

export const scopesOf = (role: Role): string[] => {
  const out: string[] = [];
  if (can(role, "listings.review")) out.push("Listing queue");
  if (can(role, "conduct.decide")) out.push("Reports & conduct");
  if (can(role, "support.read")) out.push("Support");
  if (can(role, "members.read")) out.push("Members");
  if (can(role, "id.exceptions")) out.push("ID exceptions");
  if (can(role, "billing.read")) out.push("Billing");
  if (can(role, "pricing.read")) out.push("Price engine");
  if (can(role, "audit.read")) out.push("Audit log");
  if (can(role, "announce.write")) out.push("Announcements");
  if (can(role, "reports.read")) out.push("Reports");
  if (can(role, "settings.write")) out.push("Settings");
  return out;
};

export const staff: Staff[] = [
  {
    id: "AD-001",
    name: "Ayna Sulaiman",
    initials: "AS",
    email: "ayna.sulaiman@calcite.live",
    role: "owner",
    title: "Owner",
    status: "active",
    location: "Karachi, PK",
    since: "Jan 2024",
    lastActive: "Now",
    decisions: 2841,
    medianDecision: "3h 40m",
    rating: 4.9,
    lead: true,
  },
  {
    id: "AD-004",
    name: "Marco Reyes",
    initials: "MR",
    email: "marco.reyes@grailmarket.app",
    role: "moderator",
    title: "Moderator",
    status: "active",
    location: "Lisbon, PT",
    since: "Mar 2024",
    lastActive: "3 hours ago",
    decisions: 1904,
    medianDecision: "4h 05m",
    rating: 4.7,
    lead: false,
  },
  {
    id: "AD-006",
    name: "Priya Nandakumar",
    initials: "PN",
    email: "priya.n@grailmarket.app",
    role: "moderator",
    title: "Moderator",
    status: "active",
    location: "Bengaluru, IN",
    since: "Jun 2024",
    lastActive: "6 hours ago",
    decisions: 1466,
    medianDecision: "3h 12m",
    rating: 4.8,
    lead: false,
  },
  {
    id: "AD-009",
    name: "Tobias Lang",
    initials: "TL",
    email: "tobias.lang@grailmarket.app",
    role: "trust-safety",
    title: "Trust & safety",
    status: "active",
    location: "Berlin, DE",
    since: "Sep 2024",
    lastActive: "1 hour ago",
    decisions: 742,
    medianDecision: "6h 30m",
    rating: 4.9,
    lead: false,
  },
  {
    id: "AD-011",
    name: "Nadia Haddad",
    initials: "NH",
    email: "nadia.haddad@grailmarket.app",
    role: "trust-safety",
    title: "Trust & safety",
    status: "active",
    location: "Beirut, LB",
    since: "Nov 2024",
    lastActive: "20 minutes ago",
    decisions: 588,
    medianDecision: "5h 48m",
    rating: 4.8,
    lead: false,
  },
  /* ---------------------------------------------------------------------
     The outsourced desk.

     Two tiers, held by a different company in a different country. Every
     argument in the brief for running support this way depends on these
     accounts being able to answer a member without being able to reach the
     member directory, the ID exceptions or the listing queue — which is a
     claim about what the console lets them open, not about their contract.
     --------------------------------------------------------------------- */
  {
    id: "AD-021",
    name: "Reuben Castillo",
    initials: "RC",
    email: "r.castillo@northstar-cx.com",
    role: "tier-2",
    title: "Support · Tier 2",
    status: "active",
    location: "Manila, PH · Northstar CX",
    since: "Feb 2025",
    lastActive: "12 minutes ago",
    decisions: 3120,
    medianDecision: "38m",
    rating: 4.6,
    lead: false,
    outsourced: true,
  },
  {
    id: "AD-024",
    name: "Grace Mwangi",
    initials: "GM",
    email: "g.mwangi@northstar-cx.com",
    role: "tier-1",
    title: "Support · Tier 1",
    status: "active",
    location: "Nairobi, KE · Northstar CX",
    since: "Apr 2025",
    lastActive: "4 minutes ago",
    decisions: 5410,
    medianDecision: "21m",
    rating: 4.5,
    lead: false,
    outsourced: true,
  },
  {
    id: "AD-027",
    name: "Deniz Aydın",
    initials: "DA",
    email: "d.aydin@northstar-cx.com",
    role: "tier-1",
    title: "Support · Tier 1",
    status: "active",
    location: "Izmir, TR · Northstar CX",
    since: "Jun 2025",
    lastActive: "Now",
    decisions: 2988,
    medianDecision: "26m",
    rating: 4.4,
    lead: false,
    outsourced: true,
  },
  {
    id: "AD-030",
    name: "Imani Okafor",
    initials: "IO",
    email: "i.okafor@northstar-cx.com",
    role: "tier-1",
    title: "Support · Tier 1",
    status: "restricted",
    location: "Lagos, NG · Northstar CX",
    since: "Jul 2025",
    lastActive: "2 days ago",
    decisions: 611,
    medianDecision: "44m",
    rating: 3.9,
    lead: false,
    outsourced: true,
  },
];

/**
 * How urgent a conduct case is.
 *
 * What the trade was worth still counts, but it cannot be the whole of it:
 * threats are the most serious thing on this queue at any price, and a $60
 * card does not make them a small matter. The kind sets a floor, and money
 * and age move the number above it.
 */
const KIND_WEIGHT: Record<ConflictKind, number> = {
  threats: 7,
  counterfeit: 4,
  "off-platform": 3,
  "no-show": 2,
  "not-as-described": 2,
};

export function severityScore(kind: ConflictKind, amount: number, ageHours: number) {
  const raw = KIND_WEIGHT[kind] + amount / 4000 + ageHours / 36;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

export function severityOf(
  kind: ConflictKind,
  amount: number,
  ageHours: number
): "high" | "med" | "low" {
  const score = severityScore(kind, amount, ageHours);
  if (score >= 7) return "high";
  if (score >= 4) return "med";
  return "low";
}

/* ==========================================================================
   Formatting helpers
   ========================================================================== */

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Subscriptions are billed in Australian dollars and have to say so.
 *
 * `money` above is the marketplace's own formatter and is left alone here:
 * changing its currency would silently restate every price on every other
 * page, which is a decision about the whole console, not about this figure.
 */
export const aud = (n: number) => `A$${Math.round(n).toLocaleString("en-AU")}`;

export const compactMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`;

export const num = (n: number) => n.toLocaleString("en-US");

/** "31 Aug, 09:12" — short enough for a table cell, unambiguous enough to trust. */
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, ${d
    .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

export const dateOnly = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/** Initials from a name, for avatars where the record has none of its own. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export const tierLabel: Record<VerificationTier, string> = {
  grail: "Grail",
  "high-value": "High value",
  standard: "Standard",
};

export const statusLabel: Record<ListingStatus, string> = {
  awaiting: "Awaiting review",
  "in-review": "In review",
  "info-requested": "Info requested",
  live: "Live",
  sold: "Sold",
  paused: "Paused",
  withdrawn: "Withdrawn",
  rejected: "Rejected",
};
