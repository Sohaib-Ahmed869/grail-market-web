"use client";

import { useMemo, useState } from "react";
import {
  conflictKindLabel,
  conflicts,
  money,
  resolutionOptions,
  severityOf,
  severityScore,
  shortDate,
  type Conflict,
  type ConflictStatus,
} from "../lib/data";
import {
  Avatar,
  Badge,
  BlockHead,
  Card,
  CardBody,
  CardHead,
  ConflictBadge,
  DL,
  Drawer,
  Empty,
  MetaBox,
  Modal,
  Note,
  PageHead,
  PillTabs,
  Severity,
  Slab,
  Toast,
} from "../components/ui";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconClock,
  IconDownload,
  IconExternal,
  IconEye,
  IconInbox,
  IconLock,
  IconNote,
  IconScale,
  IconSend,
  IconTag,
} from "../components/icons";

type Filter = "all" | ConflictStatus;

const FILTERS: { key: Filter; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All cases", icon: <IconInbox /> },
  { key: "escalated", label: "Escalated", icon: <IconAlert /> },
  { key: "open", label: "Open", icon: <IconScale /> },
  { key: "awaiting-evidence", label: "Awaiting evidence", icon: <IconClock /> },
  { key: "resolved", label: "Resolved", icon: <IconCheck /> },
];

