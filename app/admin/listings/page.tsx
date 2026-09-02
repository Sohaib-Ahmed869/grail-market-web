"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  checksFor,
  dateOnly,
  MIN_ANGLES,
  flagsFor,
  IN_QUEUE,
  listings,
  money,
  num,
  operator,
  overMarket,
  recordFor,
  shortDate,
  writeToRecord,
  type Listing,
  type ListingStatus,
  type MemberEvent,
} from "../lib/data";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHead,
  CheckList,
  ConfidenceBadge,
  DL,
  Drawer,
  Empty,
  ListingBadge,
  Modal,
  Note,
  PageHead,
  PillTabs,
  Slab,
  Tier,
  GameChip,
  CardTile,
  Toast,
  ViewToggle,
  Select,
} from "../components/ui";
import {
  IconBan,
  IconCheck,
  IconClock,
  IconDownload,
  IconExternal,
  IconEye,
  IconFilter,
  IconInbox,
  IconListing,
  IconMail,
  IconNote,
  IconScale,
  IconSearch,
  IconShield,
  IconUsers,
  IconX,
  IconXCircle,
} from "../components/icons";

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
  { key: "queue", label: "Needs a decision", icon: <IconShield />, statuses: ["awaiting", "in-review"] },
  { key: "seller", label: "Waiting on seller", icon: <IconClock />, statuses: ["info-requested"] },
  { key: "market", label: "On the market", icon: <IconEye />, statuses: ["live", "sold", "paused"] },
  { key: "closed", label: "Off the market", icon: <IconBan />, statuses: ["withdrawn", "rejected"] },
  { key: "all", label: "All", icon: <IconInbox />, statuses: [] },
] as const;

type View = (typeof VIEWS)[number]["key"];

type Decision = "approve" | "reject" | "request";

const DECISION_COPY: Record<
  Decision,
  { title: string; sub: string; cta: string; tone: string; status: ListingStatus }
