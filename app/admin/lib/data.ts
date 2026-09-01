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

export type VerificationStatus =
  | "awaiting"
  | "in-review"
  | "info-requested"
  | "verified"
  | "rejected";

export type ListingStatus = "queued" | "live" | "sold" | "paused" | "withdrawn";

export type ConflictKind =
  | "not-as-described"
  | "non-delivery"
  | "authenticity"
  | "payment"
  | "grade-mismatch"
  | "damaged-in-transit";

export type ConflictStatus = "open" | "awaiting-evidence" | "escalated" | "resolved";

export type MemberStatus = "active" | "restricted" | "revoked" | "pending";

export type MemberRole = "buyer" | "seller" | "buyer-seller" | "consignor";

export type TicketStatus = "new" | "open" | "waiting" | "resolved";
export type TicketPriority = "urgent" | "high" | "normal" | "low";

/* ==========================================================================
   The signed-in operator (a placeholder until auth lands)
   ========================================================================== */

export const operator = {
  name: "Ayna Sulaiman",
  email: "ayna.sulaiman@calcite.live",
  role: "Lead moderator",
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
    label: "Open conflicts",
    value: "7",
    delta: { dir: "down", text: "2" },
    foot: "2 escalated past 72h",
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

export const queueMix = [
  { label: "Grail tier · >$5,000", value: 6, color: "#1a2632" },
  { label: "High value · $1k–$5k", value: 12, color: "#a88d60" },
  { label: "Standard · auto-listed", value: 143, color: "#cbb794" },
];

export const gameSplit = [
  { label: "Pokémon", value: 47, amount: "$194,100" },
  { label: "Sports", value: 24, amount: "$99,090" },
  { label: "Magic", value: 15, amount: "$61,930" },
  { label: "One Piece", value: 9, amount: "$37,160" },
  { label: "Yu-Gi-Oh!", value: 5, amount: "$20,600" },
];

export type ActivityItem = {
  id: string;
  tone: "ok" | "warn" | "bad" | "gold" | "plain";
  icon: "check" | "alert" | "ban" | "card" | "message" | "dollar";
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
    text: "Revoked access for **@vault_flipper** — three authenticity strikes in 30 days",
    actor: "Ayna Sulaiman",
    time: "48 minutes ago",
  },
  {
    id: "a3",
    tone: "warn",
    icon: "alert",
    text: "Conflict **CF-2291** escalated: buyer and seller both refused the split refund",
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
    text: "Replied to support ticket **SP-1180** about a payout hold",
    actor: "Marco Reyes",
    time: "3 hours ago",
  },
  {
    id: "a6",
    tone: "ok",
    icon: "dollar",
    text: "Released **$8,400** in held funds after conflict **CF-2287** closed in the seller's favour",
    actor: "Ayna Sulaiman",
    time: "5 hours ago",
  },
  {
    id: "a7",
    tone: "warn",
    icon: "alert",
    text: "**@cardsbyjules** rejected — slab label photo unreadable, resubmission requested",
    actor: "Priya Nandakumar",
    time: "6 hours ago",
  },
];

/* ==========================================================================
   Verification queue
   ========================================================================== */

export type Submission = {
  id: string;
  card: string;
  /** Slug under `public/cards/`; absent means the drawn slab stands in. */
  art?: string;
  setLine: string;
  game: Game;
  grader: Grader;
  grade: string;
  cert: string;
  askPrice: number;
  marketPrice: number;
  confidence: Confidence;
  sampleSize: number;
  tier: VerificationTier;
  status: VerificationStatus;
  seller: { handle: string; name: string; initials: string; sales: number; rating: number };
  submitted: string;
  slaHours: number;
  flags: string[];
  photos: number;
  note?: string;
};

