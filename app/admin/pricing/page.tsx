"use client";

import { useEffect, useMemo, useState } from "react";
import { aud, DUNNING_LADDER, shortDate } from "../lib/data";
import {
  ApiError,
  applyBoost,
  compBoost,
  compPlan,
  fetchCommerce,
  type AdminBillingEvent,
  type AdminBoost,
  type AdminBoostTier,
  type AdminPlan,
  type BillingEventKind,
  type BoostState,
} from "../lib/api";
import {
  Badge,
  BlockHead,
  Card,
  CardBody,
  CardHead,
  DL,
  Empty,
  Modal,
  Note,
  FilterMenu,
  PageHead,
  Toast,
} from "../components/ui";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconExternal,
  IconInfo,
  IconSparkle,
} from "../components/icons";
import { Gate } from "../components/Gate";

type Tab = "plans" | "boosts" | "billing";

/** The three things this page holds. They are different datasets, not three
 *  views of one, so the heading always names which is on screen. */
const SECTIONS: { key: Tab; label: string }[] = [
  { key: "plans", label: "Plans" },
  { key: "boosts", label: "Boosts" },
  { key: "billing", label: "Billing" },
];

/** Stripe's event kinds, in the order they matter to somebody chasing money. */
const BILLING_KINDS: BillingEventKind[] = [
  "payment-failed",
  "abandoned",
  "cancelled",
  "refunded",
  "subscribed",
  "paid",
  "plan-changed",
];

const BOOST_STATE_LABEL: Record<BoostState, string> = {
  active: "Running",
  scheduled: "Scheduled",
  expired: "Finished",
  "paid-not-applied": "Paid, never applied",
  comped: "Comped",
};

const EVENT_LABEL: Record<BillingEventKind, string> = {
  subscribed: "Subscribed",
  paid: "Paid",
  "payment-failed": "Payment failed",
  cancelled: "Cancelled",
  "plan-changed": "Plan changed",
  abandoned: "Checkout abandoned",
  refunded: "Refunded",
};

const EVENT_TONE: Record<BillingEventKind, "ok" | "warn" | "bad" | "idle" | "gold"> = {
  subscribed: "gold",
  paid: "ok",
  "payment-failed": "bad",
  cancelled: "warn",
  "plan-changed": "idle",
  abandoned: "idle",
  refunded: "warn",
};