export default function ConflictsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Conflict | null>(null);
  const [resolution, setResolution] = useState<string | null>(null);
  const [splitPct, setSplitPct] = useState(50);
  const [rationale, setRationale] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: conflicts.length };
    for (const x of conflicts) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, []);

  const list = useMemo(
    () => conflicts.filter((c) => filter === "all" || c.status === filter),
    [filter]
  );

  const openCases = conflicts.filter((c) => c.status !== "resolved");
  const held = openCases.reduce((s, c) => s + (c.heldFunds ? c.amount : 0), 0);

  return (
    <>
      <PageHead
        title="Conflicts"
        sub={`Two accounts disagree and ${money(held)} is sitting between them. Every open case holds funds until it closes.`}
        right={
          <>
            <button type="button" className="gm-btn">
              <IconDownload />
              Export
            </button>
            <button type="button" className="gm-btn gm-btn--primary">
              <IconScale />
              Claim oldest
            </button>
          </>
        }
      />

      <div className="gm-stack">
        <PillTabs
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ ...f, count: counts[f.key] ?? 0 }))}
        />

        <BlockHead
          title={filter === "all" ? "Needs a decision" : FILTERS.find((f) => f.key === filter)!.label}
          sub={`${list.length} case${list.length === 1 ? "" : "s"}`}
        />

        {list.length === 0 ? (
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
              const level = severityOf(c.amount, c.ageHours);
              const score = severityScore(c.amount, c.ageHours);
              return (
                <article key={c.id} className="gm-case">
                  <div className="gm-case-top">
                    <div className="gm-case-who">
                      <Slab
                        grader={c.listing.grader}
                        grade={c.listing.grade}
                        game={c.listing.game}
                        art={c.listing.art}
                        size="sm"
                      />
                      <b>{c.id}</b>
                    </div>
                    <Severity level={level} score={score} />
                  </div>

                  <div className="gm-metagrid">
                    <MetaBox label="Type" value={conflictKindLabel[c.kind]} icon={<IconTag />} />
                    <MetaBox label="Opened" value={shortDate(c.opened)} icon={<IconCalendar />} />
                    <MetaBox label="Held" value={money(c.amount)} icon={<IconLock />} />
                    <MetaBox label="Running" value={`${Math.round(c.ageHours)} hours`} icon={<IconClock />} />
                  </div>

                  <div>
                    <div className="gm-case-title">{c.listing.card}</div>
                    <div className="gm-row gm-tiny gm-dim" style={{ gap: 6, marginTop: 5 }}>
                      <span>
                        {c.listing.grader} {c.listing.grade}
                      </span>
                      <span>·</span>
                      <ConflictBadge status={c.status} />
                    </div>
                  </div>

                  <p className="gm-case-body" style={{ margin: 0 }}>
                    {c.buyerClaim}
                  </p>

                  <div className="gm-row" style={{ gap: 8, fontSize: 12 }}>
                    <Avatar initials={c.buyer.initials} size="sm" />
                    <span className="gm-dim">v</span>
                    <Avatar initials={c.seller.initials} size="sm" gold />
                    <span className="gm-tiny gm-dim gm-spacer">
                      {c.buyer.handle} · {c.seller.handle}
                    </span>
                  </div>

                  <div className="gm-case-actions">
                    <button
                      type="button"
                      className="gm-btn gm-btn--sm"
                      onClick={() => setOpen(c)}
                    >
                      <IconEye />
                      View details
                    </button>
                    {c.status !== "resolved" ? (
                      <button
                        type="button"
                        className="gm-btn gm-btn--sm gm-btn--primary"
                        onClick={() => {
                          setOpen(c);
                          setResolution(null);
                          setRationale("");
                        }}
                      >
                        <IconCheck />
                        Resolve
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================ drawer */}
      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? open.id : ""}
        sub={open ? `${conflictKindLabel[open.kind]} · ${money(open.amount)} held` : ""}
        footer={
          open && open.status !== "resolved" ? (
            <>
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                disabled={!resolution || rationale.trim().length < 12}
                onClick={() => setConfirming(true)}
              >
                <IconCheck />
                Apply decision
              </button>
              <button type="button" className="gm-btn">
                <IconSend />
                Message both
              </button>
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
                game={open.listing.game}
                art={open.listing.art}
                size="lg"
              />
              <div className="gm-stack" style={{ gap: 9, minWidth: 0 }}>
                <div className="gm-cell2">
                  <b style={{ fontSize: 15 }}>{open.listing.card}</b>
                  <span>{open.listing.setLine}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em" }}>
                  {money(open.amount)}
                </div>
                <div className="gm-row" style={{ gap: 6 }}>
                  <ConflictBadge status={open.status} />
                  {open.heldFunds ? <Badge tone="warn">Funds held</Badge> : <Badge tone="ok">Released</Badge>}
                </div>
              </div>
            </div>

            {/* the two sides */}
            <div className="gm-split">
              <div className="gm-side-panel gm-side-panel--buyer">
                <h4>Buyer</h4>
                <div className="gm-row" style={{ gap: 9, marginBottom: 10, flexWrap: "nowrap" }}>
                  <Avatar initials={open.buyer.initials} size="sm" />
                  <div className="gm-cell2">
                    <b>{open.buyer.name}</b>
                    <span>{open.buyer.handle}</span>
                  </div>
                </div>
                <div className="gm-quote">“{open.buyerClaim}”</div>
              </div>
              <div className="gm-side-panel gm-side-panel--seller">
                <h4>Seller</h4>
                <div className="gm-row" style={{ gap: 9, marginBottom: 10, flexWrap: "nowrap" }}>
                  <Avatar initials={open.seller.initials} size="sm" gold />
                  <div className="gm-cell2">
                    <b>{open.seller.name}</b>
                    <span>{open.seller.handle}</span>
                  </div>
                </div>
                <div className="gm-quote">“{open.sellerClaim}”</div>
              </div>
            </div>

            {open.seller.disputes >= 4 ? (
              <Note tone="bad">
                <b>Pattern worth checking.</b> {open.seller.handle} has {open.seller.disputes} prior
                conflicts. Look at the member record before deciding this one in isolation.
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
              <Card>
                <CardHead
                  title="Resolve"
                  sub="Both parties are told the decision and the reason you record."
                />
                <CardBody>
                  <div className="gm-stack" style={{ gap: 9 }}>
                    {resolutionOptions.map((o) => {
                      const on = resolution === o.key;
                      return (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setResolution(o.key)}
                          style={{
                            textAlign: "left",
                            padding: "12px 14px",
                            borderRadius: 12,
                            cursor: "pointer",
                            font: "inherit",
                            background: "transparent",
                            color: "var(--ink-2)",
                            border: `1px solid ${on ? "var(--ink)" : "var(--line)"}`,
                            transition: "border-color .2s ease",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13.2,
                              marginBottom: 3,
                              color: "var(--ink)",
                            }}
                          >
                            {o.title}
                          </div>
                          <div style={{ fontSize: 12.2, lineHeight: 1.5, color: "var(--ink-3)" }}>
                            {o.detail}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {resolution === "split" ? (
                    <div style={{ marginTop: 14 }}>
                      <div className="gm-row" style={{ marginBottom: 7 }}>
                        <span className="gm-label">Refund to buyer</span>
                        <span className="gm-spacer gm-strong gm-mono">
                          {money(Math.round((open.amount * splitPct) / 100))} · {splitPct}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={splitPct}
                        onChange={(e) => setSplitPct(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--gold)" }}
                        aria-label="Percentage refunded to the buyer"
                      />
                    </div>
                  ) : null}

                  <div className="gm-field" style={{ marginTop: 14 }}>
                    <label className="gm-label" htmlFor="gm-rationale">
                      Reason recorded on the case
                    </label>
                    <textarea
                      id="gm-rationale"
                      className="gm-textarea"
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      placeholder="What the evidence shows, and why it points this way."
                    />
                    <span className="gm-hint">
                      Both parties read this. It is also what an appeal is judged against.
                    </span>
                  </div>
                </CardBody>
              </Card>
            ) : null}
          </>
        ) : null}
      </Drawer>

      {/* ============================================================= modal */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Apply this decision?"
        sub="Money moves as soon as you confirm."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              onClick={() => {
                setConfirming(false);
                setToast(open?.id ?? null);
                setOpen(null);
                setResolution(null);
                setRationale("");
              }}
            >
              <IconCheck />
              Confirm and close case
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
                  ["Case", open.id],
                  ["Card", open.listing.card],
                  ["Amount held", money(open.amount)],
                  ["Outcome", resolutionOptions.find((o) => o.key === resolution)?.title ?? "—"],
                  ...(resolution === "split"
                    ? ([
                        [
                          "Split",
                          `${money(Math.round((open.amount * splitPct) / 100))} to buyer · ${money(
                            open.amount - Math.round((open.amount * splitPct) / 100)
                          )} to seller`,
                        ],
                      ] as [React.ReactNode, React.ReactNode][])
                    : []),
                ]}
              />
            </Card>
            <Note tone="warn">
              <b>This is not easily undone.</b> Reversing a released payout means recovering funds
              from a member account, which needs a lead moderator and finance.
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

      {toast ? (
        <Toast
          title="Conflict resolved"
          body={`${toast} closed and the hold lifted`}
          onDone={() => setToast(null)}
        />
      ) : null}
    </>
  );
}
