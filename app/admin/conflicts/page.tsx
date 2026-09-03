"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  conductActions,
  conflictKindLabel,
  money,
  severityOf,
  severityScore,
  shortDate,
  type Conflict,
  type ConflictStatus,
} from "../lib/data";
import {
  Badge,
  BlockHead,
  Card,
  CardBody,
  CardHead,
  ConflictBadge,
  DL,
  RecordModal,
  Empty,
  MetaBox,
  Modal,
  Note,
  FilterMenu,
  PageHead,
  Severity,
  Slab,
  Toast,
} from "../components/ui";
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconDownload,
  IconEye,
  IconNote,
  IconScale,
  IconSend,
  IconShield,
  IconTag,
} from "../components/icons";
import {
  ApiError,
  claimCase,
  decideCase,
  fetchCase,
  fetchCases,
  messageBothParties,
  setCaseState,
} from "../lib/api";
import { toConflict } from "../lib/cases";
import { exportCsv } from "../lib/csv";
import { Gate } from "../components/Gate";

/** What the case says, from whoever raised it.
 *
 *  The card used to print the buyer's claim whatever the case was, which on a
 *  case a seller raised showed the buyer's silence instead of the report. */
const reportOf = (c: Conflict) => (c.against === "seller" ? c.buyerClaim : c.sellerClaim);

/** The minimum a recorded reason has to be before it is worth recording. */
const REASON_MIN = 12;

/**
 * Why the decision cannot be applied yet, in the words of the thing missing.
 *
 * A disabled button with nothing beside it reads as broken rather than as
 * blocked — which is exactly how it was read. There is no state where this
 * button is off and the page has not said why.
 */
function blockedBecause(outcome: string | null, rationale: string): string | null {
  if (!outcome) return "Choose an outcome below first.";
  const left = REASON_MIN - rationale.trim().length;
  if (left > 0) {
    return `Write the reason it is recorded under — ${left} more character${left === 1 ? "" : "s"}.`;
  }
  return null;
}

type Filter = "all" | ConflictStatus;

/** The board's action keys, in the API's outcome vocabulary. `escalate` is
 *  not here because it is a state change, not an outcome. */
const OUTCOME_BY_ACTION: Record<string, string> = {
  none: "none",
  warn: "warned",
  restrict: "restricted",
  close: "closed",
  police: "police",
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All cases" },
  { key: "escalated", label: "Escalated" },
  { key: "open", label: "Open" },
  { key: "awaiting-evidence", label: "Awaiting evidence" },
  { key: "resolved", label: "Resolved" },
];

/* The sidebar links straight to a view — `?status=escalated` and the like. */
const STATUSES = FILTERS.map((f) => f.key as string);

