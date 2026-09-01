"use client";

import { useMemo, useState } from "react";
import {
  money,
  shortDate,
  submissions,
  type Submission,
  type VerificationStatus,
} from "../lib/data";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHead,
  ConfidenceBadge,
  DL,
  Drawer,
  Empty,
  Modal,
  Note,
  PageHead,
  PillTabs,
  Slab,
  Tier,
  GameChip,
  CardTile,
  ViewToggle,
  VerificationBadge,
} from "../components/ui";
import {
  IconAlert,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconDownload,
  IconExternal,
  IconEye,
  IconFilter,
  IconMail,
  IconSearch,
  IconShield,
  IconStar,
  IconX,
  IconXCircle,
  IconInbox,
} from "../components/icons";

type Filter = "all" | VerificationStatus;
type Decision = "verify" | "reject" | "request";

const FILTERS: { key: Filter; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <IconInbox /> },
  { key: "awaiting", label: "Awaiting review", icon: <IconClock /> },
  { key: "in-review", label: "In review", icon: <IconEye /> },
  { key: "info-requested", label: "Info requested", icon: <IconMail /> },
  { key: "verified", label: "Verified", icon: <IconCheck /> },
  { key: "rejected", label: "Rejected", icon: <IconX /> },
];

const DECISION_COPY: Record<Decision, { title: string; sub: string; cta: string; tone: string }> = {
  verify: {
    title: "Verify and release to the listing queue",
    sub: "The card becomes sellable the moment this is confirmed.",
    cta: "Verify and release",
    tone: "gm-btn--primary",
  },
  reject: {
    title: "Reject this submission",
    sub: "The seller is told why. A rejection counts toward their strike record.",
    cta: "Reject submission",
    tone: "gm-btn--danger",
  },
  request: {
    title: "Request more information",
    sub: "The submission pauses and the SLA clock stops until the seller replies.",
    cta: "Send request",
    tone: "gm-btn--gold",
  },
};