export const submissions: Submission[] = [
  {
    id: "VF-4821",
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
    seller: { handle: "@holo_vault", name: "Daniel Wu", initials: "DW", sales: 214, rating: 4.9 },
    submitted: "2026-08-31T09:12:00Z",
    slaHours: 3,
    flags: ["Above grail floor", "First grail-tier listing from this seller"],
    photos: 6,
  },
  {
    id: "VF-4820",
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
    seller: { handle: "@courtsidecards", name: "Marcus Hale", initials: "MH", sales: 512, rating: 4.8 },
    submitted: "2026-08-31T07:40:00Z",
    slaHours: 5,
    flags: ["Subgrades not visible in submitted photos"],
    photos: 4,
    note: "Asked seller for a straight-on shot of the subgrade block.",
  },
  {
    id: "VF-4818",
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
    seller: { handle: "@alphaonly", name: "Rosa Iqbal", initials: "RI", sales: 76, rating: 5.0 },
    submitted: "2026-08-31T05:02:00Z",
    slaHours: 1,
    flags: ["Alpha vs Beta border needs manual confirmation", "Ask 10% over last comparable"],
    photos: 8,
  },
  {
    id: "VF-4815",
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
    seller: { handle: "@kanto_archive", name: "Yuki Tanaka", initials: "YT", sales: 31, rating: 4.7 },
    submitted: "2026-08-30T22:18:00Z",
    slaHours: -4,
    flags: [
      "Only 2 comparable sales on record — price cannot be confirmed",
      "Provenance documents requested",
      "SLA breached",
    ],
    photos: 11,
    note: "Waiting on the 2021 auction house invoice before this can move.",
  },
  {
    id: "VF-4812",
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
    seller: { handle: "@grandline_gr", name: "Sofia Marchetti", initials: "SM", sales: 148, rating: 4.9 },
    submitted: "2026-08-30T18:55:00Z",
    slaHours: 8,
    flags: [],
    photos: 5,
  },
  {
    id: "VF-4809",
    card: "Blue-Eyes White Dragon",
    art: "yugioh-blue-eyes",
    setLine: "2002 LOB · 1st Edition · North America",
    game: "Yu-Gi-Oh!",
    grader: "BGS",
    grade: "9",
    cert: "BGS 0014220875",
    askPrice: 3400,
    marketPrice: 2950,
    confidence: "medium",
    sampleSize: 14,
    tier: "high-value",
    status: "in-review",
    seller: { handle: "@duelistdepot", name: "Amir Farooq", initials: "AF", sales: 89, rating: 4.6 },
    submitted: "2026-08-30T14:30:00Z",
    slaHours: 12,
    flags: ["Ask sits 15% over market"],
    photos: 4,
  },
  {
    id: "VF-4806",
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
    status: "verified",
    seller: { handle: "@moonbreon_co", name: "Elena Petrova", initials: "EP", sales: 366, rating: 5.0 },
    submitted: "2026-08-29T11:20:00Z",
    slaHours: 0,
    flags: [],
    photos: 6,
    note: "Cleared. Cert matched PSA's register, photos consistent.",
  },
  {
    id: "VF-4802",
    card: "Mickey Mantle #311",
    setLine: "1952 Topps · Reprint suspected",
    game: "Sports",
    grader: "Raw",
    grade: "—",
    cert: "—",
    askPrice: 41000,
    marketPrice: 0,
    confidence: "low",
    sampleSize: 0,
    tier: "grail",
    status: "rejected",
    seller: { handle: "@vault_flipper", name: "Chris Doyle", initials: "CD", sales: 12, rating: 3.4 },
    submitted: "2026-08-28T16:05:00Z",
    slaHours: 0,
    flags: ["Print dot pattern inconsistent with 1952 stock", "Third authenticity strike"],
    photos: 9,
    note: "Rejected. Escalated to member review — access revoked.",
  },
];

export const verificationRules = [
  {
    key: "grail",
    title: "Grail tier",
    rule: "Ask price ≥ $5,000",
    detail:
      "Held for manual verification. Cert number checked against the grading company's register, every photo reviewed, provenance requested where the price has thin comparable data.",
    count: 6,
  },
  {
    key: "high-value",
    title: "High value",
    rule: "Ask price $1,000 – $4,999",
    detail:
      "Held for a lighter review: cert lookup and a photo pass. Clears automatically after 24h if no moderator touches it and the price sits inside the market band.",
    count: 12,
  },
  {
    key: "standard",
    title: "Standard",
    rule: "Ask price < $1,000",
    detail:
      "Goes straight to the listing queue. Sampled at 5% for spot checks, and pulled back if a member reports it.",
    count: 143,
  },
];

/* ==========================================================================
   Listing queue
   ========================================================================== */

export type Listing = {
  id: string;
  card: string;
  art?: string;
  setLine: string;
  game: Game;
  grader: Grader;
  grade: string;
  price: number;
  status: ListingStatus;
  seller: { handle: string; initials: string };
  releasedAt: string;
  views: number;
  watchers: number;
  verifiedBy?: string;
  tier: VerificationTier;
};