> = {
  approve: {
    title: "Approve and publish",
    sub: "It goes on the market the moment this is confirmed — there is no second step.",
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

/** What each decision is titled on the member's record. */
const RECORD_KIND: Record<Decision, MemberEvent["kind"]> = {
  approve: "listing-approved",
  reject: "listing-rejected",
  request: "info-requested",
};

/** How a listing was left by a decision taken on this screen. */
type Overlay = { status: ListingStatus; reviewedBy?: string; releasedAt?: string };

function ListingsPage() {
  const params = useSearchParams();
  const wanted = params.get("view");
  const fromUrl = (VIEWS.some((v) => v.key === wanted) ? wanted : "queue") as View;

  const [view, setView] = useState<View>(fromUrl);
  useEffect(() => setView(fromUrl), [fromUrl]);

  const [tier, setTier] = useState<"all" | "grail" | "high-value" | "standard">("all");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"table" | "gallery">("table");

  /* Decisions taken in this session, keyed by listing id. Front-end only
     until the admin API lands — but everything downstream reads the overlaid
     list, so a decision moves the row between tabs, changes every count and
     lands on the seller's record exactly as it would with a server. */
  const [decided, setDecided] = useState<Record<string, Overlay>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  /* Bumped on every write so the drawer's record panel re-reads the store. */
  const [writes, setWrites] = useState(0);

  const all = useMemo(
    () => listings.map((l) => (decided[l.id] ? { ...l, ...decided[l.id] } : l)),
    [decided]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const v of VIEWS) {
      if (v.key === "all") continue;
      c[v.key] = all.filter((l) => (v.statuses as readonly string[]).includes(l.status)).length;
    }
    return c;
  }, [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const wantedStatuses = VIEWS.find((v) => v.key === view)!.statuses as readonly string[];
    return all.filter((l) => {
      if (wantedStatuses.length > 0 && !wantedStatuses.includes(l.status)) return false;
      if (tier !== "all" && l.tier !== tier) return false;
      if (!q) return true;
      return (
        l.card.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.cert.toLowerCase().includes(q) ||
        l.setLine.toLowerCase().includes(q) ||
        l.seller.handle.toLowerCase().includes(q)
      );
    });
  }, [all, view, tier, query]);

  const open = openId ? all.find((l) => l.id === openId) ?? null : null;
  const inQueue = all.filter((l) => IN_QUEUE.includes(l.status));
  const breached = inQueue.filter((l) => l.slaHours < 0).length;

  /* Read fresh rather than held in state: the store is a module-level list,
     so `writes` is the only thing that tells React it moved. */
  const sellerRecord: MemberEvent[] = useMemo(
    () => (open ? recordFor(open.seller.handle) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open?.seller.handle, writes]
  );

  function startDecision(d: Decision) {
    setReason("");
    setDecision(d);
  }

  function commit() {
    if (!open || !decision) return;
    const copy = DECISION_COPY[decision];

    const entry = writeToRecord({
      handle: open.seller.handle,
      kind: RECORD_KIND[decision],
      title: `${
        decision === "approve"
          ? "Listing approved"
          : decision === "reject"
            ? "Listing rejected"
            : "More information requested"
      } — ${open.card}`,
      detail: reason.trim() || undefined,
      by: operator.name,
      ref: open.id,
    });

    setDecided((d) => ({
      ...d,
      [open.id]: {
        status: copy.status,
        reviewedBy: operator.name,
        releasedAt: decision === "approve" ? new Date().toISOString() : open.releasedAt,
      },
    }));
    setWrites((n) => n + 1);
    setDecision(null);
    setReason("");
    setToast({
      title:
        decision === "approve"
          ? "Published to the market"
          : decision === "reject"
            ? "Rejected and the seller told"
            : "Request sent",
      body: `${open.card} · filed on ${open.seller.handle}'s record as ${entry.id}`,
    });
  }

  /** Pause, resume, withdraw — the levers on something already on sale. */
  function setMarketStatus(l: Listing, status: ListingStatus, title: string) {
    setDecided((d) => ({ ...d, [l.id]: { ...d[l.id], status } }));
    setToast({ title, body: `${l.card} · ${l.id} · written to the audit log` });
  }

  return (
    <>
      <PageHead
        title="Listing queue"
        sub="Every listing is read by a human before it goes live. Approving one publishes it — there is no separate publish step to forget."
        right={
          <>
            <button type="button" className="gm-btn">
              <IconDownload />
              Export
            </button>
            <button type="button" className="gm-btn gm-btn--primary">
              <IconShield />
              Claim next in queue
            </button>
          </>
        }
      />

      <div className="gm-stack">
        <p className="gm-row gm-sm gm-muted" style={{ gap: 14, margin: 0 }}>
          <span>
            <b className="gm-strong">{counts.queue ?? 0}</b> waiting on a decision
          </span>
          <span>
            {breached > 0 ? (
              <>
                <b className="gm-strong" style={{ color: "var(--bad)" }}>
                  {breached}
                </b>{" "}
                past the 24-hour target
              </>
            ) : (
              "All inside the 24-hour target"
            )}
          </span>
          <span className="gm-dim">
            {counts.market ?? 0} on the market · {counts.seller ?? 0} waiting on a seller
          </span>
        </p>

        <Card>
          <CardHead
            title="Listings"
            sub={`${rows.length} of ${all.length} shown`}
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
                <Select
                  width={148}
                  value={tier}
                  onChange={(v) => setTier(v as typeof tier)}
                  ariaLabel="Filter by tier"
                  options={[
                    { value: "all", label: "All tiers" },
                    { value: "grail", label: "Grail only" },
                    { value: "high-value", label: "High value" },
                    { value: "standard", label: "Standard" },
                  ]}
                />
                <button type="button" className="gm-btn gm-btn--icon" aria-label="More filters">
                  <IconFilter />
                </button>
                <ViewToggle value={layout} onChange={setLayout} />
              </div>
            }
          />

          <div style={{ padding: "12px 18px 0" }}>
            <PillTabs
              value={view}
              onChange={setView}
              options={VIEWS.map((v) => ({
                key: v.key,
                label: v.label,
                icon: v.icon,
                count: counts[v.key] ?? 0,
              }))}
            />
          </div>

          {rows.length === 0 ? (
            <Empty
              icon={<IconListing />}
              title="Nothing here"
              body="No listing matches that tab, tier or search."
            />
          ) : layout === "gallery" ? (
            <div className="gm-gallery">
              {rows.map((l) => {
                const flags = flagsFor(l);
                return (
                  <CardTile
                    key={l.id}
                    slab={<Slab grader={l.grader} grade={l.grade} game={l.game} art={l.art} size="lg" />}
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
                        {flags.length > 0 ? (
                          <span className="gm-tiny gm-spacer" style={{ color: "var(--warn)" }}>
                            {flags.length} flag{flags.length > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </>
                    }
                    footer={
                      <>
                        <Avatar initials={l.seller.initials} size="sm" />
                        <span className="gm-tiny gm-muted">
                          {l.seller.handle} · {l.seller.reviews} reviews
                        </span>
                        <button
                          type="button"
                          className="gm-btn gm-btn--sm gm-spacer"
                          onClick={() => setOpenId(l.id)}
                        >
                          <IconEye />
                          Open
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          ) : (
            <div className="gm-tablewrap" style={{ marginTop: 12 }}>
              <table className="gm-table" style={{ minWidth: 1180 }}>
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Seller</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th className="gm-num">Ask</th>
                    <th className="gm-num">Market</th>
                    <th>Price confidence</th>
                    <th className="gm-num">Activity</th>
                    <th className="gm-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => {
                    const over = overMarket(l);
                    const flags = flagsFor(l);
                    const waiting = IN_QUEUE.includes(l.status);
                    return (
                      <tr key={l.id}>
                        <td>
                          <div className="gm-cell-user">
                            <Slab grader={l.grader} grade={l.grade} game={l.game} art={l.art} />
                            <div className="gm-cell2">
                              <b>{l.card}</b>
                              <span>
                                {l.grader} {l.grade} · {l.setLine}
                              </span>
                              <span className="gm-dim gm-mono" style={{ fontSize: 11 }}>
                                {l.id} · {l.cert}
                              </span>
                              <span style={{ marginTop: 3 }}>
                                <GameChip game={l.game} />
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="gm-cell-user">
                            <Avatar initials={l.seller.initials} size="sm" />
                            <div className="gm-cell2">
                              <b>{l.seller.handle}</b>
                              <span>
                                {l.seller.sales} sales · {l.seller.rating.toFixed(1)}★
                              </span>
                              <span className="gm-dim" style={{ fontSize: 11 }}>
                                {num(l.seller.reviews)} reviews
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Tier tier={l.tier} />
                        </td>
                        <td>
                          <ListingBadge status={l.status} />
                          {flags.length > 0 ? (
                            <div
                              className="gm-tiny"
                              style={{ marginTop: 4, color: "var(--warn)", fontWeight: 600 }}
                            >
                              {flags.length} flag{flags.length > 1 ? "s" : ""}
                            </div>
                          ) : null}
                        </td>
                        <td className="gm-num gm-strong">{money(l.askPrice)}</td>
                        <td className="gm-num">
                          {l.marketPrice > 0 ? (
                            <>
                              <div>{money(l.marketPrice)}</div>
                              {over !== null && Math.abs(over) >= 5 ? (
                                <div
                                  className="gm-tiny"
                                  style={{ color: over > 0 ? "var(--bad)" : "var(--ok)" }}
                                >
                                  {over > 0 ? "+" : ""}
                                  {over.toFixed(0)}% vs market
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="gm-dim">Unknown</span>
                          )}
                        </td>
                        <td>
                          <ConfidenceBadge level={l.confidence} sample={l.sampleSize} />
                        </td>
                        <td className="gm-num">
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
                        <td className="gm-actions">
                          <div className="gm-rowact">
                            {l.status === "live" ? (
                              <button
                                type="button"
                                className="gm-btn gm-btn--sm gm-btn--danger"
                                onClick={() => setMarketStatus(l, "withdrawn", "Withdrawn")}
                              >
                                Withdraw
                              </button>
                            ) : l.status === "paused" ? (
                              <button
                                type="button"
                                className="gm-btn gm-btn--sm gm-btn--gold"
                                onClick={() => setMarketStatus(l, "live", "Back on the market")}
                              >
                                Resume
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="gm-btn gm-btn--sm"
                              onClick={() => setOpenId(l.id)}
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

      {/* ============================================================ drawer */}
      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? open.card : ""}
        sub={open ? `${open.id} · ${open.setLine}` : ""}
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
                  onClick={() => setMarketStatus(open, "paused", "Paused")}
                >
                  Pause
                </button>
                <button
                  type="button"
                  className="gm-btn gm-btn--danger gm-spacer"
                  onClick={() => setMarketStatus(open, "withdrawn", "Withdrawn")}
                >
                  <IconBan />
                  Withdraw
                </button>
              </>
            ) : open.status === "paused" ? (
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                onClick={() => setMarketStatus(open, "live", "Back on the market")}
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
        {open ? (
          <>
            <div className="gm-row" style={{ gap: 14, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <Slab grader={open.grader} grade={open.grade} game={open.game} art={open.art} size="lg" />
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
                    {open.marketPrice > 0
                      ? `Market ${money(open.marketPrice)} from ${open.sampleSize} comparable ${
                          open.grader
                        } ${open.grade} sales`
                      : "No market figure — too few comparable sales to quote one"}
                  </div>
                </div>
                <ConfidenceBadge level={open.confidence} sample={open.sampleSize} />
              </div>
            </div>

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
                  <Avatar initials={open.seller.initials} size="lg" />
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

            {/* What a decision writes to, and what previous ones wrote. */}
            <Card>
              <CardHead
                title="On this member's record"
                sub={`${sellerRecord.length} entr${sellerRecord.length === 1 ? "y" : "ies"} · every decision here is filed against ${open.seller.handle}`}
              />
              <CardBody style={{ paddingTop: 8 }}>
                {sellerRecord.length === 0 ? (
                  <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                    Nothing on file yet. The first decision you take here starts it.
                  </p>
                ) : (
                  <div className="gm-feed">
                    {sellerRecord.map((e) => (
                      <div key={e.id} className="gm-feed-item">
                        <span
                          className={`gm-feed-ico${
                            e.kind === "listing-approved"
                              ? " gm-feed-ico--ok"
                              : e.kind === "listing-rejected" || e.kind === "conduct"
                                ? " gm-feed-ico--bad"
                                : e.kind === "info-requested"
                                  ? " gm-feed-ico--warn"
                                  : " gm-feed-ico--gold"
                          }`}
                        >
                          {e.kind === "listing-approved" ? (
                            <IconCheck />
                          ) : e.kind === "conduct" ? (
                            <IconScale />
                          ) : e.kind === "info-requested" ? (
                            <IconMail />
                          ) : e.kind === "note" ? (
                            <IconNote />
                          ) : (
                            <IconXCircle />
                          )}
                        </span>
                        <div className="gm-feed-body">
                          <p>
                            <b>{e.title}</b>
                          </p>
                          {e.detail ? <p className="gm-sm gm-muted">{e.detail}</p> : null}
                          <div className="gm-feed-time">
                            {e.by} · {shortDate(e.at)}
                            {e.ref ? ` · ${e.ref}` : ""} · {e.id}
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
                sub={`${open.photos} of ${MIN_ANGLES} angles — front, back, four slab edges, four corners`}
              />
              <CardBody>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))",
                    gap: 10,
                  }}
                >
                  {Array.from({ length: open.photos }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        aspectRatio: "3 / 4",
                        borderRadius: 9,
                        background: "linear-gradient(150deg,#223244,#131c26)",
                        boxShadow: "var(--sh-2)",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--gold-300)",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {i + 1}
                    </div>
                  ))}
                  {/* the gaps, drawn as gaps: an angle that was not supplied is
                      the finding, and an absence is invisible without a slot */}
                  {Array.from({ length: Math.max(0, MIN_ANGLES - open.photos) }).map((_, i) => (
                    <div
                      key={`missing-${i}`}
                      style={{
                        aspectRatio: "3 / 4",
                        borderRadius: 9,
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
        ) : null}
      </Drawer>

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
                <Slab grader={open.grader} grade={open.grade} game={open.game} art={open.art} />
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
                      ? "Be specific — the seller acts on this."
                      : "A straight-on photo of the subgrade block, and the original invoice."
                }
              />
              {decision !== "approve" ? (
                <span className="gm-hint">
                  At least 8 characters. This is the only thing the seller is told.
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
                  — {open.card}
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
export default function ListingsRoute() {
  return (
    <Suspense fallback={null}>
      <ListingsPage />
    </Suspense>
  );
}
