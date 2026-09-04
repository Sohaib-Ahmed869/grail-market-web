"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { aud, money } from "./lib/data";
import {
  ApiError,
  decideListing,
  fetchDashboard,
  useListings,
  type AdminListing,
  type Dashboard,
} from "./lib/api";
import {
  Card,
  Empty,
  Funnel,
  LinkStat,
  Loading,
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
  IconInbox,
  IconShield,
  IconXCircle,
} from "./components/icons";
import { Gate } from "./components/Gate";
import { useRole } from "./components/RoleContext";

/* The greeting, the money, the funnel and the queue stack in the left column;
   the rail runs the full height beside them rather than sitting under a chart.
   That is what lifts the standings and the review mix above the fold.

   Anything that is only a number lives in the rail as a link to the page that
   owns it — a tile that states a figure and goes nowhere is a poster, not a
   control. The one table on this page is the exception, and it earns it by
   being worked here: its rows are decided in place rather than handed off. */
const SLA_ROWS = 4;

/* The plan colours, here rather than on the API: which colour a plan is drawn
   in is a rendering decision and Stripe has no opinion about it. Indexed by
   position, so a fourth plan gets one without anybody adding it. */
const PLAN_COLOUR = ["var(--gold)", "var(--navy-500)", "var(--ink-4)", "var(--ok)"];

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