export const listings: Listing[] = [
  {
    id: "LS-9042",
    card: "Umbreon VMAX #215",
    art: "pokemon-umbreon",
    setLine: "2021 Evolving Skies · Alt Art",
    game: "Pokémon",
    grader: "PSA",
    grade: "10",
    price: 2280,
    status: "live",
    seller: { handle: "@moonbreon_co", initials: "EP" },
    releasedAt: "2026-08-29T12:02:00Z",
    views: 1840,
    watchers: 96,
    verifiedBy: "Ayna Sulaiman",
    tier: "high-value",
  },
  {
    id: "LS-9041",
    card: "Giannis Antetokounmpo #340",
    setLine: "2013 Panini Prizm · Rookie",
    game: "Sports",
    grader: "PSA",
    grade: "10",
    price: 6900,
    status: "live",
    seller: { handle: "@courtsidecards", initials: "MH" },
    releasedAt: "2026-08-29T09:41:00Z",
    views: 2210,
    watchers: 141,
    verifiedBy: "Marco Reyes",
    tier: "grail",
  },
  {
    id: "LS-9038",
    card: "Mox Sapphire",
    art: "magic-mox-sapphire",
    setLine: "1993 Beta · Border verified",
    game: "Magic",
    grader: "BGS",
    grade: "8",
    price: 9750,
    status: "queued",
    seller: { handle: "@alphaonly", initials: "RI" },
    releasedAt: "2026-08-31T08:10:00Z",
    views: 0,
    watchers: 0,
    verifiedBy: "Ayna Sulaiman",
    tier: "grail",
  },
  {
    id: "LS-9036",
    card: "Lugia #9",
    art: "pokemon-lugia",
    setLine: "2000 Neo Genesis · 1st Edition Holo",
    game: "Pokémon",
    grader: "CGC",
    grade: "9.5",
    price: 3120,
    status: "live",
    seller: { handle: "@johto_grails", initials: "TK" },
    releasedAt: "2026-08-28T16:20:00Z",
    views: 980,
    watchers: 54,
    verifiedBy: "Priya Nandakumar",
    tier: "high-value",
  },
  {
    id: "LS-9031",
    card: "Shohei Ohtani #660",
    setLine: "2018 Topps Update · Rookie Debut",
    game: "Sports",
    grader: "PSA",
    grade: "10",
    price: 1420,
    status: "sold",
    seller: { handle: "@pacificrim_pc", initials: "HN" },
    releasedAt: "2026-08-24T10:00:00Z",
    views: 3410,
    watchers: 202,
    verifiedBy: "Marco Reyes",
    tier: "high-value",
  },
  {
    id: "LS-9027",
    card: "Roronoa Zoro · Parallel",
    setLine: "OP-02 Paramount War",
    game: "One Piece",
    grader: "PSA",
    grade: "9",
    price: 640,
    status: "live",
    seller: { handle: "@grandline_gr", initials: "SM" },
    releasedAt: "2026-08-27T13:55:00Z",
    views: 512,
    watchers: 18,
    tier: "standard",
  },
  {
    id: "LS-9019",
    card: "Dark Magician Girl",
    art: "yugioh-dark-magician-girl",
    setLine: "2003 MFC · 1st Edition Secret Rare",
    game: "Yu-Gi-Oh!",
    grader: "BGS",
    grade: "9",
    price: 2050,
    status: "paused",
    seller: { handle: "@duelistdepot", initials: "AF" },
    releasedAt: "2026-08-22T08:30:00Z",
    views: 1105,
    watchers: 63,
    verifiedBy: "Ayna Sulaiman",
    tier: "high-value",
  },
  {
    id: "LS-9008",
    card: "Blastoise #2",
    art: "pokemon-blastoise",
    setLine: "1999 Base Set · Shadowless Holo",
    game: "Pokémon",
    grader: "PSA",
    grade: "9",
    price: 5400,
    status: "withdrawn",
    seller: { handle: "@vault_flipper", initials: "CD" },
    releasedAt: "2026-08-18T19:12:00Z",
    views: 760,
    watchers: 27,
    verifiedBy: "Priya Nandakumar",
    tier: "grail",
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
  amount: number;
  heldFunds: boolean;
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
    kind: "grade-mismatch",
    status: "escalated",
    opened: "2026-08-28T14:20:00Z",
    amount: 6900,
    heldFunds: true,
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
      "The slab that arrived is a PSA 9, not the PSA 10 in the listing. The cert number on the label does not match the one shown in the listing photos.",
    sellerClaim:
      "I shipped the exact slab I photographed. The buyer is comparing against a screenshot from a different listing of mine — I have two Giannis Prizms and both were live that week.",
    evidence: [
      { label: "Slab label close-up (received)", from: "buyer", kind: "photo" },
      { label: "Original listing photo set (6)", from: "seller", kind: "photo" },
      { label: "Packing video, 4m12s", from: "seller", kind: "document" },
      { label: "UPS delivery scan", from: "seller", kind: "tracking" },
    ],
    timeline: [
      { at: "28 Aug, 14:20", by: "Owen Fitzgerald", side: "buyer", text: "Opened a conflict: grade does not match the listing." },
      { at: "28 Aug, 16:02", by: "System", side: "system", text: "Payout of $6,900 placed on hold." },
      { at: "29 Aug, 09:15", by: "Marcus Hale", side: "seller", text: "Submitted packing video and the original photo set." },
      { at: "30 Aug, 11:40", by: "Marco Reyes", side: "admin", text: "Proposed a 50/50 split. Both parties declined." },
      { at: "31 Aug, 08:05", by: "System", side: "system", text: "Escalated — open past 72 hours with no agreement." },
    ],
    ageHours: 78,
  },
  {
    id: "CF-2289",
    kind: "non-delivery",
    status: "awaiting-evidence",
    opened: "2026-08-30T09:05:00Z",
    amount: 1420,
    heldFunds: true,
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
      "Tracking has said 'label created' for nine days. No package, no reply to two messages.",
    sellerClaim: "Awaiting a response from the seller.",
    evidence: [
      { label: "Tracking history export", from: "buyer", kind: "tracking" },
      { label: "Message thread screenshots", from: "buyer", kind: "document" },
    ],
    timeline: [
      { at: "30 Aug, 09:05", by: "Jade Lim", side: "buyer", text: "Opened a conflict: item never shipped." },
      { at: "30 Aug, 09:06", by: "System", side: "system", text: "Payout of $1,420 placed on hold. Seller given 72h to respond." },
      { at: "31 Aug, 10:00", by: "System", side: "system", text: "Reminder sent to the seller. 24h remaining." },
    ],
    ageHours: 30,
  },
  {
    id: "CF-2288",
    kind: "damaged-in-transit",
    status: "open",
    opened: "2026-08-30T18:40:00Z",
    amount: 3120,
    heldFunds: true,
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
      "The slab arrived cracked along the top seam. The card itself looks fine but the case is compromised and CGC will not honour it as-is.",
    sellerClaim:
      "It left here intact — I have unboxing footage. This is a courier problem and the parcel was insured for full value.",
    evidence: [
      { label: "Cracked slab, 5 angles", from: "buyer", kind: "photo" },
      { label: "Packing footage", from: "seller", kind: "document" },
      { label: "Insurance certificate", from: "seller", kind: "document" },
    ],
    timeline: [
      { at: "30 Aug, 18:40", by: "Tom Bennett", side: "buyer", text: "Opened a conflict: slab damaged in transit." },
      { at: "30 Aug, 18:41", by: "System", side: "system", text: "Payout of $3,120 placed on hold." },
      { at: "31 Aug, 07:30", by: "Takumi Kondo", side: "seller", text: "Submitted packing footage and insurance certificate." },
    ],
    ageHours: 21,
  },
  {
    id: "CF-2285",
    kind: "authenticity",
    status: "open",
    opened: "2026-08-29T12:15:00Z",
    amount: 5400,
    heldFunds: true,
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
      "The slab looks resealed. The label font weight is off and there is adhesive residue on the inner lip.",
    sellerClaim: "Bought it this way at a show. I have no way to know.",
    evidence: [
      { label: "Macro shots of the seam (8)", from: "buyer", kind: "photo" },
      { label: "PSA register lookup", from: "buyer", kind: "document" },
    ],
    timeline: [
      { at: "29 Aug, 12:15", by: "Ines Duarte", side: "buyer", text: "Opened a conflict: suspected resealed slab." },
      { at: "29 Aug, 12:16", by: "System", side: "system", text: "Payout of $5,400 placed on hold." },
      { at: "30 Aug, 15:00", by: "Ayna Sulaiman", side: "admin", text: "Listing withdrawn pending review. Seller's other listings frozen." },
    ],
    ageHours: 45,
  },
  {
    id: "CF-2287",
    kind: "not-as-described",
    status: "resolved",
    opened: "2026-08-26T10:00:00Z",
    amount: 8400,
    heldFunds: false,
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
    buyerClaim: "Listing said 'mint case'. There is a hairline scuff on the front of the slab.",
    sellerClaim: "The scuff is visible in listing photo 3 and was disclosed in the description.",
    evidence: [
      { label: "Listing photo 3, annotated", from: "seller", kind: "photo" },
      { label: "Received condition photos", from: "buyer", kind: "photo" },
    ],
    timeline: [
      { at: "26 Aug, 10:00", by: "Ryan Osei", side: "buyer", text: "Opened a conflict: case condition not as described." },
      { at: "27 Aug, 14:20", by: "Daniel Wu", side: "seller", text: "Pointed to the disclosure in photo 3." },
      { at: "31 Aug, 06:10", by: "Ayna Sulaiman", side: "admin", text: "Resolved for the seller — the scuff was disclosed. Funds released." },
    ],
    ageHours: 120,
  },
];

