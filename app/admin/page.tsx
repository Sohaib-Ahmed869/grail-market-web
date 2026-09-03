"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  aud,
  conflicts,
  DECIDABLE,
  flagsFor,
  gmvSeries,
  IN_QUEUE,
  listings,
  money,
  mrrOf,
  operator,
  priorMrr,
  queueMix,
  subscriptionRevenue,
  subscriptionTiers,
  totalMrr,
  totalSubscribers,
  verificationFunnel,
  writeToRecord,
  type Listing,
} from "./lib/data";
import {
  Card,
  Empty,
  Funnel,
  LinkStat,
  Modal,
  Note,
  RingChart,
  Slab,
  StackBar,
  ListingBadge,
  Tier,
  Toast,
  VolumeChart,
} from "./components/ui";
import {
  IconArrowRight,
  IconCheck,
  IconDownload,
  IconExternal,
  IconInbox,
  IconShield,
  IconXCircle,
} from "./components/icons";
import { Gate } from "./components/Gate";

/* The greeting, the money, the funnel and the queue stack in the left column;
   the rail runs the full height beside them rather than sitting under a chart.
   That is what lifts the standings and the review mix above the fold.

   Anything that is only a number lives in the rail as a link to the page that
   owns it — a tile that states a figure and goes nowhere is a poster, not a
   control. The one table on this page is the exception, and it earns it by
   being worked here: its rows are decided in place rather than handed off. */
const SLA_ROWS = 4;

/* `DECIDABLE` is awaiting + in-review — the rows waiting on us. A listing in
   `info-requested` is waiting on the seller with its clock stopped, so a
   decision on the row would be a decision taken without the thing you asked
   for. Those still count towards the queue depth in the rail, which is a
   different question. */

/* The fan behind the greeting. Real card art, pulled once into public/cards/
   by `scripts/fetch-card-art.mjs`. Fixed values rather than random so the
   server and the client render the same markup. */
const TRAIL: { grader: string; grade: string; art: string; fan: string }[] = [
  { grader: "PSA", grade: "9", art: "yugioh-blue-eyes", fan: "-13deg" },
  { grader: "BGS", grade: "9.5", art: "magic-mox-sapphire", fan: "-6deg" },
  { grader: "PSA", grade: "10", art: "pokemon-charizard", fan: "1deg" },
  { grader: "CGC", grade: "8.5", art: "magic-black-lotus", fan: "8deg" },
  { grader: "PSA", grade: "10", art: "pokemon-umbreon", fan: "15deg" },
];

type Decision = "approved" | "rejected";