function ConflictsPage() {
  const params = useSearchParams();
  const wanted = params.get("status");
  const fromUrl = (STATUSES.includes(wanted ?? "") ? wanted : "all") as Filter;

  const [filter, setFilter] = useState<Filter>(fromUrl);
  useEffect(() => setFilter(fromUrl), [fromUrl]);
  /* Members or staff. A report about a moderator is not the same job as a
     report about a seller, and whoever works the second should not be the one
     working the first — so they are separate piles, not one list. */
  const [party, setParty] = useState<"all" | "members" | "staff">("all");
  const [open, setOpen] = useState<Conflict | null>(null);
  /** Which conduct action closes the case. */
  const [outcome, setOutcome] = useState<string | null>(null);
  /** Whose standing it lands on — seeded from the case, changeable. */
  const [target, setTarget] = useState<"buyer" | "seller">("seller");
  const [rationale, setRationale] = useState("");
  const [confirming, setConfirming] = useState(false);
  /* One message to both sides. Not a decision — see the API route. */
  const [messaging, setMessaging] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  /* Set when the record was opened to decide rather than to read, so the
     outcome panel is scrolled to rather than hunted for at the bottom. */
  const [jumpToOutcome, setJumpToOutcome] = useState(false);
  const outcomeRef = useRef<HTMLDivElement>(null);
  /* Held as its own value: the panel is cleared on confirm, so the toast
     cannot read the outcome back off state that no longer exists. */
  const [toast, setToast] = useState<{ id: string; action: string; escalated: boolean } | null>(
    null
  );

  /* The board, from the API. Filtering is the database's job — the tab is a
     query parameter, not a predicate run over rows already in the browser. */
  const [rows, setRows] = useState<Conflict[]>([]);
  /* The board draws two roles; the API decides against a person. This keeps
     the two user ids per case so a decision names one of them. */
  const [caseIds, setCaseIds] = useState<Record<string, { buyer: string; seller: string }>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writes, setWrites] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchCases(filter, party)
      .then((r) => {
        if (!live) return;
        setRows(r.cases.map((c) => toConflict(c)));
        setCaseIds(
          Object.fromEntries(
            r.cases.map((c) => {
              const raiserIsBuyer = c.raiserRole !== "seller";
              return [
                c.id,
                {
                  buyer: raiserIsBuyer ? c.raisedBy.id : c.against.id,
                  seller: raiserIsBuyer ? c.against.id : c.raisedBy.id,
                },
              ];
            }),
          ),
        );
        setCounts(r.counts);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [filter, party, writes]);

  const list = rows;

  /* Opening a case reads it in full — the list carries what a card needs, and
     the record needs both claims, the evidence and the thread as well. It is
     claimed at the same time, so two moderators cannot decide one case. */
  async function show(c: Conflict, decide = false) {
    setOpen(c);
    setTarget(c.against);
    setJumpToOutcome(decide);
    try {
      const { record, thread } = await fetchCase(c.id);
      setOpen(toConflict(record, thread));
      await claimCase(c.id).catch(() => null);
    } catch {
      /* the card's own data is already on screen; the thread is the extra */
    }
  }

  /**
   * Apply the outcome.
   *
   * Escalation is not a decision — it hands the case to Trust and safety with
   * the reason attached and leaves it open. Everything else closes the case
   * and, for a restriction or a closure, moves the accused member's standing.
   * The API does that second write so there stays one place standing changes.
   */
  async function commit() {
    if (!open || !chosen) return;
    const accusedId = caseIds[open.id]?.[target];
    try {
      if (chosen.escalates) {
        await setCaseState(open.id, "escalated", rationale.trim());
      } else {
        await decideCase(open.id, {
          outcome: OUTCOME_BY_ACTION[chosen.key] ?? "none",
          note: rationale.trim(),
          againstId: accusedId,
        });
      }
      setToast({ id: open.id, action: chosen.title, escalated: !!chosen.escalates });
      setWrites((n) => n + 1);
      setConfirming(false);
      setOpen(null);
      setOutcome(null);
      setRationale("");
    } catch (e) {
      setConfirming(false);
      setToast({
        id: open.id,
        action: e instanceof ApiError ? e.message : "did not go through",
        escalated: false,
      });
    }
  }

  /**
   * One line both parties read.
   *
   * Half of moderating a case is telling two people the same thing, and
   * telling them separately is how the two answers end up different. The API
   * writes it once on the case thread and notifies each of them.
   */
  async function sendToBoth() {
    if (!open || message.trim().length < 4) return;
    setSending(true);
    try {
      const { record, thread } = await messageBothParties(open.id, message.trim());
      setOpen(toConflict(record, thread));
      setMessaging(false);
      setMessage("");
      setToast({ id: open.id, action: "message sent to both parties", escalated: false });
    } catch (e) {
      setToast({
        id: open.id,
        action: e instanceof ApiError ? e.message : "did not send",
        escalated: false,
      });
    } finally {
      setSending(false);
    }
  }

  /* The dialog resets its own scroll on open, so this waits a frame rather
     than racing it. */
  useEffect(() => {
    if (!open || !jumpToOutcome) return;
    const id = requestAnimationFrame(() =>
      outcomeRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
    return () => cancelAnimationFrame(id);
  }, [open, jumpToOutcome]);

  const chosen = conductActions.find((a) => a.key === outcome) ?? null;
  const accused = open ? open[target] : null;
  const blocked = blockedBecause(outcome, rationale);

  return (
    <>
      <PageHead
        title="Reports & conduct"
        sub="No money passes through Grail Market, so a case closes on conduct: a warning, a restriction, a closed account, or a referral to police."
        right={
          /* "Claim oldest" is gone. A case is claimed by opening it, which is
             what a moderator does anyway, and a second button that does the
             same thing one row earlier was never worth the width. */
          <button
            type="button"
            className="gm-btn"
            onClick={() =>
              exportCsv(`grailmarket-cases-${filter}`, list, [
                { header: "Case", value: (c) => c.id },
                { header: "Kind", value: (c) => conflictKindLabel[c.kind] },
                { header: "State", value: (c) => c.status },
                { header: "Opened", value: (c) => c.opened },
                { header: "Hours open", value: (c) => c.ageHours },
                { header: "Trade value", value: (c) => c.amount },
                { header: "Against", value: (c) => c.against },
                { header: "Buyer", value: (c) => c.buyer.handle },
                { header: "Seller", value: (c) => c.seller.handle },
                { header: "Listing", value: (c) => c.listing.id },
                { header: "Card", value: (c) => c.listing.card },
                { header: "Report", value: (c) => reportOf(c) },
              ])
            }
          >
            <IconDownload />
            Export
          </button>
        }
      />

      <div className="gm-stack">
        {/* The filter sits beside the heading it changes rather than as a row
            of five pills above it. The heading names the state being shown,
            so nothing is hidden by moving the control. */}
        <BlockHead
          title={filter === "all" ? "Needs a decision" : FILTERS.find((f) => f.key === filter)!.label}
          sub={`${list.length} case${list.length === 1 ? "" : "s"}${
            party === "all" ? "" : party === "staff" ? " · staff involved" : " · members only"
          }`}
          right={
            <FilterMenu
              applied={(filter === "all" ? 0 : 1) + (party === "all" ? 0 : 1)}
              onClear={() => {
                setFilter("all");
                setParty("all");
              }}
              groups={[
                {
                  key: "party",
                  label: "Who is involved",
                  value: party,
                  onChange: (v) => setParty(v as typeof party),
                  options: [
                    { value: "all", label: "Everyone", count: counts.all ?? 0 },
                    { value: "members", label: "Members only", count: counts.members ?? 0 },
                    { value: "staff", label: "Staff involved", count: counts.staff ?? 0 },
                  ],
                },
                {
                  key: "status",
                  label: "Case state",
                  value: filter,
                  onChange: (v) => setFilter(v as Filter),
                  options: FILTERS.map((f) => ({
                    value: f.key,
                    label: f.label,
                    count: counts[f.key] ?? 0,
                  })),
                },
              ]}
            />
          }
        />

        {loadError ? (
          <Note tone="bad">
            <b>The board could not be read.</b> {loadError}
          </Note>
        ) : loading && list.length === 0 ? (
          <Card>
            <Empty icon={<IconScale />} title="Reading the board…" />
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <Empty
              icon={<IconScale />}
              title="Nothing here"
              body="No case currently has that status."
            />
          </Card>
        ) : (
          <div className="gm-caseboard">
            {list.map((c) => {
              const level = severityOf(c.kind, c.amount, c.ageHours);
              const score = severityScore(c.kind, c.amount, c.ageHours);
              return (
                <article key={c.id} className="gm-case">
                  {/* What the complaint is, in words. The store's own id is
                      still here because support has to quote it, but it is a
                      reference underneath rather than the headline — nobody
                      reads a case board looking for "dp_7c8af086". */}
                  <div className="gm-case-top">
                    <div className="gm-case-who">
                      <Slab
                        grader={c.listing.grader}
                        grade={c.listing.grade}
                        art={c.listing.art}
                        size="sm"
                      />
                      <span className="gm-cell2" style={{ minWidth: 0 }}>
                        <b>{conflictKindLabel[c.kind]}</b>
                        <span
                          className="gm-mono"
                          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          Case {c.id}
                        </span>
                      </span>
                    </div>
                    <Severity level={level} score={score} />
                  </div>

                  <div className="gm-metagrid">
                    <MetaBox label="Opened" value={shortDate(c.opened)} icon={<IconCalendar />} />
                    <MetaBox label="Running" value={`${Math.round(c.ageHours)} hours`} icon={<IconClock />} />
                    <MetaBox label="Trade value" value={money(c.amount)} icon={<IconTag />} />
                    <MetaBox
                      label="Prior cases"
                      value={
                        c[c.against].disputes === 0
                          ? "None before this"
                          : `${c[c.against].disputes} against them`
                      }
                      icon={<IconShield />}
                    />
                  </div>

                  <div>
                    <div className="gm-case-title">{c.listing.card}</div>
                    {/* Who it is about sits on the same line as the state, so
                        the card reads as one row of facts rather than two. */}
                    <div
                      className="gm-row gm-tiny gm-dim"
                      style={{ gap: 6, marginTop: 5, flexWrap: "nowrap" }}
                    >
                      <span className="gm-nowrap">
                        {c.listing.grader} {c.listing.grade}
                      </span>
                      <span>·</span>
                      <ConflictBadge status={c.status} />
                      <span
                        className="gm-spacer gm-nowrap"
                        style={{ textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        Reported: <b>{c[c.against].handle}</b> · by{" "}
                        {c[c.against === "seller" ? "buyer" : "seller"].handle}
                      </span>
                    </div>
                  </div>

                  <div className="gm-case-actions">
                    <button
                      type="button"
                      className="gm-btn gm-btn--sm"
                      onClick={() => show(c)}
                    >
                      <IconEye />
                      View details
                    </button>
                    {c.status !== "resolved" ? (
                      <button
                        type="button"
                        className="gm-btn gm-btn--sm gm-btn--primary"
                        onClick={() => {
                          show(c, true);
                          setOutcome(null);
                          setRationale("");
                        }}
                      >
                        <IconShield />
                        Decide
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================ record */}
      <RecordModal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${conflictKindLabel[open.kind]} · against ${open[open.against].handle}` : ""}
        sub={open ? `Case ${open.id}` : ""}
        footer={
          open && open.status !== "resolved" ? (
            <>
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                disabled={!!blocked}
                onClick={() => setConfirming(true)}
              >
                <IconShield />
                Apply outcome
              </button>
              <button
                type="button"
                className="gm-btn"
                onClick={() => setMessaging(true)}
              >
                <IconSend />
                Message both
              </button>
              {blocked ? (
                <span className="gm-sm gm-muted" style={{ marginLeft: 4 }}>
                  {blocked}
                </span>
              ) : null}
            </>
          ) : (
            <span className="gm-sm gm-muted">
              Closed. Reopening needs a lead moderator and leaves a record.
            </span>
          )
        }
      >
        {open ? (
          <>
            <div className="gm-row" style={{ gap: 14, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <Slab
                grader={open.listing.grader}
                grade={open.listing.grade}
                art={open.listing.art}
                size="lg"
              />
              <div className="gm-stack" style={{ gap: 9, minWidth: 0 }}>
                <div className="gm-cell2">
                  <b style={{ fontSize: 15 }}>{open.listing.card}</b>
                  <span>{open.listing.setLine}</span>
                </div>
                <div className="gm-cell2">
                  <b style={{ fontSize: 15 }}>{money(open.amount)}</b>
                  <span>What the trade was worth. Nothing is held against it.</span>
                </div>
                <div className="gm-row" style={{ gap: 6 }}>
                  <ConflictBadge status={open.status} />
                  <Badge tone="warn">{conflictKindLabel[open.kind]}</Badge>
                </div>
              </div>
            </div>

            {/* the two sides */}
            <div className="gm-split">
              <div className="gm-side-panel gm-side-panel--buyer">
                <h4>Buyer{open.against === "buyer" ? " · reported" : ""}</h4>
                <div className="gm-row" style={{ gap: 9, marginBottom: 10, flexWrap: "nowrap" }}>
                  <div className="gm-cell2">
                    <b>{open.buyer.name}</b>
                    <span>{open.buyer.handle}</span>
                  </div>
                </div>
                <div className="gm-quote">“{open.buyerClaim}”</div>
              </div>
              <div className="gm-side-panel gm-side-panel--seller">
                <h4>Seller{open.against === "seller" ? " · reported" : ""}</h4>
                <div className="gm-row" style={{ gap: 9, marginBottom: 10, flexWrap: "nowrap" }}>
                  <div className="gm-cell2">
                    <b>{open.seller.name}</b>
                    <span>{open.seller.handle}</span>
                  </div>
                </div>
                <div className="gm-quote">“{open.sellerClaim}”</div>
              </div>
            </div>

            {open.kind === "threats" ? (
              <Note tone="bad">
                <b>This one can leave the platform.</b> Keep the thread unedited. A referral to
                police is judged on what was actually sent.
              </Note>
            ) : null}

            {open[open.against].disputes >= 4 ? (
              <Note tone="bad">
                <b>Pattern worth checking.</b> {open[open.against].handle} has{" "}
                {open[open.against].disputes} prior cases. Read the member record before deciding
                this one on its own.
              </Note>
            ) : null}

            <Card>
              <CardHead title="Evidence" sub={`${open.evidence.length} items submitted`} />
              <CardBody style={{ paddingTop: 8 }}>
                <div className="gm-feed">
                  {open.evidence.map((e) => (
                    <div key={e.label} className="gm-feed-item">
                      <span className="gm-feed-ico">
                        <IconNote />
                      </span>
                      <div className="gm-feed-body">
                        <p>
                          <b>{e.label}</b>
                        </p>
                        <div className="gm-feed-time">
                          from the {e.from} · {e.kind}
                        </div>
                      </div>
                      <button type="button" className="gm-btn gm-btn--sm gm-btn--ghost">
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHead title="Timeline" />
              <CardBody style={{ paddingTop: 8 }}>
                <div className="gm-feed">
                  {open.timeline.map((t, i) => (
                    <div key={i} className="gm-feed-item">
                      <span className={`gm-feed-ico${t.side === "admin" ? " gm-feed-ico--gold" : ""}`}>
                        {t.side === "admin" ? <IconScale /> : <IconClock />}
                      </span>
                      <div className="gm-feed-body">
                        <p>{t.text}</p>
                        <div className="gm-feed-time">
                          {t.by} · {t.at}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {open.status !== "resolved" ? (
              /* The ref lives on a wrapper because Card does not forward one,
                 and it is only ever used to scroll this panel into view. */
              <div ref={outcomeRef}>
                <Card>
                  <CardHead
                    title="Outcome"
                    sub="Both parties are told the outcome and the reason you record."
                  />
                  <CardBody>
                    {/* Who it lands on. A conduct action is against a person, so
                        the side is picked before the action, not after. */}
                    <div className="gm-field" style={{ marginBottom: 14 }}>
                      <span className="gm-label">Whose standing this acts on</span>
                      <div className="gm-row" style={{ gap: 8, marginTop: 6 }}>
                        {(["buyer", "seller"] as const).map((side) => {
                          const on = target === side;
                          const who = open[side];
                          return (
                            <button
                              key={side}
                              type="button"
                              onClick={() => setTarget(side)}
                              className="gm-row"
                              style={{
                                gap: 8,
                                flex: 1,
                                flexWrap: "nowrap",
                                textAlign: "left",
                                padding: "9px 11px",
                                borderRadius: "var(--r-sm)",
                                cursor: "pointer",
                                font: "inherit",
                                background: "transparent",
                                border: `1px solid ${on ? "var(--ink)" : "var(--line)"}`,
                                transition: "border-color .2s ease",
                              }}
                            >
                              <span className="gm-cell2" style={{ minWidth: 0 }}>
                                <b>{who.handle}</b>
                                <span>
                                  {side === open.against ? "reported" : "the reporter"} ·{" "}
                                  {who.disputes} prior
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <span className="gm-hint">
                        Reported by default. Move it if the evidence points the other way, since a
                        bad-faith report is itself conduct.
                      </span>
                    </div>

                    <div className="gm-field" style={{ marginBottom: 10 }}>
                      <span className="gm-label">Pick one</span>
                    </div>

                    {/* A chosen option used to differ from an unchosen one by the
                        colour of its one-pixel border, which is not a difference
                        anybody saw. The mark on the left is the answer to "why is
                        the button still off". */}
                    <div className="gm-stack" style={{ gap: 9 }} role="radiogroup" aria-label="Outcome">
                      {conductActions.map((o) => {
                        const on = outcome === o.key;
                        return (
                          <button
                            key={o.key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setOutcome(o.key)}
                            className="gm-row"
                            style={{
                              gap: 11,
                              alignItems: "flex-start",
                              flexWrap: "nowrap",
                              textAlign: "left",
                              padding: "12px 14px",
                              borderRadius: "var(--r-md)",
                              cursor: "pointer",
                              font: "inherit",
                              background: on ? "var(--surface-2)" : "transparent",
                              color: "var(--ink-2)",
                              border: `1px solid ${on ? "var(--ink)" : "var(--line)"}`,
                              transition: "border-color .2s ease, background .2s ease",
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                flex: "none",
                                marginTop: 2,
                                width: 16,
                                height: 16,
                                display: "grid",
                                placeItems: "center",
                                borderRadius: 999,
                                border: `1px solid ${on ? "var(--ink)" : "var(--line-2)"}`,
                                background: on ? "var(--ink)" : "transparent",
                                color: "var(--paper)",
                              }}
                            >
                              {on ? <IconCheck style={{ width: 11, height: 11 }} /> : null}
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span
                                className="gm-row"
                                style={{
                                  gap: 7,
                                  fontWeight: 600,
                                  fontSize: 13.2,
                                  marginBottom: 3,
                                  color: "var(--ink)",
                                }}
                              >
                                {o.title}
                                {o.escalates ? <Badge tone="bad">Trust and safety</Badge> : null}
                              </span>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 12.2,
                                  lineHeight: 1.5,
                                  color: "var(--ink-3)",
                                }}
                              >
                                {o.detail}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {chosen?.escalates ? (
                      <Note tone="warn">
                        <b>{chosen.title} is not yours to apply alone.</b> Confirming hands the case,
                        the evidence and this reason to Trust and safety, who carry it out. It leaves
                        your queue either way.
                      </Note>
                    ) : null}

                    <div className="gm-field" style={{ marginTop: 14 }}>
                      <label className="gm-label" htmlFor="gm-rationale">
                        Reason recorded on the member record
                      </label>
                      <textarea
                        id="gm-rationale"
                        className="gm-textarea"
                        value={rationale}
                        onChange={(e) => setRationale(e.target.value)}
                        placeholder="What the evidence shows, which rule it breaks, and why this outcome and not the next one up."
                      />
                      <span className="gm-hint">
                        Both parties read this, and it is what an appeal is judged against. At least{" "}
                        {REASON_MIN} characters.
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </div>
            ) : null}
          </>
        ) : null}
      </RecordModal>

      {/* ============================================================= modal */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Apply this outcome?"
        sub="It lands on a member's standing and stays on their record."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              onClick={commit}
            >
              <IconShield />
              {chosen?.escalates ? "Confirm and hand over" : "Confirm and close case"}
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setConfirming(false)}>
              Go back
            </button>
          </>
        }
      >
        {open ? (
          <>
            <Card pad>
              <DL
                rows={[
                  ["Case", `${open.id} · ${conflictKindLabel[open.kind]}`],
                  ["Card", open.listing.card],
                  ["Acts on", accused ? `${accused.name} · ${accused.handle}` : "Not chosen"],
                  ["Outcome", chosen?.title ?? "Not chosen"],
                  ["Written to", "The member record, the audit log, and the case"],
                ]}
              />
            </Card>
            <Note tone={chosen && chosen.severity >= 3 ? "bad" : "warn"}>
              {chosen && chosen.severity >= 3 ? (
                <>
                  <b>This ends someone&rsquo;s access.</b> Closing an account retires the handle, and
                  a referral cannot be withdrawn once Trust and safety have filed it. Only a lead
                  moderator can reverse either, and the reversal is recorded too.
                </>
              ) : (
                <>
                  <b>This stays on the record.</b> Nothing is deleted later. A lifted restriction
                  reads as lifted rather than as never applied.
                </>
              )}
            </Note>
            <div>
              <div className="gm-label" style={{ marginBottom: 6 }}>
                Reason both parties will see
              </div>
              <div className="gm-quote">{rationale}</div>
            </div>
          </>
        ) : null}
      </Modal>

      {/* ===================================================== message both */}
      <Modal
        open={messaging}
        onClose={() => setMessaging(false)}
        title="Write to both parties"
        sub="One line on the case, which the buyer and the seller both read. It is not a decision and does not close the case."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={message.trim().length < 4 || sending}
              onClick={sendToBoth}
            >
              <IconSend />
              {sending ? "Sending…" : "Send to both"}
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--ghost"
              onClick={() => setMessaging(false)}
            >
              Cancel
            </button>
          </>
        }
      >
        {open ? (
          <>
            <Card pad>
              <DL
                rows={[
                  ["Case", `${open.id} · ${conflictKindLabel[open.kind]}`],
                  ["Goes to", `${open.buyer.handle} and ${open.seller.handle}`],
                  ["Appears as", "A line on the case thread, plus a notification each"],
                ]}
              />
            </Card>
            <div className="gm-field">
              <label className="gm-label" htmlFor="gm-both">
                Message
              </label>
              <textarea
                id="gm-both"
                className="gm-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What you still need from them, or how long this will take. Written once so both sides get the same answer."
              />
            </div>
          </>
        ) : null}
      </Modal>

      {toast ? (
        <Toast
          title={toast.escalated ? "Handed to Trust and safety" : "Outcome applied"}
          body={`${toast.id} · ${toast.action}, written to the member record`}
          onDone={() => setToast(null)}
        />
      ) : null}
    </>
  );
}

/* `useSearchParams` opts its subtree out of the static shell, so it gets a
   boundary of its own rather than the whole route being client-rendered. */
function ConflictsRoute() {
  return (
    <Suspense fallback={null}>
      <ConflictsPage />
    </Suspense>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedConflictsRoute() {
  return (
    <Gate need="conduct.decide">
      <ConflictsRoute />
    </Gate>
  );
}