export const conflictKindLabel: Record<ConflictKind, string> = {
  "not-as-described": "Not as described",
  "non-delivery": "Non-delivery",
  authenticity: "Authenticity",
  payment: "Payment",
  "grade-mismatch": "Grade mismatch",
  "damaged-in-transit": "Damaged in transit",
};

export const resolutionOptions = [
  {
    key: "buyer",
    title: "Full refund to buyer",
    detail: "Return required. Funds move back within 2 business days once tracking shows delivery.",
  },
  {
    key: "seller",
    title: "Release funds to seller",
    detail: "Closes the conflict in the seller's favour. The hold is lifted immediately.",
  },
  {
    key: "split",
    title: "Partial refund",
    detail: "Split the amount. Both sides must accept, or it escalates back here.",
  },
  {
    key: "return",
    title: "Return and relist",
    detail: "Card goes back to the seller, buyer is made whole, the listing re-enters verification.",
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
  joined: string;
  lastSeen: string;
  country: string;
  sales: number;
  purchases: number;
  volume: number;
  rating: number;
  strikes: number;
  verifiedSeller: boolean;
  note?: string;
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
    joined: "2023-05-14",
    lastSeen: "12 minutes ago",
    country: "Portugal",
    sales: 366,
    purchases: 91,
    volume: 428400,
    rating: 5.0,
    strikes: 0,
    verifiedSeller: true,
  },
  {
    id: "MB-0987",
    handle: "@courtsidecards",
    name: "Marcus Hale",
    initials: "MH",
    email: "marcus@courtsidecards.com",
    role: "seller",
    status: "active",
    joined: "2023-01-09",
    lastSeen: "1 hour ago",
    country: "United States",
    sales: 512,
    purchases: 14,
    volume: 741200,
    rating: 4.8,
    strikes: 1,
    verifiedSeller: true,
    note: "One open grade-mismatch conflict (CF-2291).",
  },
  {
    id: "MB-1188",
    handle: "@vault_flipper",
    name: "Chris Doyle",
    initials: "CD",
    email: "cdoyle.trades@mail.com",
    role: "seller",
    status: "revoked",
    joined: "2026-07-02",
    lastSeen: "48 minutes ago",
    country: "Ireland",
    sales: 12,
    purchases: 3,
    volume: 21800,
    rating: 3.4,
    strikes: 3,
    verifiedSeller: false,
    note: "Access revoked 31 Aug — three authenticity strikes in 30 days. Two listings withdrawn, $5,400 held pending CF-2285.",
  },
  {
    id: "MB-0771",
    handle: "@holo_vault",
    name: "Daniel Wu",
    initials: "DW",
    email: "dan@holovault.io",
    role: "buyer-seller",
    status: "active",
    joined: "2023-02-27",
    lastSeen: "3 hours ago",
    country: "Singapore",
    sales: 214,
    purchases: 158,
    volume: 512900,
    rating: 4.9,
    strikes: 0,
    verifiedSeller: true,
  },
  {
    id: "MB-1301",
    handle: "@duelistdepot",
    name: "Amir Farooq",
    initials: "AF",
    email: "amir@duelistdepot.net",
    role: "seller",
    status: "restricted",
    joined: "2024-11-18",
    lastSeen: "9 hours ago",
    country: "United Arab Emirates",
    sales: 89,
    purchases: 22,
    volume: 96300,
    rating: 4.6,
    strikes: 2,
    verifiedSeller: false,
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
    joined: "2025-03-30",
    lastSeen: "22 minutes ago",
    country: "United Kingdom",
    sales: 76,
    purchases: 4,
    volume: 318700,
    rating: 5.0,
    strikes: 0,
    verifiedSeller: true,
  },
  {
    id: "MB-1512",
    handle: "@grandline_gr",
    name: "Sofia Marchetti",
    initials: "SM",
    email: "sofia.m@grandline.gr",
    role: "buyer-seller",
    status: "active",
    joined: "2024-08-04",
    lastSeen: "5 hours ago",
    country: "Greece",
    sales: 148,
    purchases: 203,
    volume: 187500,
    rating: 4.9,
    strikes: 0,
    verifiedSeller: true,
  },
  {
    id: "MB-1633",
    handle: "@kanto_archive",
    name: "Yuki Tanaka",
    initials: "YT",
    email: "yuki@kantoarchive.jp",
    role: "consignor",
    status: "pending",
    joined: "2026-08-19",
    lastSeen: "1 day ago",
    country: "Japan",
    sales: 31,
    purchases: 0,
    volume: 402000,
    rating: 4.7,
    strikes: 0,
    verifiedSeller: false,
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
    joined: "2024-03-11",
    lastSeen: "2 hours ago",
    country: "United States",
    sales: 0,
    purchases: 46,
    volume: 88400,
    rating: 4.8,
    strikes: 0,
    verifiedSeller: false,
  },
  {
    id: "MB-1802",
    handle: "@johto_grails",
    name: "Takumi Kondo",
    initials: "TK",
    email: "takumi@johtograils.jp",
    role: "seller",
    status: "active",
    joined: "2023-08-21",
    lastSeen: "6 hours ago",
    country: "Japan",
    sales: 194,
    purchases: 31,
    volume: 264100,
    rating: 4.9,
    strikes: 0,
    verifiedSeller: true,
  },
  {
    id: "MB-1877",
    handle: "@pacificrim_pc",
    name: "Hana Nakamura",
    initials: "HN",
    email: "hana@pacificrim.pc",
    role: "seller",
    status: "restricted",
    joined: "2024-06-02",
    lastSeen: "4 days ago",
    country: "Japan",
    sales: 141,
    purchases: 8,
    volume: 112900,
    rating: 4.5,
    strikes: 1,
    verifiedSeller: true,
    note: "Payouts frozen while CF-2289 (non-delivery) is open.",
  },
  {
    id: "MB-1901",
    handle: "@shadowless_only",
    name: "Ines Duarte",
    initials: "ID",
    email: "ines@shadowless.pt",
    role: "buyer",
    status: "active",
    joined: "2024-09-15",
    lastSeen: "8 hours ago",
    country: "Portugal",
    sales: 0,
    purchases: 62,
    volume: 141600,
    rating: 5.0,
    strikes: 0,
    verifiedSeller: false,
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
   ========================================================================== */

export type Report = {
  id: string;
  name: string;
  detail: string;
  cadence: string;
  updated: string;
  format: string;
  category: "Marketplace" | "Moderation" | "Finance" | "Members";
};

export const reports: Report[] = [
  {
    id: "RP-01",
    name: "GMV and take rate",
    detail: "Gross merchandise value, commission collected, and take rate by game and price band.",
    cadence: "Daily · 06:00 UTC",
    updated: "2 hours ago",
    format: "CSV · XLSX",
    category: "Marketplace",
  },
  {
    id: "RP-02",
    name: "Verification throughput",
    detail: "Submissions in, cleared, rejected, and time-to-decision against the 24h SLA, split by tier.",
    cadence: "Daily · 06:00 UTC",
    updated: "2 hours ago",
    format: "CSV",
    category: "Moderation",
  },
  {
    id: "RP-03",
    name: "Conflict outcomes",
    detail: "Every conflict closed in the period, its category, who it went to, and the amount moved.",
    cadence: "Weekly · Monday",
    updated: "3 days ago",
    format: "CSV · PDF",
    category: "Moderation",
  },
  {
    id: "RP-04",
    name: "Payouts and holds",
    detail: "Funds released, funds held, and the age of every hold still open at the cut-off.",
    cadence: "Daily · 23:00 UTC",
    updated: "9 hours ago",
    format: "CSV · XLSX",
    category: "Finance",
  },
  {
    id: "RP-05",
    name: "Member growth and churn",
    detail: "Sign-ups, first-sale conversion, dormancy, restrictions and revocations.",
    cadence: "Weekly · Monday",
    updated: "3 days ago",
    format: "CSV",
    category: "Members",
  },
  {
    id: "RP-06",
    name: "Price confidence audit",
    detail:
      "Listings that went live on a low-confidence valuation, with sample size and the last comparable sale date attached.",
    cadence: "Weekly · Friday",
    updated: "4 days ago",
    format: "CSV",
    category: "Marketplace",
  },
  {
    id: "RP-07",
    name: "Seller concentration",
    detail: "Share of GMV by seller, flagged where one account exceeds 8% of the period.",
    cadence: "Monthly",
    updated: "12 days ago",
    format: "XLSX",
    category: "Marketplace",
  },
  {
    id: "RP-08",
    name: "Moderation audit log",
    detail: "Every admin action taken: who, what, when, and the reason recorded at the time.",
    cadence: "On demand",
    updated: "Live",
    format: "CSV · JSON",
    category: "Moderation",
  },
];

export const reportKpis: Stat[] = [
  { key: "r1", label: "Verified this month", value: "284", delta: { dir: "up", text: "18%" }, foot: "of 312 submitted", tone: "navy" },
  { key: "r2", label: "Median time to decision", value: "5h 12m", delta: { dir: "down", text: "1h 40m" }, foot: "SLA is 24h", tone: "gold" },
  { key: "r3", label: "Rejection rate", value: "9.0%", delta: { dir: "flat", text: "0.2%" }, foot: "28 of 312" },
  { key: "r4", label: "Conflict rate", value: "1.4%", delta: { dir: "down", text: "0.5%" }, foot: "of completed orders" },
];

export const decisionSplit = [
  { label: "Verified", value: 284, color: "#1f8a5b" },
  { label: "Rejected", value: 28, color: "#c0392f" },
  { label: "Info requested", value: 41, color: "#b0761d" },
  { label: "Auto-cleared", value: 619, color: "#a88d60" },
];

export const conflictOutcomes = [
  { label: "Resolved for buyer", value: 38 },
  { label: "Resolved for seller", value: 51 },
  { label: "Partial refund", value: 22 },
  { label: "Return and relist", value: 14 },
  { label: "Withdrawn by buyer", value: 9 },
];

/* ==========================================================================
   Support
   ========================================================================== */

export type Ticket = {
  id: string;
  subject: string;
  preview: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  member: { handle: string; name: string; initials: string; role: MemberRole };
  opened: string;
  lastReply: string;
  assignee?: string;
  thread: { from: "member" | "admin"; author: string; text: string; at: string }[];
};

export const tickets: Ticket[] = [
  {
    id: "SP-1194",
    subject: "Payout still on hold after the conflict closed",
    preview:
      "CF-2287 was resolved in my favour four days ago but the $8,400 has not landed. Support said 2 business days.",
    status: "new",
    priority: "urgent",
    category: "Payouts",
    member: { handle: "@holo_vault", name: "Daniel Wu", initials: "DW", role: "buyer-seller" },
    opened: "2026-08-31T08:40:00Z",
    lastReply: "45 minutes ago",
    thread: [
      {
        from: "member",
        author: "Daniel Wu",
        at: "31 Aug, 08:40",
        text: "CF-2287 was resolved in my favour four days ago but the $8,400 has not landed. Support said 2 business days. It has been four.",
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
    category: "Verification",
    member: { handle: "@kanto_archive", name: "Yuki Tanaka", initials: "YT", role: "consignor" },
    opened: "2026-08-30T11:15:00Z",
    lastReply: "2 hours ago",
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
        text: "Thank you — the invoice arrived. A card at this price with two comparable sales on record needs a second reviewer, which is where it sits now. I will come back to you within 48 hours either way.",
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
    subject: "Cannot list — account says restricted",
    preview: "I can browse and buy but the sell button is gone. No email explaining why.",
    status: "open",
    priority: "high",
    category: "Account",
    member: { handle: "@duelistdepot", name: "Amir Farooq", initials: "AF", role: "seller" },
    opened: "2026-08-30T07:22:00Z",
    lastReply: "1 day ago",
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
    category: "Verification",
    member: { handle: "@neo_era", name: "Tom Bennett", initials: "TB", role: "buyer" },
    opened: "2026-08-29T16:05:00Z",
    lastReply: "2 days ago",
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
        text: "All four, plus TAG. Each grader is priced on its own scale — we never convert a grade between companies to reach a figure, so a CGC 9.5 is valued from CGC 9.5 sales only.",
      },
    ],
  },
  {
    id: "SP-1185",
    subject: "Buyer is asking me to complete the sale off-platform",
    preview: "Screenshotting this rather than replying. Handle attached.",
    status: "open",
    priority: "urgent",
    category: "Trust and safety",
    member: { handle: "@grandline_gr", name: "Sofia Marchetti", initials: "SM", role: "buyer-seller" },
    opened: "2026-08-29T09:48:00Z",
    lastReply: "3 hours ago",
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
    subject: "Refund arrived short by the shipping cost",
    preview: "Full refund was agreed but the shipping was deducted. $18 short.",
    status: "resolved",
    priority: "low",
    category: "Payouts",
    member: { handle: "@galar_pc", name: "Ryan Osei", initials: "RO", role: "buyer" },
    opened: "2026-08-27T13:00:00Z",
    lastReply: "3 hours ago",
    assignee: "Marco Reyes",
    thread: [
      {
        from: "member",
        author: "Ryan Osei",
        at: "27 Aug, 13:00",
        text: "A full refund was agreed but the shipping cost was deducted. I am $18 short.",
      },
      {
        from: "admin",
        author: "Marco Reyes",
        at: "31 Aug, 05:40",
        text: "You are right — outbound shipping should not have been deducted on a full refund. The $18 has been sent and the rule has been corrected so it does not repeat.",
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

export const cannedReplies = [
  { key: "sla", label: "Verification is still in review" },
  { key: "hold", label: "Why funds are on hold" },
  { key: "restrict", label: "Explaining a restriction" },
  { key: "grader", label: "Which graders we accept" },
  { key: "offplat", label: "Off-platform contact warning" },
];

/* ==========================================================================
   Settings
   ========================================================================== */

export const adminTeam = [
  {
    name: "Ayna Sulaiman",
    initials: "AS",
    email: "ayna.sulaiman@calcite.live",
    role: "Lead moderator",
    scopes: "Verification · Conflicts · Members · Settings",
    lastActive: "Now",
  },
  {
    name: "Marco Reyes",
    initials: "MR",
    email: "marco.reyes@grailmarket.app",
    role: "Moderator",
    scopes: "Verification · Conflicts · Support",
    lastActive: "3 hours ago",
  },
  {
    name: "Priya Nandakumar",
    initials: "PN",
    email: "priya.n@grailmarket.app",
    role: "Moderator",
    scopes: "Verification · Support",
    lastActive: "6 hours ago",
  },
  {
    name: "Ops service account",
    initials: "OP",
    email: "ops-bot@grailmarket.app",
    role: "Service account",
    scopes: "Reports · Audit log (read-only)",
    lastActive: "18 minutes ago",
  },
];


/* ==========================================================================
   Pricing plans

   Stripe holds the real prices; this is the admin-facing mirror of them.
   Editing a figure here is a write to Stripe, not a local override — which is
   why each plan carries its Stripe price id and the console shows it.
   ========================================================================== */

export type Plan = {
  key: string;
  name: string;
  price: number | null;
  /** null price = "Custom", quoted per account rather than listed. */
  cadence: string;
  tagline: string;
  featured: boolean;
  stripePriceId: string;
  subscribers: number;
  features: string[];
};

export const plans: Plan[] = [
  {
    key: "collector",
    name: "Collector",
    price: 0,
    cadence: "month",
    tagline: "For someone selling out of their own collection.",
    featured: false,
    stripePriceId: "price_1QkCollector00",
    subscribers: 4820,
    features: [
      "5 active listings",
      "Standard-tier auto listing",
      "9.5% commission on a sale",
      "Community support",
    ],
  },
  {
    key: "dealer",
    name: "Dealer",
    price: 39,
    cadence: "month",
    tagline: "For a shop moving stock every week.",
    featured: true,
    stripePriceId: "price_1QkDealer000",
    subscribers: 1146,
    features: [
      "Unlimited active listings",
      "Priority verification queue",
      "7.5% commission on a sale",
      "Bulk upload and CSV import",
      "Sales analytics",
    ],
  },
  {
    key: "house",
    name: "House",
    price: null,
    cadence: "month",
    tagline: "For auction houses and consignment at volume.",
    featured: false,
    stripePriceId: "price_1QkHouse0000",
    subscribers: 27,
    features: [
      "Everything in Dealer",
      "Negotiated commission",
      "Dedicated verification lane",
      "Consignment agreements",
      "Named account manager",
    ],
  },
];

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
  title: string;
  status: "active" | "restricted" | "revoked";
  scopes: string[];
  location: string;
  since: string;
  lastActive: string;
  decisions: number;
  medianDecision: string;
  rating: number;
  lead: boolean;
};

export const staff: Staff[] = [
  {
    id: "AD-001",
    name: "Ayna Sulaiman",
    initials: "AS",
    email: "ayna.sulaiman@calcite.live",
    title: "Lead moderator",
    status: "active",
    scopes: ["Verification", "Conflicts", "Members", "Pricing", "Settings"],
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
    title: "Moderator",
    status: "active",
    scopes: ["Verification", "Conflicts", "Support"],
    location: "Lisbon, PT",
    since: "Mar 2024",
    lastActive: "3 hours ago",
    decisions: 1962,
    medianDecision: "5h 02m",
    rating: 4.7,
    lead: false,
  },
  {
    id: "AD-007",
    name: "Priya Nandakumar",
    initials: "PN",
    email: "priya.n@grailmarket.app",
    title: "Moderator",
    status: "active",
    scopes: ["Verification", "Support"],
    location: "Bengaluru, IN",
    since: "Sep 2024",
    lastActive: "6 hours ago",
    decisions: 1104,
    medianDecision: "4h 18m",
    rating: 4.8,
    lead: false,
  },
  {
    id: "AD-011",
    name: "Tobias Lang",
    initials: "TL",
    email: "tobias.lang@grailmarket.app",
    title: "Authentication specialist",
    status: "active",
    scopes: ["Verification", "Grail tier"],
    location: "Berlin, DE",
    since: "Feb 2025",
    lastActive: "1 day ago",
    decisions: 418,
    medianDecision: "9h 55m",
    rating: 5.0,
    lead: false,
  },
  {
    id: "AD-013",
    name: "Nadia Haddad",
    initials: "NH",
    email: "nadia.haddad@grailmarket.app",
    title: "Support lead",
    status: "active",
    scopes: ["Support", "Members"],
    location: "Amman, JO",
    since: "May 2025",
    lastActive: "22 minutes ago",
    decisions: 76,
    medianDecision: "1h 12m",
    rating: 4.9,
    lead: false,
  },
  {
    id: "AD-015",
    name: "Ops service account",
    initials: "OP",
    email: "ops-bot@grailmarket.app",
    title: "Service account",
    status: "restricted",
    scopes: ["Reports", "Audit log"],
    location: "eu-west-1",
    since: "Jan 2024",
    lastActive: "18 minutes ago",
    decisions: 0,
    medianDecision: "—",
    rating: 0,
    lead: false,
  },
];

/** How severe a conflict is, from the amount held and how long it has run. */
export function severityOf(amount: number, ageHours: number): "high" | "med" | "low" {
  const score = Math.min(10, Math.round(amount / 2000 + ageHours / 24));
  if (score >= 7) return "high";
  if (score >= 4) return "med";
  return "low";
}

export function severityScore(amount: number, ageHours: number) {
  return Math.max(1, Math.min(10, Math.round(amount / 2000 + ageHours / 24)));
}

/* ==========================================================================
   Formatting helpers
   ========================================================================== */

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

export const statusLabel: Record<VerificationStatus, string> = {
  awaiting: "Awaiting review",
  "in-review": "In review",
  "info-requested": "Info requested",
  verified: "Verified",
  rejected: "Rejected",
};