function DashboardPage() {
  const [rejecting, setRejecting] = useState<AdminListing | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  /* Everything on this page, from the API.

     It was the last one drawing sample money, and the figure it invented was
     one another page already knew: it printed ~4,900 subscribers while
     /admin/pricing read the real number off the database. Two pages of one
     console disagreeing about the same number is worse than either being
     wrong on its own. */
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* The queue is the listing queue, read through the same hook the queue page
     uses — the rows are worked here, so they must be the same rows. */
  const { data: queueData, loading: queueLoading, reload } = useListings({
    view: "queue",
    search: "",
    tier: "all",
  });
  const queue = useMemo(
    () => [...(queueData?.listings ?? [])].sort((a, b) => a.slaHours - b.slaHours),
    [queueData],
  );

  const [writes, setWrites] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchDashboard()
      .then((r) => {
        if (!live) return;
        setData(r);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [writes]);

  const stats = data?.stats;
  const moneyIn = data?.money;
  const breached = stats?.breached ?? 0;
  const funnel = data?.funnel ?? [];
  const queueMix = data?.queueMix ?? [];

  /* How much of the intake came out the far end. Null rather than 0% when
     nobody signed up in the period: no cohort is not a cohort that failed. */
  const funnelEnd =
    funnel.length > 1 && funnel[0].value > 0
      ? Math.round((funnel[funnel.length - 1].value / funnel[0].value) * 100)
      : null;

  const { me } = useRole();
  const firstName = (me?.name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  /* Movement, from the series itself rather than from a constant. The header
     used to carry "+11.4%" and "+8.2%" written into the markup — figures that
     were not computed from anything and could not go down. */
  const gmv = data?.gmv ?? [];
  const gmvGrowth = (() => {
    if (gmv.length < 2) return null;
    const last = gmv[gmv.length - 1].gmv;
    const prev = gmv[gmv.length - 2].gmv;
    if (prev <= 0) return null;
    return ((last - prev) / prev) * 100;
  })();

  /* Both decisions go through the same endpoint the queue page uses, so a
     decision taken here is a decision — it moves the listing, notifies the
     seller and writes to the audit log. It used to append to an in-memory
     array and show a toast saying the seller had been told. */
  async function approve(l: AdminListing) {
    if (busy) return;
    setBusy(true);
    try {
      const { listing, decidedBy } = await decideListing(l.id, "approve", "");
      reload();
      setWrites((n) => n + 1);
      setToast({
        title: "Published to the market",
        body: `${listing.card} · by ${decidedBy} · the seller has been notified`,
      });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    if (!rejecting || busy) return;
    setBusy(true);
    try {
      const { listing, decidedBy } = await decideListing(rejecting.id, "reject", reason.trim());
      setRejecting(null);
      setReason("");
      reload();
      setWrites((n) => n + 1);
      setToast({
        title: "Rejected and the seller told",
        body: `${listing.card} · by ${decidedBy} · the reason is on ${listing.seller.handle}'s record`,
      });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  /* The whole page waits. Its panels are four aggregates of one moment, and
     showing some of them against a spinner in the others would be four
     different moments on one screen. */
  if (loading && !data) {
    return (
      <div className="gm-well">
        <Loading label="Reading the marketplace…" />
      </div>
    );
  }

  return (
    <div className="gm-dash">
      {/* ==================================================== left column */}
      <div className="gm-dash-main">
        {/* A console that cannot reach its API must say so. An empty
            marketplace and a broken connection look identical otherwise. */}
        {loadError ? (
          <Note tone="bad">
            <b>The marketplace could not be read.</b> {loadError}
          </Note>
        ) : null}

        <section className="gm-hero">
          <div className="gm-hero-copy">
            {/* The date, and the greeting, from the clock rather than
                written into the markup — it said "Sunday · 1 September" on
                every day of the year. */}
            <div className="gm-hero-eyebrow">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            <h2>
              {greeting}, {firstName}. <em>{queue.length} card{queue.length === 1 ? "" : "s"}</em>{" "}
              {queue.length === 1 ? "is" : "are"} waiting on you.
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
              {/* No Export here. The queue page owns the queue and exports
                  it with the filters applied; a second button on the greeting
                  exporting the same rows unfiltered is a second answer to the
                  same question. */}
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
              {/* No growth badge. It needs last month's MRR, which nothing
                  records — the figure it used to show came from a constant
                  beside the one above it and could not go down. */}
            </div>

            <div className="gm-well">
              <div className="gm-money">
                <span className="gm-money-value">{aud(moneyIn?.mrr ?? 0)}</span>
                <span className="gm-money-unit">
                  MRR · {(moneyIn?.subscribers ?? 0).toLocaleString("en-AU")} subscriber
                  {moneyIn?.subscribers === 1 ? "" : "s"}
                </span>
              </div>

              <StackBar
                parts={(moneyIn?.tiers ?? []).map((t, i) => ({
                  label: t.name,
                  value: t.mrr,
                  color: PLAN_COLOUR[i % PLAN_COLOUR.length],
                }))}
              />

              <div>
                {(moneyIn?.tiers ?? []).map((t, i) => (
                  <div key={t.id} className="gm-planline">
                    <span
                      className="gm-planline-key"
                      style={{ background: PLAN_COLOUR[i % PLAN_COLOUR.length] }}
                    />
                    <span className="gm-planline-name">
                      <b>{t.name}</b>
                      <span>
                        {aud(t.price)} a month ·{" "}
                        {t.quota === null
                          ? "unlimited listings"
                          : `${t.quota} listing${t.quota > 1 ? "s" : ""}`}
                      </span>
                    </span>
                    <span className="gm-planline-num">
                      <b>{aud(t.mrr)}</b>
                      <span>{t.subscribers.toLocaleString("en-AU")} on plan</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Collected is not MRR, and the difference is the dunning pile —
                  saying only one of the two hides a real queue of work. */}
              <p className="gm-sm gm-muted" style={{ marginTop: 14 }}>
                <b className="gm-strong">{aud(moneyIn?.collected ?? 0)}</b> collected this
                month.{" "}
                <span className="gm-dim">
                  {(moneyIn?.failed ?? 0) > 0
                    ? `${aud(moneyIn!.failed)} failed across ${moneyIn!.failedAccounts} account${
                        moneyIn!.failedAccounts === 1 ? "" : "s"
                      }.`
                    : "Nothing failed."}
                </span>
              </p>
            </div>
          </section>

          <section>
            <div className="gm-blockhead">
              <h3>Verification funnel</h3>
              <p>New accounts, last 30 days</p>
              {funnelEnd !== null ? (
                <span className="gm-spacer gm-badge gm-badge--gold">{funnelEnd}% end to end</span>
              ) : null}
            </div>

            <div className="gm-well">
              <Funnel stages={funnel} />
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
            {queueLoading && queue.length === 0 ? (
              <Loading label="Reading the queue…" />
            ) : queue.length === 0 ? (
              <Empty
                icon={<IconInbox />}
                title="The queue is clear"
                body="Nothing is waiting on a human right now."
              />
            ) : (
              <div className="gm-tablewrap">
                {/* No `minWidth`, so it fits the column it is in rather than
                    forcing a sideways scrollbar into the middle of the
                    dashboard. `--tight` buys the room back: smaller slab,
                    less padding, smaller buttons.

                    `--left` ranges every column left. These figures are read
                    across the row rather than compared down the column, so
                    right-aligning two of them only opened a gap in each
                    line. */}
                <table className="gm-table gm-table--left gm-table--tight">
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Tier</th>
                      <th>State</th>
                      <th>Ask</th>
                      <th>Time left</th>
                      <th>Decision</th>
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
                          <Tier tier={s.tier} />
                        </td>
                        <td>
                          <ListingBadge status={s.status} />
                        </td>
                        <td className="gm-strong gm-nowrap">{money(s.askPrice)}</td>
                        <td className="gm-nowrap">
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
                        <td>
                          <div className="gm-rowact">
                            <button
                              type="button"
                              className="gm-btn gm-btn--sm gm-btn--primary"
                              onClick={() => approve(s)}
                              title={`Approve ${s.card}`}
                              aria-label={`Approve ${s.card}`}
                            >
                              <IconCheck />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              className="gm-btn gm-btn--sm gm-btn--danger"
                              onClick={() => {
                                setReason("");
                                setRejecting(s);
                              }}
                              title={`Reject ${s.card}`}
                              aria-label={`Reject ${s.card}`}
                            >
                              <IconXCircle />
                              <span>Reject</span>
                            </button>
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
            {gmvGrowth !== null ? (
              <span
                className={`gm-spacer gm-badge ${
                  gmvGrowth >= 0 ? "gm-badge--gold" : "gm-badge--bad"
                }`}
              >
                {gmvGrowth >= 0 ? "+" : ""}
                {gmvGrowth.toFixed(1)}% on last week
              </span>
            ) : null}
          </div>
          <div className="gm-well">
            <VolumeChart data={gmv} height={168} />
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
              value={(moneyIn?.subscribers ?? 0).toLocaleString("en-AU")}
            />
            <LinkStat
              href="/admin/listings?view=market"
              label="Live listings"
              value={(stats?.liveListings ?? 0).toLocaleString("en-AU")}
            />
            <LinkStat
              href="/admin/listings?view=queue"
              label="In the review queue"
              value={String(stats?.queueDepth ?? 0)}
            />
            <LinkStat
              href="/admin/conflicts"
              label="Open reports"
              value={String(stats?.openReports ?? 0)}
            />
          </div>
        </section>

        <section>
          <div className="gm-blockhead">
            <h3>Review mix</h3>
            <p>
              {stats?.queueDepth ?? 0} in flight, by tier
            </p>
          </div>
          <div className="gm-well">
            {queueMix.length === 0 ? (
              <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                Nothing is waiting on a decision.
              </p>
            ) : (
              <RingChart rings={queueMix} />
            )}
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