function DashboardPage() {
  /* Decisions taken on this screen, by submission id. Front-end only until
     the admin API lands, but the queue has to behave like a queue while you
     work it: a row you have dealt with leaves, and the next one moves up. */
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [rejecting, setRejecting] = useState<Listing | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const pending = useMemo(
    () => listings.filter((l) => IN_QUEUE.includes(l.status) && !decided[l.id]),
    [decided]
  );

  const queue = useMemo(
    () =>
      listings
        .filter((l) => DECIDABLE.includes(l.status) && !decided[l.id])
        .sort((a, b) => a.slaHours - b.slaHours),
    [decided]
  );

  const breached = pending.filter((s) => s.slaHours < 0).length;

  /* The four figures the feature set asks for, and only those: subscribers,
     live listings, queue depth, open reports. Each is a count of a thing a
     page owns, so each one can link to that page. */
  const liveListings = listings.filter((l) => l.status === "live").length;
  const openReports = conflicts.filter((c) => c.status !== "resolved").length;

  const mrrGrowth = priorMrr > 0 ? ((totalMrr - priorMrr) / priorMrr) * 100 : 0;

  function approve(l: Listing) {
    setDecided((d) => ({ ...d, [l.id]: "approved" }));
    const entry = writeToRecord({
      handle: l.seller.handle,
      kind: "listing-approved",
      title: `Listing approved: ${l.card}`,
      by: operator.name,
      ref: l.id,
    });
    setToast({
      title: "Published to the market",
      body: `${l.card} · filed on ${l.seller.handle}'s record as ${entry.id}`,
    });
  }

  function confirmReject() {
    if (!rejecting) return;
    setDecided((d) => ({ ...d, [rejecting.id]: "rejected" }));
    const entry = writeToRecord({
      handle: rejecting.seller.handle,
      kind: "listing-rejected",
      title: `Listing rejected: ${rejecting.card}`,
      detail: reason.trim(),
      by: operator.name,
      ref: rejecting.id,
    });
    setToast({
      title: "Rejected and the seller told",
      body: `${rejecting.card} · filed on ${rejecting.seller.handle}'s record as ${entry.id}`,
    });
    setRejecting(null);
    setReason("");
  }

  return (
    <div className="gm-dash">
      {/* ==================================================== left column */}
      <div className="gm-dash-main">
        <section className="gm-hero">
          <div className="gm-hero-copy">
            <div className="gm-hero-eyebrow">Sunday · 1 September</div>
            <h2>
              Morning, {operator.name.split(" ")[0]}. <em>{pending.length} cards</em> are waiting
              on you.
            </h2>
            <p>
              {breached > 0
                ? `${breached} already past the 24-hour target.`
                : "All inside the 24-hour target."}{" "}
              Nothing here clears itself.
            </p>
            <div className="gm-hero-actions">
              <Link href="/admin/listings" className="gm-btn gm-btn--primary">
                <IconShield />
                Open the queue
              </Link>
              <button type="button" className="gm-btn">
                <IconDownload />
                Export
              </button>
            </div>
          </div>

          <div className="gm-hero-trail">
            {TRAIL.map((c, i) => (
              <span key={i} style={{ "--fan": c.fan } as React.CSSProperties}>
                <Slab grader={c.grader} grade={c.grade} art={c.art} size="lg" />
              </span>
            ))}
          </div>
        </section>

        {/* ======================================== the money and the funnel */}
        <div className="gm-dash-duo">
          <section>
            <div className="gm-blockhead">
              <h3>Subscription revenue</h3>
              <p>Recurring, by plan</p>
              <span
                className={`gm-spacer gm-badge ${
                  mrrGrowth >= 0 ? "gm-badge--gold" : "gm-badge--bad"
                }`}
              >
                {mrrGrowth >= 0 ? "+" : ""}
                {mrrGrowth.toFixed(1)}%
              </span>
            </div>

            <div className="gm-well">
              <div className="gm-money">
                <span className="gm-money-value">{aud(totalMrr)}</span>
                <span className="gm-money-unit">
                  MRR · {totalSubscribers.toLocaleString("en-US")} subscribers
                </span>
              </div>

              <StackBar
                parts={subscriptionTiers.map((t) => ({
                  label: t.name,
                  value: mrrOf(t),
                  color: t.color,
                }))}
              />

              <div>
                {subscriptionTiers.map((t) => (
                  <div key={t.key} className="gm-planline">
                    <span className="gm-planline-key" style={{ background: t.color }} />
                    <span className="gm-planline-name">
                      <b>{t.name}</b>
                      <span>
                        {aud(t.price)} a month ·{" "}
                        {t.quota === null ? "unlimited listings" : `${t.quota} listing${t.quota > 1 ? "s" : ""}`}
                      </span>
                    </span>
                    <span className="gm-planline-num">
                      <b>{aud(mrrOf(t))}</b>
                      <span>{t.subscribers.toLocaleString("en-US")} on plan</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Collected is not MRR, and the difference is the dunning pile —
                  saying only one of the two hides a real queue of work. */}
              <p className="gm-sm gm-muted" style={{ marginTop: 14 }}>
                <b className="gm-strong">{aud(subscriptionRevenue.collected)}</b> collected this
                month.{" "}
                <span className="gm-dim">
                  {aud(subscriptionRevenue.failed)} failed across{" "}
                  {subscriptionRevenue.failedAccounts} accounts.
                </span>
              </p>
            </div>
          </section>

          <section>
            <div className="gm-blockhead">
              <h3>Verification funnel</h3>
              <p>New accounts, last 30 days</p>
              <span className="gm-spacer gm-badge gm-badge--gold">
                {Math.round(
                  (verificationFunnel[verificationFunnel.length - 1].value /
                    verificationFunnel[0].value) *
                    100
                )}
                % end to end
              </span>
            </div>

            <div className="gm-well">
              <Funnel stages={verificationFunnel} />
              <p className="gm-tiny gm-dim" style={{ marginTop: 14 }}>
                The last two steps are the provider&rsquo;s decision against the DVS. We hold the
                outcome only. No documents reach this database.
              </p>
            </div>
          </section>
        </div>

        {/* ============================================ the queue, worked here */}
        <section>
          <div className="gm-blockhead">
            <h3>Awaiting review</h3>
            <p>Sorted by time left rather than by value. Decide on the row.</p>
            <Link href="/admin/listings" className="gm-spacer gm-btn gm-btn--sm">
              All {queue.length}
              <IconArrowRight />
            </Link>
          </div>

          <div className="gm-well gm-well--flush">
            {queue.length === 0 ? (
              <Empty
                icon={<IconInbox />}
                title="The queue is clear"
                body="Nothing is waiting on a human right now."
              />
            ) : (
              <div className="gm-tablewrap">
                <table className="gm-table" style={{ minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Tier · state</th>
                      <th className="gm-num">Ask</th>
                      <th className="gm-num">Time left</th>
                      <th className="gm-actions">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.slice(0, SLA_ROWS).map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="gm-cell-user">
                            <Slab grader={s.grader} grade={s.grade} art={s.art} size="sm" />
                            <div className="gm-cell2">
                              <b>{s.card}</b>
                              <span>
                                {s.grader} {s.grade} · {s.setLine}
                              </span>
                              <span className="gm-dim" style={{ fontSize: 11 }}>
                                {s.seller.handle} · {s.seller.sales} sales
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="gm-row" style={{ gap: 6 }}>
                            <Tier tier={s.tier} />
                            <ListingBadge status={s.status} />
                          </div>
                        </td>
                        <td className="gm-num gm-strong">{money(s.askPrice)}</td>
                        <td className="gm-num">
                          {s.slaHours < 0 ? (
                            <span className="gm-badge gm-badge--bad">
                              {Math.abs(s.slaHours)}h over
                            </span>
                          ) : s.slaHours <= 4 ? (
                            <span className="gm-badge gm-badge--warn">{s.slaHours}h</span>
                          ) : (
                            <span className="gm-muted gm-mono">{s.slaHours}h</span>
                          )}
                        </td>
                        <td className="gm-actions">
                          <div className="gm-rowact">
                            <button
                              type="button"
                              className="gm-btn gm-btn--sm gm-btn--primary"
                              onClick={() => approve(s)}
                            >
                              <IconCheck />
                              Approve
                            </button>
                            <button
                              type="button"
                              className="gm-btn gm-btn--sm gm-btn--danger"
                              onClick={() => {
                                setReason("");
                                setRejecting(s);
                              }}
                            >
                              Reject
                            </button>
                            {/* the way out to the full record, for the rows a
                                pair of buttons is not enough to settle */}
                            <Link
                              href="/admin/listings"
                              className="gm-btn gm-btn--sm gm-btn--icon"
                              aria-label={`Open the full record for ${s.card}`}
                              title="Open the full record"
                            >
                              <IconExternal />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="gm-blockhead">
            <h3>Marketplace volume</h3>
            <p>Twelve weeks · GMV against verifications cleared</p>
            <span className="gm-spacer gm-badge gm-badge--gold">+11.4%</span>
          </div>
          <div className="gm-well">
            <VolumeChart data={gmvSeries} height={168} />
          </div>
        </section>
      </div>

      {/* =========================================================== rail */}
      <aside className="gm-dash-rail">
        <section>
          <div className="gm-blockhead">
            <h3>Where things stand</h3>
            <p>Each opens the page that owns it</p>
          </div>
          <div className="gm-railbox">
            <LinkStat
              href="/admin/members?scope=market"
              label="Active subscribers"
              value={totalSubscribers.toLocaleString("en-US")}
            />
            <LinkStat
              href="/admin/listings"
              label="Live listings"
              value={liveListings.toLocaleString("en-US")}
            />
            <LinkStat
              href="/admin/listings"
              label="In the review queue"
              value={String(pending.length)}
            />
            <LinkStat href="/admin/conflicts" label="Open reports" value={String(openReports)} />
          </div>
        </section>

        <section>
          <div className="gm-blockhead">
            <h3>Review mix</h3>
            <p>161 in flight, by tier</p>
          </div>
          <div className="gm-well">
            <RingChart rings={queueMix} />
          </div>
        </section>
      </aside>

      {/* ====================================================== reject modal */}
      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this submission"
        sub="The seller sees the reason you write, word for word."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--danger"
              disabled={reason.trim().length < 8}
              onClick={confirmReject}
            >
              <IconXCircle />
              Reject and notify
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setRejecting(null)}>
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Written to the audit log</span>
          </>
        }
      >
        {rejecting ? (
          <>
            <Card pad>
              <div className="gm-row" style={{ gap: 11, flexWrap: "nowrap" }}>
                <Slab
                  grader={rejecting.grader}
                  grade={rejecting.grade}
                  art={rejecting.art}
                />
                <div className="gm-cell2">
                  <b>{rejecting.card}</b>
                  <span>
                    {rejecting.grader} {rejecting.grade} · {money(rejecting.askPrice)} ·{" "}
                    {rejecting.seller.handle}
                  </span>
                </div>
              </div>
            </Card>

            <Note tone="bad">
              Three rejections inside 30 days triggers an automatic member review. The reason is
              written to the member&rsquo;s record either way.
            </Note>

            <div className="gm-field">
              <label className="gm-label" htmlFor="gm-dash-reason">
                Reason shown to the seller
              </label>
              <textarea
                id="gm-dash-reason"
                className="gm-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Be specific. The seller acts on this."
              />
              <span className="gm-hint">
                At least 8 characters. This is what the seller is told.
              </span>
            </div>
          </>
        ) : null}
      </Modal>

      {toast ? (
        <Toast title={toast.title} body={toast.body} onDone={() => setToast(null)} />
      ) : null}
    </div>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedDashboardPage() {
  return (
    <Gate need="dashboard.read">
      <DashboardPage />
    </Gate>
  );
}