export default function VerificationPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [tier, setTier] = useState<"all" | "grail" | "high-value">("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "gallery">("gallery");
  const [open, setOpen] = useState<Submission | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: submissions.length };
    for (const s of submissions) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (tier !== "all" && s.tier !== tier) return false;
      if (!q) return true;
      return (
        s.card.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.cert.toLowerCase().includes(q) ||
        s.seller.handle.toLowerCase().includes(q) ||
        s.setLine.toLowerCase().includes(q)
      );
    });
  }, [filter, tier, query]);

  const pending = submissions.filter((s) => s.status !== "verified" && s.status !== "rejected");
  const breached = pending.filter((s) => s.slaHours < 0).length;
  const heldValue = pending.reduce((sum, s) => sum + s.askPrice, 0);

  function startDecision(d: Decision) {
    setReason("");
    setDecision(d);
  }

  return (
    <>
      <PageHead
        title="Verification queue"
        sub="A card above the review floor cannot be listed until someone here says so. The tier decides how hard we look, not whether we look."
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
            <b className="gm-strong">{pending.length}</b> waiting on a decision
          </span>
          <span>
            <b className="gm-strong">{money(heldValue)}</b> held in review
          </span>
          {breached > 0 ? (
            <span style={{ color: "var(--bad)" }}>
              <b>{breached}</b> past the 24-hour target
            </span>
          ) : null}
          <span className="gm-dim">63 cleared this week · median 5h 12m</span>
        </p>

        {/* ------------------------------------------------------- the table */}
        <Card>
          <CardHead
            title="Submissions"
            sub={`${rows.length} of ${submissions.length} shown`}
            right={
              <div className="gm-row" style={{ gap: 8 }}>
                <div className="gm-search" style={{ width: 220 }}>
                  <IconSearch />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Card, cert, seller…"
                    aria-label="Search submissions"
                  />
                </div>
                <select
                  className="gm-select"
                  style={{ width: 148 }}
                  value={tier}
                  onChange={(e) => setTier(e.target.value as typeof tier)}
                  aria-label="Filter by tier"
                >
                  <option value="all">All tiers</option>
                  <option value="grail">Grail only</option>
                  <option value="high-value">High value</option>
                </select>
                <button type="button" className="gm-btn gm-btn--icon" aria-label="More filters">
                  <IconFilter />
                </button>
                <ViewToggle value={view} onChange={setView} />
              </div>
            }
          />

          <div style={{ padding: "12px 18px 0" }}>
            <PillTabs
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({ ...f, count: counts[f.key] ?? 0 }))}
            />
          </div>

          {rows.length === 0 ? (
            <Empty
              icon={<IconShield />}
              title="Nothing matches that"
              body="Try a different tier or clear the search."
            />
          ) : view === "gallery" ? (
            <div className="gm-gallery">
              {rows.map((s) => (
                <CardTile
                  key={s.id}
                  slab={<Slab grader={s.grader} grade={s.grade} game={s.game} art={s.art} size="lg" />}
                  topLeft={<Tier tier={s.tier} />}
                  topRight={<VerificationBadge status={s.status} />}
                  title={s.card}
                  sub={`${s.grader} ${s.grade} · ${s.setLine}`}
                  price={money(s.askPrice)}
                  meta={
                    <>
                      <GameChip game={s.game} />
                      {s.slaHours < 0 ? (
                        <Badge tone="bad">{Math.abs(s.slaHours)}h over SLA</Badge>
                      ) : s.slaHours <= 4 ? (
                        <Badge tone="warn">{s.slaHours}h left</Badge>
                      ) : null}
                      {s.flags.length > 0 ? (
                        <span className="gm-tiny gm-dim gm-spacer">
                          {s.flags.length} flag{s.flags.length > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </>
                  }
                  footer={
                    <>
                      <Avatar initials={s.seller.initials} size="sm" />
                      <span className="gm-tiny gm-muted">{s.seller.handle}</span>
                      <button
                        type="button"
                        className="gm-btn gm-btn--sm gm-spacer"
                        onClick={() => setOpen(s)}
                      >
                        <IconEye />
                        Review
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="gm-tablewrap" style={{ marginTop: 12 }}>
              <table className="gm-table" style={{ minWidth: 1080 }}>
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Seller</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th className="gm-num">Ask</th>
                    <th className="gm-num">Market</th>
                    <th>Price confidence</th>
                    <th className="gm-num">Submitted</th>
                    <th className="gm-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const over = s.marketPrice > 0 ? (s.askPrice / s.marketPrice - 1) * 100 : null;
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="gm-cell-user">
                            <Slab grader={s.grader} grade={s.grade} game={s.game} art={s.art} />
                            <div className="gm-cell2">
                              <b>{s.card}</b>
                              <span>
                                {s.grader} {s.grade} · {s.setLine}
                              </span>
                              <span className="gm-dim gm-mono" style={{ fontSize: 11 }}>
                                {s.id} · {s.cert}
                              </span>
                              <span style={{ marginTop: 3 }}>
                                <GameChip game={s.game} />
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="gm-cell-user">
                            <Avatar initials={s.seller.initials} size="sm" />
                            <div className="gm-cell2">
                              <b>{s.seller.handle}</b>
                              <span>
                                {s.seller.sales} sales · {s.seller.rating.toFixed(1)}★
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Tier tier={s.tier} />
                        </td>
                        <td>
                          <VerificationBadge status={s.status} />
                          {s.flags.length > 0 ? (
                            <div className="gm-tiny gm-dim" style={{ marginTop: 4 }}>
                              {s.flags.length} flag{s.flags.length > 1 ? "s" : ""}
                            </div>
                          ) : null}
                        </td>
                        <td className="gm-num gm-strong">{money(s.askPrice)}</td>
                        <td className="gm-num">
                          {s.marketPrice > 0 ? (
                            <>
                              <div>{money(s.marketPrice)}</div>
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
                          <ConfidenceBadge level={s.confidence} sample={s.sampleSize} />
                        </td>
                        <td className="gm-num">
                          <div className="gm-sm">{shortDate(s.submitted)}</div>
                          {s.slaHours < 0 ? (
                            <div className="gm-tiny" style={{ color: "var(--bad)", fontWeight: 700 }}>
                              {Math.abs(s.slaHours)}h over SLA
                            </div>
                          ) : s.status !== "verified" && s.status !== "rejected" ? (
                            <div className="gm-tiny gm-dim">{s.slaHours}h left</div>
                          ) : null}
                        </td>
                        <td className="gm-actions">
                          <button
                            type="button"
                            className="gm-btn gm-btn--sm"
                            onClick={() => setOpen(s)}
                          >
                            <IconEye />
                            Review
                          </button>
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
        onClose={() => setOpen(null)}
        title={open ? open.card : ""}
        sub={open ? `${open.id} · ${open.setLine}` : ""}
        footer={
          open && open.status !== "verified" && open.status !== "rejected" ? (
            <>
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                onClick={() => startDecision("verify")}
              >
                <IconCheck />
                Verify and release
              </button>
              <button
                type="button"
                className="gm-btn gm-btn--gold"
                onClick={() => startDecision("request")}
              >
                <IconMail />
                Request info
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
          ) : (
            <span className="gm-sm gm-muted">
              This submission is closed. Reopen it from the audit log if that was wrong.
            </span>
          )
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
                  <VerificationBadge status={open.status} />
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

            {open.confidence === "low" ? (
              <Note tone="warn">
                <b>Low price confidence.</b> {open.sampleSize} comparable sale
                {open.sampleSize === 1 ? "" : "s"} on record for this exact{" "}
                {open.grader} {open.grade}. A figure is not quoted here rather than guessed — ask for
                provenance before releasing it.
              </Note>
            ) : null}

            {open.flags.length > 0 ? (
              <Card pad style={{ background: "rgba(253,243,224,0.55)", borderColor: "rgba(176,118,29,0.28)" }}>
                <div className="gm-row" style={{ gap: 7, marginBottom: 8 }}>
                  <IconAlert style={{ width: 15, height: 15, color: "var(--warn)" }} />
                  <b className="gm-sm">Flags raised on this submission</b>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
                  {open.flags.map((f) => (
                    <li key={f} className="gm-sm gm-muted">
                      {f}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <Note tone="gold">No flags. Cert, photos and price all sit inside the expected band.</Note>
            )}

            <Card>
              <CardHead title="Submission" />
              <CardBody>
                <DL
                  rows={[
                    ["Grading company", open.grader],
                    ["Grade", `${open.grader} ${open.grade}`],
                    ["Certificate", <span className="gm-mono">{open.cert}</span>],
                    ["Game", open.game],
                    ["Set", open.setLine],
                    ["Photos supplied", `${open.photos}`],
                    ["Submitted", shortDate(open.submitted)],
                    [
                      "SLA",
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

            <Card>
              <CardHead title="Seller" />
              <CardBody>
                <div className="gm-row" style={{ gap: 11, marginBottom: 12, flexWrap: "nowrap" }}>
                  <Avatar initials={open.seller.initials} size="lg" />
                  <div className="gm-cell2">
                    <b style={{ fontSize: 14.5 }}>{open.seller.name}</b>
                    <span>{open.seller.handle}</span>
                  </div>
                  <a className="gm-btn gm-btn--sm gm-spacer" href="/admin/members">
                    <IconExternal />
                    Profile
                  </a>
                </div>
                <DL
                  rows={[
                    ["Completed sales", String(open.seller.sales)],
                    ["Rating", `${open.seller.rating.toFixed(1)} / 5.0`],
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Photo set"
                sub={`${open.photos} images — front, back, all four slab edges, label macro`}
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
                </div>
              </CardBody>
            </Card>

            {open.note ? (
              <Note>
                <b>Moderator note.</b> {open.note}
              </Note>
            ) : null}
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
              disabled={decision !== "verify" && reason.trim().length < 8}
              onClick={() => {
                setDecision(null);
                setOpen(null);
              }}
            >
              {decision === "verify" ? <IconCheck /> : decision === "reject" ? <IconXCircle /> : <IconMail />}
              {decision ? DECISION_COPY[decision].cta : ""}
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setDecision(null)}>
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Written to the audit log</span>
          </>
        }
      >
        {open ? (
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

            {decision === "verify" ? (
              <Note tone="gold">
                Releasing this puts it in the listing queue immediately and the seller can accept
                offers. The cert number and photo set as reviewed are frozen against the listing, so a
                later swap is detectable.
              </Note>
            ) : decision === "reject" ? (
              <Note tone="bad">
                The seller sees the reason you write below, word for word. Three rejections inside 30
                days triggers an automatic member review.
              </Note>
            ) : (
              <Note>
                The SLA clock stops until the seller replies. They get one reminder at 48 hours, then
                the submission expires at seven days.
              </Note>
            )}

            <div className="gm-field">
              <label className="gm-label" htmlFor="gm-reason">
                {decision === "verify"
                  ? "Note for the audit log (optional)"
                  : decision === "reject"
                    ? "Reason shown to the seller"
                    : "What do you need from the seller?"}
              </label>
              <textarea
                id="gm-reason"
                className="gm-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  decision === "verify"
                    ? "Cert matched the PSA register, photos consistent with the label."
                    : decision === "reject"
                      ? "Be specific — the seller acts on this."
                      : "A straight-on photo of the subgrade block, and the original invoice."
                }
              />
              {decision !== "verify" ? (
                <span className="gm-hint">
                  At least 8 characters. This is the only thing the seller is told.
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