function PricingPage() {
  const [tab, setTab] = useState<Tab>("plans");
  /* Secondary filters, one per section. They live beside the section itself in
     one menu rather than as a second control that appears and disappears. */
  const [boostState, setBoostState] = useState("all");
  const [eventKind, setEventKind] = useState("all");

  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [boosts, setBoosts] = useState<AdminBoost[]>([]);
  const [billing, setBilling] = useState<AdminBillingEvent[]>([]);
  const [tiers, setTiers] = useState<AdminBoostTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writes, setWrites] = useState(0);

  /* Comping, and fixing a boost that was charged for and never ran. */
  const [comping, setComping] = useState<AdminBoost | null>(null);
  const [compingPlan, setCompingPlan] = useState<AdminPlan | null>(null);
  const [compMember, setCompMember] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchCommerce()
      .then((r) => {
        if (!live) return;
        setPlans(r.plans);
        setBoosts(r.boosts);
        setBilling(r.billing);
        setTiers(r.boostTiers);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [writes]);

  const mrr = useMemo(() => plans.reduce((s, p) => s + p.mrr, 0), [plans]);
  const subscribers = useMemo(() => plans.reduce((s, p) => s + p.subscribers, 0), [plans]);
  const pastDue = useMemo(() => plans.reduce((s, p) => s + p.pastDue, 0), [plans]);
  const stuck = boosts.filter((b) => b.state === "paid-not-applied");

  /* A plan with no Stripe price behind it cannot be sold, whatever the page
     says it costs. Said once, at the top, rather than three times. */
  const unpriced = plans.filter((p) => !p.stripePriceId);

  /* What the two ledgers actually draw, after the filter. Both are read from
     one `commerce` call and cut here — the API answers the whole page in one
     round trip, so filtering a second time over the wire would buy nothing. */
  const shownBoosts = useMemo(
    () => (boostState === "all" ? boosts : boosts.filter((b) => b.state === boostState)),
    [boosts, boostState],
  );
  const shownBilling = useMemo(
    () => (eventKind === "all" ? billing : billing.filter((e) => e.kind === eventKind)),
    [billing, eventKind],
  );

  async function run(what: () => Promise<string>) {
    setBusy(true);
    try {
      setToast(await what());
      setWrites((n) => n + 1);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Subscriptions & boosts"
        sub={
          loading
            ? "Reading the ledger…"
            : `${aud(mrr)} a month from ${subscribers.toLocaleString("en-US")} subscriber${
                subscribers === 1 ? "" : "s"
              }. Plans and boosts are our own income, billed through Stripe, and separate from a trade between two members where no money passes through us.`
        }
        right={
          <a className="gm-btn" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
            <IconExternal />
            Stripe
          </a>
        }
      />

      <div className="gm-stack">
        {loadError ? (
          <Note tone="bad">
            <b>The ledger could not be read.</b> {loadError}
          </Note>
        ) : null}

        {stuck.length > 0 ? (
          <Note tone="bad">
            <b>
              {stuck.length} boost{stuck.length === 1 ? " has" : "s have"} been charged for and
              never ran.
            </b>{" "}
            They are at the top of the Boosts tab.
          </Note>
        ) : null}

        {pastDue > 0 ? (
          <Note tone="warn">
            <b>
              {pastDue} subscription{pastDue === 1 ? "" : "s"} {pastDue === 1 ? "is" : "are"} on a
              failed card.
            </b>{" "}
            Access is unchanged while a charge is retrying — see Billing.
          </Note>
        ) : null}

        {/* One filter language, the same as the listing queue and the case
            board: the heading names what is shown, its subtitle spells out
            what is applied, and the control sits beside it.

            The secondary filter belongs in the same menu rather than as a
            second control that appears when you switch section — one place to
            look, and the groups on offer say what this section can be cut by. */}
        <BlockHead
          title={SECTIONS.find((x) => x.key === tab)!.label}
          sub={
            tab === "plans"
              ? `${plans.length} plan${plans.length === 1 ? "" : "s"}, priced in Stripe`
              : tab === "boosts"
                ? `${shownBoosts.length} of ${boosts.length} on record${
                    boostState === "all" ? "" : ` · ${BOOST_STATE_LABEL[boostState as BoostState]}`
                  }`
                : `${shownBilling.length} of ${billing.length} events${
                    eventKind === "all" ? "" : ` · ${eventKind.replace("-", " ")}`
                  }`
          }
          right={
            <FilterMenu
              applied={
                (tab === "plans" ? 0 : 1) +
                (tab === "boosts" && boostState !== "all" ? 1 : 0) +
                (tab === "billing" && eventKind !== "all" ? 1 : 0)
              }
              onClear={() => {
                setTab("plans");
                setBoostState("all");
                setEventKind("all");
              }}
              groups={[
                {
                  key: "section",
                  label: "What to show",
                  value: tab,
                  onChange: (v) => setTab(v as Tab),
                  options: SECTIONS.map((x) => ({
                    value: x.key,
                    label: x.label,
                    count:
                      x.key === "plans" ? plans.length
                      : x.key === "boosts" ? boosts.length
                      : billing.length,
                  })),
                },
                ...(tab === "boosts"
                  ? [
                      {
                        key: "boost-state",
                        label: "Boost state",
                        value: boostState,
                        onChange: setBoostState,
                        options: [
                          { value: "all", label: "Any state" },
                          ...(Object.keys(BOOST_STATE_LABEL) as BoostState[]).map((k) => ({
                            value: k,
                            label: BOOST_STATE_LABEL[k],
                            count: boosts.filter((b) => b.state === k).length,
                          })),
                        ],
                      },
                    ]
                  : []),
                ...(tab === "billing"
                  ? [
                      {
                        key: "event-kind",
                        label: "Event",
                        value: eventKind,
                        onChange: setEventKind,
                        options: [
                          { value: "all", label: "Everything" },
                          ...BILLING_KINDS.map((k) => ({
                            value: k,
                            label: k.replace("-", " "),
                            count: billing.filter((e) => e.kind === k).length,
                          })),
                        ],
                      },
                    ]
                  : []),
              ]}
            />
          }
        />

        {/* ==================================================== plans */}
        {tab === "plans" ? (
          <>
            {unpriced.length > 0 ? (
              <Note tone="warn">
                <b>
                  {unpriced.length} plan{unpriced.length === 1 ? " has" : "s have"} no Stripe price
                  configured.
                </b>{" "}
                {unpriced.map((p) => p.name).join(", ")} cannot be bought until{" "}
                {unpriced.map((p) => p.stripePriceEnv).join(", ")} {unpriced.length === 1 ? "is" : "are"} set on
                the API.
              </Note>
            ) : null}

            <div className="gm-grid gm-grid--3">
              {plans.map((p) => (
                <Card key={p.id}>
                  <CardHead
                    title={p.name}
                    sub={p.blurb}
                    right={
                      p.subscribers > 0 ? (
                        <Badge tone="ok">{p.subscribers.toLocaleString("en-US")} on it</Badge>
                      ) : (
                        <Badge tone="idle">Nobody yet</Badge>
                      )
                    }
                  />
                  <CardBody>
                    <div className="gm-row" style={{ gap: 8, marginBottom: 12, alignItems: "baseline" }}>
                      <b style={{ fontSize: 26, letterSpacing: "-0.02em" }}>{aud(p.price)}</b>
                      <span className="gm-muted">a month</span>
                    </div>

                    <DL
                      rows={[
                        [
                          "Listing quota",
                          p.quota === null ? (
                            <Badge tone="gold">No ceiling</Badge>
                          ) : (
                            <b>
                              {p.quota} live listing{p.quota === 1 ? "" : "s"}
                            </b>
                          ),
                        ],
                        ["Brings in", `${aud(p.mrr)} a month`],
                        [
                          "On a failed card",
                          p.pastDue === 0 ? "None" : <Badge tone="warn">{p.pastDue}</Badge>,
                        ],
                        ["Cancelled", p.cancelled === 0 ? "None" : p.cancelled],
                        [
                          "Months comped",
                          p.comped === 0 ? "None" : `${p.comped} given away`,
                        ],
                      ]}
                    />

                    <div className="gm-person-tags" style={{ marginTop: 10 }}>
                      {p.perks.map((f) => (
                        <span key={f} className="gm-scope">
                          {f}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="gm-btn gm-btn--sm"
                      style={{ marginTop: 12 }}
                      onClick={() => {
                        setCompingPlan(p);
                        setWhy("");
                        setCompMember("");
                      }}
                    >
                      <IconCheck />
                      Comp a month
                    </button>
                  </CardBody>
                </Card>
              ))}
            </div>

            <Note tone="gold">
              <b>The price is set in Stripe, not here.</b> A figure typed into two systems disagrees
              with itself the first time anybody changes one, and the console would then be quoting
              a price nobody is paying. What this page answers is the part Stripe cannot: who is on
              each plan, and what that is worth. Change a price in the Stripe dashboard and point
              the API&rsquo;s price variable at the new one.
            </Note>
          </>
        ) : null}

        {/* =================================================== boosts */}
        {tab === "boosts" ? (
          <>
            <div className="gm-grid gm-grid--3">
              {tiers.map((t) => (
                <Card key={t.key}>
                  <CardHead
                    title={t.name}
                    sub={`${aud(t.amountCents / 100)} · ${t.days} day${t.days === 1 ? "" : "s"}`}
                    right={t.featured ? <Badge tone="gold">Featured rail</Badge> : null}
                  />
                  <CardBody>
                    <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                      {t.detail}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>

            {stuck.length > 0 ? (
              <Note tone="bad">
                <b>
                  {stuck.length} boost{stuck.length === 1 ? " has" : "s have"} been paid for and
                  never ran.
                </b>{" "}
                Every one of these is a member watching a listing that has not moved. Apply it and
                the days lost are added on top, or comp it. Doing neither means charging for
                nothing.
              </Note>
            ) : null}

            {loading && boosts.length === 0 ? (
              <Card>
                <Empty icon={<IconSparkle />} title="Reading the ledger…" />
              </Card>
            ) : shownBoosts.length === 0 ? (
              <Card>
                <Empty
                  icon={<IconSparkle />}
                  title={boosts.length === 0 ? "No boost has been bought yet" : "Nothing in that state"}
                  body={
                    boosts.length === 0
                      ? "Nothing has been charged for a featured listing. The three products above are live; this fills as they sell."
                      : "No boost currently sits in that state. Clear the filter to see the whole ledger."
                  }
                />
              </Card>
            ) : (
              <div className="gm-stack" style={{ gap: 9 }}>
                {shownBoosts.map((b) => {
                  const broken = b.state === "paid-not-applied";
                  return (
                    <Card key={b.id} pad>
                      <div
                        className="gm-row"
                        style={{ gap: 12, flexWrap: "nowrap", alignItems: "flex-start" }}
                      >
                        <span
                          className={`gm-feed-ico ${broken ? "gm-feed-ico--bad" : "gm-feed-ico--gold"}`}
                          style={{ flex: "none" }}
                        >
                          {broken ? <IconAlert /> : <IconSparkle />}
                        </span>
                        <div className="gm-cell2" style={{ flex: "1 1 auto", minWidth: 0 }}>
                          <b>
                            {b.tierName} · {b.card}
                          </b>
                          <span>
                            {b.handle} · {b.listingId} · {aud(b.amount)} · bought{" "}
                            {shortDate(b.purchased)}
                          </span>
                          {b.fault ? (
                            <span className="gm-sm gm-muted" style={{ marginTop: 6 }}>
                              {b.fault}
                            </span>
                          ) : null}
                          {b.compedBy ? (
                            <span className="gm-tiny gm-dim" style={{ marginTop: 4 }}>
                              Comped by {b.compedBy}
                              {b.compReason ? ` — ${b.compReason}` : ""}
                            </span>
                          ) : null}
                        </div>
                        <div className="gm-row" style={{ gap: 7, flex: "none" }}>
                          {broken ? (
                            <Badge tone="bad">
                              {BOOST_STATE_LABEL[b.state]} · {b.stuckHours}h
                            </Badge>
                          ) : b.state === "active" ? (
                            <Badge tone="ok">{BOOST_STATE_LABEL[b.state]}</Badge>
                          ) : (
                            <Badge tone="idle">{BOOST_STATE_LABEL[b.state]}</Badge>
                          )}
                        </div>
                      </div>

                      {broken ? (
                        <div className="gm-row" style={{ gap: 8, marginTop: 11 }}>
                          <button
                            type="button"
                            className="gm-btn gm-btn--sm gm-btn--primary"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const r = await applyBoost(b.id);
                                return `${b.tierName} on ${b.card} is running · extended by ${r.daysAdded} day${
                                  r.daysAdded === 1 ? "" : "s"
                                }`;
                              })
                            }
                          >
                            <IconClock />
                            Apply now and extend
                          </button>
                          <button
                            type="button"
                            className="gm-btn gm-btn--sm"
                            onClick={() => {
                              setComping(b);
                              setWhy("");
                            }}
                          >
                            <IconCheck />
                            Comp it
                          </button>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {/* ================================================== billing */}
        {tab === "billing" ? (
          <>
            <Card>
              <CardHead
                title="What happens when a payment fails"
                sub="The retry schedule a failed charge goes through before the plan lapses"
              />
              <CardBody>
                <div className="gm-row" style={{ gap: 8 }}>
                  {DUNNING_LADDER.map((step, i) => (
                    <span key={step} className="gm-scope">
                      {i + 1}. {step}
                    </span>
                  ))}
                </div>
                <p className="gm-sm gm-muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  Access is unchanged while a charge is retrying. A member whose card failed has not
                  done anything wrong. The plan lapses only after the last attempt, and the listing
                  quota drops with it.
                </p>
              </CardBody>
            </Card>

            {shownBilling.length === 0 ? (
              <Card>
                <Empty
                  icon={<IconInfo />}
                  title={billing.length === 0 ? "Nothing to chase" : "Nothing of that kind"}
                  body={
                    billing.length === 0
                      ? "No subscription, payment or cancellation has come back from Stripe yet."
                      : "No event of that kind in the period. Clear the filter to see them all."
                  }
                />
              </Card>
            ) : (
              <Card>
                <div className="gm-tablewrap">
                  <table className="gm-table" style={{ minWidth: 780 }}>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Member</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th className="gm-nowrap">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownBilling.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <Badge tone={EVENT_TONE[e.kind]}>{EVENT_LABEL[e.kind]}</Badge>
                            {e.reason ? (
                              <div className="gm-tiny gm-dim">{e.reason}</div>
                            ) : null}
                          </td>
                          <td className="gm-sm">
                            <span className="gm-cell2">
                              <b>{e.name}</b>
                              <span className="gm-mono">{e.handle}</span>
                            </span>
                          </td>
                          <td className="gm-sm gm-muted gm-nowrap">
                            {e.planId ? e.planId[0].toUpperCase() + e.planId.slice(1) : "—"}
                          </td>
                          <td className="gm-mono gm-sm gm-nowrap">
                            {e.amount == null ? "—" : aud(e.amount)}
                          </td>
                          <td className="gm-sm gm-muted gm-nowrap">{shortDate(e.at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>

      {/* ======================================================= comp boost */}
      <Modal
        open={!!comping}
        onClose={() => setComping(null)}
        title="Comp this boost"
        sub="It costs real revenue, so it is filed against the member with your name on it."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={why.trim().length < 6 || busy}
              onClick={() => {
                const b = comping;
                if (!b) return;
                setComping(null);
                run(async () => {
                  await compBoost(b.id, why.trim());
                  setWhy("");
                  return `${b.tierName} comped · filed to ${b.handle}`;
                });
              }}
            >
              <IconCheck />
              Comp and file
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setComping(null)}>
              Cancel
            </button>
          </>
        }
      >
        {comping ? (
          <>
            <Card pad>
              <DL
                rows={[
                  ["Boost", `${comping.tierName} · ${comping.id}`],
                  ["Member", `${comping.name} · ${comping.handle}`],
                  ["Listing", `${comping.card} · ${comping.listingId}`],
                  ["Not charged", aud(comping.amount)],
                ]}
              />
            </Card>
            <div className="gm-field">
              <label className="gm-label" htmlFor="comp-why">
                Why
              </label>
              <textarea
                id="comp-why"
                className="gm-textarea"
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="What went wrong, and why this is the right way to make it good."
              />
            </div>
          </>
        ) : null}
      </Modal>

      {/* ======================================================== comp plan */}
      <Modal
        open={!!compingPlan}
        onClose={() => setCompingPlan(null)}
        title={compingPlan ? `Comp a month of ${compingPlan.name}` : ""}
        sub="One billing cycle, not a standing arrangement."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={!compMember.trim() || why.trim().length < 6 || busy}
              onClick={() => {
                const p = compingPlan;
                if (!p) return;
                const member = compMember.trim();
                setCompingPlan(null);
                run(async () => {
                  await compPlan(p.id, member, why.trim());
                  setWhy("");
                  setCompMember("");
                  return `${p.name} comped for ${member} · filed to their record`;
                });
              }}
            >
              <IconCheck />
              Comp and file
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--ghost"
              onClick={() => setCompingPlan(null)}
            >
              Cancel
            </button>
          </>
        }
      >
        {compingPlan ? (
          <>
            <Card pad>
              <DL
                rows={[
                  ["Plan", compingPlan.name],
                  ["Not charged", `${aud(compingPlan.price)} for one month`],
                  [
                    "Quota while comped",
                    compingPlan.quota === null
                      ? "No ceiling"
                      : `${compingPlan.quota} live listings`,
                  ],
                ]}
              />
            </Card>
            <div className="gm-field">
              <label className="gm-label" htmlFor="comp-member">
                Member
              </label>
              <input
                id="comp-member"
                className="gm-input gm-mono"
                value={compMember}
                onChange={(e) => setCompMember(e.target.value)}
                placeholder="u_…"
              />
              {/* The account id, not the handle: a handle is derived from a
                  display name and two people can share one. Members has it on
                  the record. */}
              <span className="gm-hint">
                The account id from the member record. A handle is derived from a display name and
                is not unique.
              </span>
            </div>
            <div className="gm-field">
              <label className="gm-label" htmlFor="comp-plan-why">
                Why
              </label>
              <textarea
                id="comp-plan-why"
                className="gm-textarea"
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="A support case, an outage, an apology. It goes on their record."
              />
            </div>
          </>
        ) : null}
      </Modal>

      {toast ? <Toast title="Done" body={toast} onDone={() => setToast(null)} /> : null}
    </>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedPricingPage() {
  return (
    <Gate need="billing.read">
      <PricingPage />
    </Gate>
  );
}
