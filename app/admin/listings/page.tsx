"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  checksFor,
  dateOnly,
  flagsFor,
  IN_QUEUE,
  MIN_ANGLES,
  money,
  num,
  operator,
  overMarket,
  shortDate,
  type ListingStatus,
} from "../lib/data";
import {
  ApiError,
  claimListing,
  decideListing,
  fetchListing,
  setMarketState,
  useListings,
  type AdminListing,
  type Comp,
  type Photo,
} from "../lib/api";
import {
  Badge,
  Card,
  CardBody,
  CardHead,
  CheckList,
  ConfidenceBadge,
  DL,
  RecordModal,
  Empty,
  ListingBadge,
  Modal,
  Note,
  FilterMenu,
  PageHead,
  Slab,
  Tier,
  GameChip,
  CardTile,
  Toast,
  ViewToggle,
} from "../components/ui";
import {
  IconBan,
  IconAlert,
  IconCheck,
  IconDownload,
  IconExternal,
  IconEye,
  IconListing,
  IconMail,
  IconNote,
  IconSearch,
  IconUsers,
  IconX,
  IconXCircle,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { exportCsv } from "../lib/csv";

/**
 * The listing queue — the whole life of a listing, on one page.
 *
 * This used to be two routes. `/admin/verification` held the review, with the
 * reasons and the flags and the photo set, and `/admin/listings` held a
 * publish button; a listing had to clear one and then be pushed through the
 * other. The feature set describes a single thing — every new listing is read
 * by a human before it goes live — so there is now a single queue, and
 * approving a listing is what puts it on the market.
 */

/** The tabs, and which statuses each one gathers. */
const VIEWS = [
  { key: "queue", label: "Needs a decision", statuses: ["awaiting", "in-review"] },
  { key: "seller", label: "Waiting on seller", statuses: ["info-requested"] },
  { key: "market", label: "On the market", statuses: ["live", "sold", "paused"] },
  { key: "closed", label: "Off the market", statuses: ["withdrawn", "rejected"] },
  { key: "all", label: "All", statuses: [] },
] as const;

type View = (typeof VIEWS)[number]["key"];

type Decision = "approve" | "reject" | "request";

const DECISION_COPY: Record<
  Decision,
  { title: string; sub: string; cta: string; tone: string; status: ListingStatus }
> = {
  approve: {
    title: "Approve and publish",
    sub: "It goes on the market the moment this is confirmed. There is no second step.",
    cta: "Approve and publish",
    tone: "gm-btn--primary",
    status: "live",
  },
  reject: {
    title: "Reject this listing",
    sub: "The seller is told why, word for word, and the reason is filed on their record.",
    cta: "Reject and notify",
    tone: "gm-btn--danger",
    status: "rejected",
  },
  request: {
    title: "Ask the seller for more",
    sub: "The listing pauses and the review clock stops until they reply.",
    cta: "Send the request",
    tone: "gm-btn--gold",
    status: "info-requested",
  },
};

/** One line of the seller's listing history, as the API returns it. */
type HistoryEntry = {
  id: string;
  card: string;
  setName: string | null;
  status: string;
  price: number;
  reason: string | null;
  by: string | null;
  at: string;
};

/** Everything the open record needs, fetched in one call. */
type OpenRecord = {
  listing: AdminListing;
  comps: Comp[];
  photos: Photo[];
  history: HistoryEntry[];
};

/** The store's own status words, in the console's vocabulary. Only the
 *  history feed needs this — everything else arrives already translated. */
function historyStatus(s: string): ListingStatus {
  return s === "in_review"
    ? "awaiting"
    : s === "info_requested"
      ? "info-requested"
      : (["live", "sold", "paused", "rejected"].includes(s) ? s : "withdrawn") as ListingStatus;
}

/** Hold the search box still for a moment before asking the database. */
function useDebounced(value: string, ms: number) {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return held;
}

function ListingsPage() {
  const params = useSearchParams();
  const wanted = params.get("view");
  const fromUrl = (VIEWS.some((v) => v.key === wanted) ? wanted : "queue") as View;

  const [view, setView] = useState<View>(fromUrl);
  useEffect(() => setView(fromUrl), [fromUrl]);

  const [tier, setTier] = useState<"all" | "grail" | "high-value" | "standard">("all");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"table" | "gallery">("table");

  /* The queue itself. Filtering, searching and counting are the database's
     job now — doing them a second time in the client is how a console starts
     disagreeing with the thing it is a console for. */
  const debounced = useDebounced(query, 220);
  const { data, error, loading, reload } = useListings({ view, search: debounced, tier });
  const rows = data?.listings ?? [];
  const counts = data?.counts ?? { queue: 0, seller: 0, market: 0, closed: 0, all: 0 };

  const [openId, setOpenId] = useState<string | null>(null);
  const [record, setRecord] = useState<OpenRecord | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const open = record?.listing ?? null;
  const priceComps = record?.comps ?? [];
  const photoSet = record?.photos ?? [];
  const sellerRecord = record?.history ?? [];
  const breached = rows.filter((l) => IN_QUEUE.includes(l.status) && l.slaHours < 0).length;

  /* The row is opened by id and the record read from the API, not lifted out
     of the list: the list carries what a row needs, and the record needs the
     comps, the angles supplied and the seller's history as well. */
  useEffect(() => {
    if (!openId) {
      setRecord(null);
      setRecordError(null);
      return;
    }
    let live = true;
    setRecordError(null);
    fetchListing(openId)
      .then((r) => {
        if (live) setRecord(r as OpenRecord);
      })
      .catch((e) => {
        if (live) setRecordError(e instanceof ApiError ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, [openId]);

  function startDecision(d: Decision) {
    setReason("");
    setDecision(d);
  }

  /** Open a row, and take it, so a second moderator does not decide the same
   *  card. A claim that fails is not an error — somebody else has it, and
   *  looking at a listing you cannot decide is a normal thing to do. */
  async function openAndClaim(id: string, alsoClaim: boolean) {
    setOpenId(id);
    if (!alsoClaim) return;
    try {
      await claimListing(id);
      reload();
      setRecord((await fetchListing(id)) as OpenRecord);
    } catch (e) {
      if (e instanceof ApiError && e.code !== "already-claimed") {
        setToast({ title: "Could not claim it", body: e.message });
      }
    }
  }

  async function commit() {
    if (!open || !decision || busy) return;
    setBusy(true);
    try {
      const { listing, decidedBy } = await decideListing(
        open.id,
        decision,
        reason.trim(),
        decision === "approve" ? reason.trim() : undefined,
      );
      setDecision(null);
      setReason("");
      setOpenId(null);
      reload();
      setToast({
        title:
          decision === "approve"
            ? "Published to the market"
            : decision === "reject"
              ? "Rejected and the seller told"
              : "Request sent",
        body: `${listing.card} · ${listing.id} · decided by ${decidedBy} · the seller has been notified`,
      });
    } catch (e) {
      /* The API refuses a rejection with no reason, and refuses a transition
         the state machine does not allow. Both arrive here, and both are
         worth reading rather than swallowing — the row did not move. */
      setToast({
        title: "The decision did not go through",
        body: e instanceof ApiError ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  /** Pause, resume, withdraw — the levers on something already on sale. */
  async function setMarketStatus(
    l: { id: string; card: string },
    action: "pause" | "resume" | "withdraw",
    title: string,
  ) {
    try {
      const updated = await setMarketState(l.id, action);
      reload();
      setRecord((r) => (r && r.listing.id === l.id ? { ...r, listing: updated } : r));
      setToast({ title, body: `${l.card} · ${l.id} · written to the audit log` });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
      });
    }
  }

  /** What is on screen, as a spreadsheet. The filter and the search apply —
   *  exporting the unfiltered set would be a different, unasked-for answer. */
  function exportRows() {
    exportCsv(`grailmarket-listings-${view}`, rows, [
      { header: "Listing", value: (l) => l.id },
      { header: "Card", value: (l) => l.card },
      { header: "Set", value: (l) => l.setLine },
      { header: "Grader", value: (l) => l.grader },
      { header: "Grade", value: (l) => l.grade },
      { header: "Certificate", value: (l) => l.cert },
      { header: "Tier", value: (l) => l.tier },
      { header: "State", value: (l) => l.status },
      { header: "Ask", value: (l) => l.askPrice },
      { header: "Currency", value: (l) => l.currency },
      { header: "Market", value: (l) => (l.marketPrice > 0 ? l.marketPrice : "") },
      { header: "Market from", value: (l) => l.marketSource },
      { header: "Comparable sales", value: (l) => l.sampleSize },
      { header: "Confidence", value: (l) => l.confidence },
      { header: "Angles supplied", value: (l) => l.photos },
      { header: "Seller", value: (l) => l.seller.handle },
      { header: "Seller name", value: (l) => l.seller.name },
      { header: "Seller sales", value: (l) => l.seller.sales },
      { header: "Submitted", value: (l) => l.submitted },
      { header: "Hours left", value: (l) => (IN_QUEUE.includes(l.status) ? l.slaHours : "") },
      { header: "Decided by", value: (l) => l.reviewedBy ?? "" },
      { header: "Reason", value: (l) => l.rejectReason ?? "" },
    ]);
  }

  return (
    <>
      <PageHead
        title="Listing queue"
        sub="Approving a listing publishes it straight away."
        right={
          /* "Claim next in queue" is gone. It spent most of its life disabled,
             reading "Queue is clear" — a control that is mostly a status
             message, in the one place on the page reserved for the action you
             came to take. The queue itself claims a row when you open it. */
          <button type="button" className="gm-btn" onClick={exportRows}>
            <IconDownload />
            Export
          </button>
        }
      />

      <div className="gm-stack">
        {/* A console that cannot reach its API must say so. An empty queue and
            a broken connection look identical otherwise, and one of them is a
            quiet day while the other is an outage. */}
        {error ? (
          <Note tone="bad">
            <b>The queue could not be read.</b> {error.message}
          </Note>
        ) : null}

        {breached > 0 ? (
          <Note tone="bad">
            <b>{breached} listings are past the 24-hour review target.</b> They are at the top of
            the queue below.
          </Note>
        ) : null}

        <Card>
          <CardHead
            title="Listings"
            sub={
              loading
                ? "Reading the queue…"
                : `${VIEWS.find((v) => v.key === view)!.label} · ${rows.length} of ${counts.all}${
                    tier === "all" ? "" : ` · ${tier === "high-value" ? "high value" : tier} tier`
                  }`
            }
            right={
              <div className="gm-row" style={{ gap: 8 }}>
                <div className="gm-search" style={{ width: 224 }}>
                  <IconSearch />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Card, cert, listing id, seller…"
                    aria-label="Search listings"
                  />
                </div>
                <FilterMenu
                  applied={(view === "queue" ? 0 : 1) + (tier === "all" ? 0 : 1)}
                  onClear={() => {
                    setView("queue");
                    setTier("all");
                  }}
                  groups={[
                    {
                      key: "view",
                      label: "Where it is",
                      value: view,
                      onChange: (v) => setView(v as View),
                      options: VIEWS.map((v) => ({
                        value: v.key,
                        label: v.label,
                        count: counts[v.key] ?? 0,
                      })),
                    },
                    {
                      key: "tier",
                      label: "Tier",
                      value: tier,
                      onChange: (v) => setTier(v as typeof tier),
                      options: [
                        { value: "all", label: "All tiers" },
                        { value: "grail", label: "Grail" },
                        { value: "high-value", label: "High value" },
                        { value: "standard", label: "Standard" },
                      ],
                    },
                  ]}
                />
                <ViewToggle value={layout} onChange={setLayout} />
              </div>
            }
          />

          {/* Loading and empty are different answers and must not share a
              screen: "No listing matches that tab" while the request is still
              in flight tells a moderator their filter is wrong when it is not. */}
          {loading && rows.length === 0 ? (
            <Empty icon={<IconListing />} title="Reading the queue…" />
          ) : rows.length === 0 ? (
            <Empty
              icon={<IconListing />}
              title="Nothing here"
              body="No listing matches that tab, tier or search."
            />
          ) : layout === "gallery" ? (
            <div className="gm-gallery">
              {rows.map((l) => (
                  <CardTile
                    key={l.id}
                    slab={<Slab grader={l.grader} grade={l.grade} art={l.art} size="lg" />}
                    topLeft={<Tier tier={l.tier} />}
                    topRight={<ListingBadge status={l.status} />}
                    title={l.card}
                    sub={`${l.grader} ${l.grade} · ${l.setLine}`}
                    price={money(l.askPrice)}
                    meta={
                      <>
                        <GameChip game={l.game} />
                        {l.slaHours < 0 ? (
                          <Badge tone="bad">{Math.abs(l.slaHours)}h over</Badge>
                        ) : ["awaiting", "in-review"].includes(l.status) && l.slaHours <= 4 ? (
                          <Badge tone="warn">{l.slaHours}h left</Badge>
                        ) : null}
                      </>
                    }
                    footer={
                      <>
                        <span className="gm-tiny gm-muted">
                          {l.seller.handle} · {l.seller.reviews} reviews
                        </span>
                        <button
                          type="button"
                          className="gm-btn gm-btn--sm gm-spacer"
                          onClick={() => openAndClaim(l.id, IN_QUEUE.includes(l.status))}
                        >
                          <IconEye />
                          Open
                        </button>
                      </>
                    }
                  />
              ))}
            </div>
          ) : (
            <div className="gm-tablewrap">
              {/* Six columns, not nine.

                  Every row opens a record that carries the certificate, the
                  price confidence, the comps behind the figure, the seller's
                  history and the photo set. Repeating all of that on the row
                  did not make the queue faster to read — it made it wider than
                  the panel, so the decision buttons at the end of each row were
                  the first thing to go off the edge.

                  What is left is what a moderator triages on: what the card is,
                  who is selling it, what state it is in, what they want for it
                  against the market, and how long it has been waiting. */}
              <table className="gm-table" style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Seller</th>
                    <th>Tier · state</th>
                    <th>Ask</th>
                    <th>Activity</th>
                    <th className="gm-rowend">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => {
                    const over = overMarket(l);
                    const waiting = IN_QUEUE.includes(l.status);
                    return (
                      <tr key={l.id}>
                        <td>
                          <div className="gm-cell-user">
                            <Slab grader={l.grader} grade={l.grade} art={l.art} />
                            <div className="gm-cell2">
                              <b>{l.card}</b>
                              <span>
                                {l.grader} {l.grade} · {l.setLine}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {/* No avatar. Every seller here has initials on a
                              grey circle drawn from a name the console does
                              not otherwise show — it identified nobody and
                              took a column's worth of width to do it. */}
                          <div className="gm-cell2">
                            <b>{l.seller.handle}</b>
                            <span>
                              {l.seller.sales} sales · {l.seller.rating.toFixed(1)}★
                            </span>
                          </div>
                        </td>
                        <td>
                          {/* Tier and state read together — a grail awaiting
                              review is a different job from a standard one —
                              so they share a cell rather than a column each. */}
                          <div className="gm-row" style={{ gap: 6 }}>
                            <Tier tier={l.tier} />
                            <ListingBadge status={l.status} />
                          </div>
                        </td>
                        <td className="gm-figure">
                          <div className="gm-strong">{money(l.askPrice)}</div>
                          {/* The ask against the market figure, which is the
                              overpricing check the feature set asks for. The
                              market number itself is in the record. */}
                          {l.marketPrice > 0 && over !== null && Math.abs(over) >= 5 ? (
                            <div
                              className="gm-tiny"
                              style={{ color: over > 0 ? "var(--bad)" : "var(--ok)" }}
                            >
                              {over > 0 ? "+" : ""}
                              {over.toFixed(0)}% vs {money(l.marketPrice)}
                            </div>
                          ) : l.marketPrice > 0 ? (
                            <div className="gm-tiny gm-dim">at market</div>
                          ) : (
                            <div className="gm-tiny gm-dim">no market figure</div>
                          )}
                        </td>
                        <td>
                          {waiting ? (
                            <>
                              <div className="gm-sm">{shortDate(l.submitted)}</div>
                              {l.slaHours < 0 ? (
                                <div className="gm-tiny" style={{ color: "var(--bad)", fontWeight: 700 }}>
                                  {Math.abs(l.slaHours)}h over SLA
                                </div>
                              ) : (
                                <div className="gm-tiny gm-dim">{l.slaHours}h left</div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="gm-sm">
                                {num(l.views)} views · {num(l.watchers)} watching
                              </div>
                              <div className="gm-tiny gm-dim">
                                {l.reviewedBy ? `by ${l.reviewedBy}` : "Auto-cleared"}
                                {l.releasedAt ? ` · ${dateOnly(l.releasedAt)}` : ""}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="gm-rowend">
                          <div className="gm-rowact">
                            {l.status === "live" ? (
                              <button
                                type="button"
                                className="gm-btn gm-btn--sm gm-btn--danger"
                                onClick={() => setMarketStatus(l, "withdraw", "Withdrawn")}
                              >
                                Withdraw
                              </button>
                            ) : l.status === "paused" ? (
                              <button
                                type="button"
                                className="gm-btn gm-btn--sm gm-btn--gold"
                                onClick={() => setMarketStatus(l, "resume", "Back on the market")}
                              >
                                Resume
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="gm-btn gm-btn--sm"
                              onClick={() => openAndClaim(l.id, IN_QUEUE.includes(l.status))}
                            >
                              <IconEye />
                              {waiting ? "Review" : "Open"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ============================================================ record */}
      <RecordModal
        open={!!openId}
        onClose={() => setOpenId(null)}
        title={open ? open.card : "Opening…"}
        sub={open ? `${open.id} · ${open.setLine}` : openId ?? ""}
        footer={
          open ? (
            IN_QUEUE.includes(open.status) ? (
              <>
                <button
                  type="button"
                  className="gm-btn gm-btn--primary"
                  onClick={() => startDecision("approve")}
                >
                  <IconCheck />
                  Approve and publish
                </button>
                <button
                  type="button"
                  className="gm-btn gm-btn--gold"
                  onClick={() => startDecision("request")}
                >
                  <IconMail />
                  Ask for more
                </button>
                <button
                  type="button"
                  className="gm-btn gm-btn--danger gm-spacer"
                  onClick={() => startDecision("reject")}
                >
                  <IconX />
                  Reject
                </button>
              </>
            ) : open.status === "live" ? (
              <>
                <button
                  type="button"
                  className="gm-btn gm-btn--gold"
                  onClick={() => setMarketStatus(open, "pause", "Paused")}
                >
                  Pause
                </button>
                <button
                  type="button"
                  className="gm-btn gm-btn--danger gm-spacer"
                  onClick={() => setMarketStatus(open, "withdraw", "Withdrawn")}
                >
                  <IconBan />
                  Withdraw
                </button>
              </>
            ) : open.status === "paused" ? (
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                onClick={() => setMarketStatus(open, "resume", "Back on the market")}
              >
                <IconCheck />
                Put it back on the market
              </button>
            ) : (
              <span className="gm-sm gm-muted">
                This listing is closed. Reopening it is an audit-log action.
              </span>
            )
          ) : null
        }
      >
        {recordError ? (
          <Note tone="bad">
            <b>That record could not be read.</b> {recordError}
          </Note>
        ) : !open ? (
          <p className="gm-sm gm-muted" style={{ margin: 0 }}>
            Reading the listing…
          </p>
        ) : (
          <>
            <div className="gm-row" style={{ gap: 14, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <Slab grader={open.grader} grade={open.grade} art={open.art} size="lg" />
              <div className="gm-stack" style={{ gap: 10, minWidth: 0 }}>
                <div className="gm-row" style={{ gap: 7 }}>
                  <Tier tier={open.tier} />
                  <GameChip game={open.game} />
                  <ListingBadge status={open.status} />
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 750, letterSpacing: "-0.03em" }}>
                    {money(open.askPrice)}
                  </div>
                  <div className="gm-sm gm-muted">
                    {/* Where the figure came from, said plainly. A median of
                        our own confirmed sales and a snapshot taken when the
                        seller priced the card are not the same claim, and a
                        moderator deciding whether an ask is fair needs to
                        know which one is on screen. */}
                    {open.marketSource === "comps"
                      ? `Market ${money(open.marketPrice)}, the median of ${open.sampleSize} confirmed ${open.grader} ${open.grade} sale${open.sampleSize === 1 ? "" : "s"}`
                      : open.marketSource === "listing"
                        ? `Market ${money(open.marketPrice)}, quoted to the seller when they listed it. No confirmed ${open.grader} ${open.grade} sale has been recorded since.`
                        : "No market figure. Too few comparable sales to quote one."}
                  </div>
                </div>
                <ConfidenceBadge level={open.confidence} sample={open.sampleSize} />
              </div>
            </div>

            {/* -------------------------------------------------- the comps

                A sample count and a confidence badge say a figure was worked
                out; they do not say from what. A moderator deciding whether
                an ask is fair needs the sales themselves, and needs to see
                that every one of them is the same grader and grade — this is
                the only place that rule is visible rather than asserted.
            */}
            <Card>
              <CardHead
                title="What the price is built on"
                sub={`Confirmed ${open.grader} ${open.grade} sales only, never converted from another grading company`}
                right={
                  priceComps.length > 0 ? (
                    <a className="gm-btn gm-btn--sm gm-btn--ghost" href="/admin/price-engine">
                      Price engine
                    </a>
                  ) : null
                }
              />
              <CardBody style={{ paddingTop: 8 }}>
                {priceComps.length === 0 ? (
                  <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                    No confirmed sale on record at this grader and grade. That is what the
                    low-confidence badge above is saying. The figure is withheld rather than
                    guessed from a neighbouring grade.
                  </p>
                ) : (
                  <div className="gm-feed">
                    {priceComps.map((c) => (
                      <div key={c.id} className="gm-feed-item">
                        <span
                          className={`gm-feed-ico ${
                            c.outlier ? "gm-feed-ico--bad" : "gm-feed-ico--ok"
                          }`}
                        >
                          {c.outlier ? <IconAlert /> : <IconCheck />}
                        </span>
                        <div className="gm-feed-body">
                          <p className="gm-row" style={{ gap: 8 }}>
                            <b style={c.outlier ? { opacity: 0.6 } : undefined}>
                              {money(c.price)}
                            </b>
                            {c.outlier ? <Badge tone="bad">Excluded as an outlier</Badge> : null}
                          </p>
                          {c.outlier && c.why ? (
                            <p className="gm-sm gm-muted">{c.why}</p>
                          ) : null}
                          <div className="gm-feed-time">
                            {c.grader} {c.grade} · sold {shortDate(c.soldAt)} ·{" "}
                            <span className="gm-mono">{c.ref}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Automatic checks"
                sub={`${flagsFor(open).length} of ${checksFor(open).length} raised a flag`}
              />
              <CardBody style={{ paddingTop: 8 }}>
                <CheckList checks={checksFor(open)} />
              </CardBody>
            </Card>

            <Card>
              <CardHead title="Listing" />
              <CardBody>
                <DL
                  rows={[
                    ["Grading company", open.grader],
                    ["Stated grade", `${open.grader} ${open.grade}`],
                    [
                      "Label reads",
                      open.labelGrade && open.labelGrade !== open.grade ? (
                        <Badge tone="bad">
                          {open.grader} {open.labelGrade}
                        </Badge>
                      ) : (
                        <span className="gm-muted">Matches the stated grade</span>
                      ),
                    ],
                    ["Certificate", <span className="gm-mono">{open.cert}</span>],
                    ["Set", open.setLine],
                    ["Angles supplied", `${open.photos}`],
                    ["Submitted", shortDate(open.submitted)],
                    open.releasedAt
                      ? ["Published", `${shortDate(open.releasedAt)} by ${open.reviewedBy ?? "auto-clear"}`]
                      : [
                          "Review clock",
                          open.slaHours < 0 ? (
                            <Badge tone="bad">{Math.abs(open.slaHours)}h over</Badge>
                          ) : (
                            <span>{open.slaHours}h remaining</span>
                          ),
                        ],
                  ]}
                />
              </CardBody>
            </Card>

            {open.note ? (
              <Note>
                <b>Moderator note.</b> {open.note}
              </Note>
            ) : null}

            <Card>
              <CardHead title="Seller" />
              <CardBody>
                <div className="gm-row" style={{ gap: 11, marginBottom: 12, flexWrap: "nowrap" }}>
                  <div className="gm-cell2">
                    <b style={{ fontSize: 14.5 }}>{open.seller.name}</b>
                    <span>{open.seller.handle}</span>
                  </div>
                  <a className="gm-btn gm-btn--sm gm-spacer" href="/admin/members?scope=market">
                    <IconExternal />
                    Profile
                  </a>
                </div>
                <DL
                  rows={[
                    ["Completed sales", num(open.seller.sales)],
                    ["Rating", `${open.seller.rating.toFixed(1)} / 5.0`],
                    ["Reviews received", num(open.seller.reviews)],
                  ]}
                />
              </CardBody>
            </Card>

            {/* What this seller has been decided on before. Read from the
                listings themselves rather than from a separate record store,
                so it cannot disagree with the queue. */}
            <Card>
              <CardHead
                title="This seller's other listings"
                sub={`${sellerRecord.length} decided · every decision here is filed against ${open.seller.handle}`}
              />
              <CardBody style={{ paddingTop: 8 }}>
                {sellerRecord.length === 0 ? (
                  <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                    This is their first listing. The decision you take here starts the record.
                  </p>
                ) : (
                  <div className="gm-feed">
                    {sellerRecord.map((e) => (
                      <div key={e.id} className="gm-feed-item">
                        <span
                          className={`gm-feed-ico${
                            e.status === "live" || e.status === "sold"
                              ? " gm-feed-ico--ok"
                              : e.status === "rejected"
                                ? " gm-feed-ico--bad"
                                : e.status === "info_requested"
                                  ? " gm-feed-ico--warn"
                                  : " gm-feed-ico--gold"
                          }`}
                        >
                          {e.status === "live" || e.status === "sold" ? (
                            <IconCheck />
                          ) : e.status === "info_requested" ? (
                            <IconMail />
                          ) : e.status === "rejected" ? (
                            <IconXCircle />
                          ) : (
                            <IconNote />
                          )}
                        </span>
                        <div className="gm-feed-body">
                          <p className="gm-row" style={{ gap: 8 }}>
                            <b>{e.card}</b>
                            <ListingBadge status={historyStatus(e.status)} />
                          </p>
                          {e.reason ? <p className="gm-sm gm-muted">{e.reason}</p> : null}
                          <div className="gm-feed-time">
                            {money(e.price)}
                            {e.setName ? ` · ${e.setName}` : ""}
                            {e.by ? ` · ${e.by}` : ""} · {shortDate(e.at)} ·{" "}
                            <span className="gm-mono">{e.id}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Photo set"
                sub={`${open.photos} of ${MIN_ANGLES} angles: front, back, four slab edges, four corners`}
              />
              <CardBody>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))",
                    gap: 10,
                  }}
                >
                  {/* The photographs themselves. The angle is the label,
                      because "photo 7" is not a thing a moderator can check
                      and "back-left corner" is. */}
                  {photoSet.map((ph, i) => (
                    /* Keyed on the position, not the URL: a seller who shoots
                       four corners against the same background can and does
                       upload the same file twice, and React needs the two to
                       stay two things. */
                    <figure key={`${i}-${ph.angle ?? ""}`} style={{ margin: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ph.url}
                        alt={ph.angle ?? `Angle ${i + 1}`}
                        loading="lazy"
                        style={{
                          width: "100%",
                          aspectRatio: "3 / 4",
                          objectFit: "cover",
                          borderRadius: "var(--r-sm)",
                          background: "var(--surface-2)",
                          boxShadow: "var(--sh-1)",
                          display: "block",
                        }}
                      />
                      <figcaption
                        className="gm-tiny gm-dim"
                        style={{ marginTop: 4, textAlign: "center" }}
                      >
                        {ph.angle ?? i + 1}
                      </figcaption>
                    </figure>
                  ))}
                  {/* the gaps, drawn as gaps: an angle that was not supplied is
                      the finding, and an absence is invisible without a slot */}
                  {Array.from({ length: Math.max(0, MIN_ANGLES - photoSet.length) }).map((_, i) => (
                    <div
                      key={`missing-${i}`}
                      style={{
                        aspectRatio: "3 / 4",
                        borderRadius: "var(--r-sm)",
                        border: "1px dashed var(--line-2)",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--ink-4)",
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      missing
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </RecordModal>

      {/* ============================================================= modal */}
      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision ? DECISION_COPY[decision].title : ""}
        sub={decision ? DECISION_COPY[decision].sub : ""}
        footer={
          <>
            <button
              type="button"
              className={`gm-btn ${decision ? DECISION_COPY[decision].tone : ""}`}
              disabled={decision !== "approve" && reason.trim().length < 8}
              onClick={commit}
            >
              {decision === "approve" ? (
                <IconCheck />
              ) : decision === "reject" ? (
                <IconXCircle />
              ) : (
                <IconMail />
              )}
              {decision ? DECISION_COPY[decision].cta : ""}
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setDecision(null)}>
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Written to the audit log</span>
          </>
        }
      >
        {open && decision ? (
          <>
            <Card pad>
              <div className="gm-row" style={{ gap: 11, flexWrap: "nowrap" }}>
                <Slab grader={open.grader} grade={open.grade} art={open.art} />
                <div className="gm-cell2">
                  <b>{open.card}</b>
                  <span>
                    {open.grader} {open.grade} · {money(open.askPrice)} · {open.seller.handle}
                  </span>
                </div>
              </div>
            </Card>

            {decision === "approve" ? (
              flagsFor(open).length > 0 ? (
                <Note tone="warn">
                  <b>
                    {flagsFor(open).length} flag{flagsFor(open).length > 1 ? "s are" : " is"} still
                    open on this listing.
                  </b>{" "}
                  Approving publishes it anyway, and the flags stay on the record against your name.
                </Note>
              ) : (
                <Note tone="gold">
                  Every check passed. It goes on the market immediately, and the photo set and cert
                  as reviewed are frozen against the listing, so a later swap is detectable.
                </Note>
              )
            ) : decision === "reject" ? (
              <Note tone="bad">
                The seller sees the reason below, word for word. Three rejections inside 30 days
                triggers an automatic member review.
              </Note>
            ) : (
              <Note>
                The review clock stops until the seller replies. They get one reminder at 48 hours,
                then the listing expires at seven days.
              </Note>
            )}

            <div className="gm-field">
              <label className="gm-label" htmlFor="gm-listing-reason">
                {decision === "approve"
                  ? "Note for the record (optional)"
                  : decision === "reject"
                    ? "Reason shown to the seller"
                    : "What do you need from the seller?"}
              </label>
              <textarea
                id="gm-listing-reason"
                className="gm-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  decision === "approve"
                    ? "Cert matched the register, photos consistent with the label."
                    : decision === "reject"
                      ? "Be specific. The seller acts on this."
                      : "A straight-on photo of the subgrade block, and the original invoice."
                }
              />
              {decision !== "approve" ? (
                <span className="gm-hint">
                  At least 8 characters. This is what the seller is told.
                </span>
              ) : null}
            </div>

            {/* No ambiguity about where this lands — the entry is shown before
                it is filed, not summarised afterwards in a toast. */}
            <Card pad>
              <div className="gm-row" style={{ gap: 8, marginBottom: 7 }}>
                <IconUsers style={{ width: 14, height: 14, color: "var(--ink-4)" }} />
                <b className="gm-sm">Filed on {open.seller.handle}&rsquo;s record as</b>
              </div>
              <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                <b className="gm-strong">
                  {decision === "approve"
                    ? "Listing approved"
                    : decision === "reject"
                      ? "Listing rejected"
                      : "More information requested"}{" "}
                  · {open.card}
                </b>
                {reason.trim() ? <> · &ldquo;{reason.trim()}&rdquo;</> : null} · {operator.name} ·{" "}
                {open.id}
              </p>
            </Card>
          </>
        ) : null}
      </Modal>

      {toast ? (
        <Toast title={toast.title} body={toast.body} onDone={() => setToast(null)} />
      ) : null}
    </>
  );
}

/* `useSearchParams` opts its subtree out of the static shell, so it gets a
   boundary of its own rather than the whole route being client-rendered. */
function ListingsRoute() {
  return (
    <Suspense fallback={null}>
      <ListingsPage />
    </Suspense>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedListingsRoute() {
  return (
    <Gate need="listings.review">
      <ListingsRoute />
    </Gate>
  );
}
