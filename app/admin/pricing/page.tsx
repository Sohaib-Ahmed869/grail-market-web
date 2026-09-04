"use client";

import { useEffect, useMemo, useState } from "react";
import { aud, DUNNING_LADDER, shortDate } from "../lib/data";
import {
  ApiError,
  applyBoost,
  editPlan,
  syncPlans,
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
  Loading,
  Note,
  FilterMenu,
  SectionTabs,
  PageHead,
  Toast,
} from "../components/ui";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconExternal,
  IconInfo,
  IconRefresh,
  IconTag,
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
  /* The plan open in the editor, and the draft of it. A draft rather than an
     edit in place: a price is the one figure here that costs real money to
     get wrong, so it is typed, read back, and confirmed before it is sent. */
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [draft, setDraft] = useState({ name: "", blurb: "", price: "" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [eventKind, setEventKind] = useState("all");

  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [boosts, setBoosts] = useState<AdminBoost[]>([]);
  const [billing, setBilling] = useState<AdminBillingEvent[]>([]);
  const [tiers, setTiers] = useState<AdminBoostTier[]>([]);
  /* Whether Stripe is reachable, and whether this operator may write to it.
     Both come from the API — the console keeps a copy of the capability table
     so it can hide controls, but the answer is the API's. */
  const [stripe, setStripe] = useState({ configured: false, canEdit: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writes, setWrites] = useState(0);

  /* Comping, and fixing a boost that was charged for and never ran. */
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
        setStripe(r.stripe);
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
  const stripeReady = stripe.configured;
  const canEditPlans = stripe.configured && stripe.canEdit;
  /* A plan Stripe has never confirmed. What is on screen for it is the API's
     own fallback figure, which is not necessarily what anybody is charged —
     worth saying, because the two are indistinguishable otherwise. */
  const unsynced = plans.filter((p) => !p.syncedAt);

  function startEdit(p: AdminPlan) {
    setEditing(p);
    setDraft({ name: p.name, blurb: p.blurb, price: String(p.price) });
  }

  const priceChanged =
    editing !== null && draft.price.trim() !== "" && Number(draft.price) !== editing.price;

  const draftValid =
    draft.name.trim().length >= 2 &&
    draft.price.trim() !== "" &&
    Number.isFinite(Number(draft.price)) &&
    Number(draft.price) >= 0;

  async function savePlan() {
    if (!editing || !draftValid || saving) return;
    setSaving(true);
    try {
      const next = await editPlan(editing.id, {
        name: draft.name.trim(),
        blurb: draft.blurb.trim(),
        price: Number(draft.price),
      });
      setPlans(next);
      setEditing(null);
      setToast(
        priceChanged
          ? `${draft.name.trim()} is now ${aud(Number(draft.price))} a month at Stripe. Existing subscribers keep their current price.`
          : `${draft.name.trim()} updated at Stripe.`,
      );
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function resync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await syncPlans();
      setPlans(r.plans);
      setToast(
        r.problems.length > 0
          ? r.problems.join(" · ")
          : "Read back from Stripe.",
      );
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

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
          <>
            <button
              type="button"
              className="gm-btn"
              onClick={resync}
              disabled={syncing || !stripeReady}
              title={stripeReady ? undefined : "STRIPE_SECRET_KEY is not set on the API"}
            >
              <IconRefresh />
              {syncing ? "Reading…" : "Read from Stripe"}
            </button>
            <a className="gm-btn" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
              <IconExternal />
              Stripe
            </a>
          </>
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
            Access is unchanged while a charge is retrying. See Billing.
          </Note>
        ) : null}

{/* Plans, boosts and billing are three different tables, not three
            views of one, so the switch between them stays on screen. The
            filter beside it cuts whichever table is showing. */}
        <SectionTabs
          value={tab}
          onChange={setTab}
          options={SECTIONS.map((x) => ({
            key: x.key,
            label: x.label,
            count:
              x.key === "plans" ? plans.length : x.key === "boosts" ? boosts.length : billing.length,
          }))}
        />

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
              /* The section is not a filter any more, so it is not counted
                 as one. What is applied is whatever cuts the table showing. */
              applied={
                (tab === "boosts" && boostState !== "all" ? 1 : 0) +
                (tab === "billing" && eventKind !== "all" ? 1 : 0)
              }
              onClear={() => {
                setBoostState("all");
                setEventKind("all");
              }}
              groups={[
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
            {unsynced.length > 0 ? (
              <Note tone="warn">
                <b>
                  {unsynced.length} plan{unsynced.length === 1 ? " has" : "s have"} never been read
                  back from Stripe.
                </b>{" "}
                {unsynced.map((x) => x.name).join(", ")} {unsynced.length === 1 ? "shows" : "show"}{" "}
                the API&rsquo;s fallback figure, which is not necessarily what is charged. Read
                them back to be sure.
              </Note>
            ) : null}

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

            {/* `gm-plans` is what lines the buttons up. The cards hold
                different numbers of perks, so without it each action row sat
                wherever its own content ended and the three were at three
                different heights. */}
            {loading && plans.length === 0 ? (
              <Card>
                <Loading label="Reading the plans…" />
              </Card>
            ) : plans.length === 0 ? (
              <Card>
                <Empty
                  icon={<IconTag />}
                  title="No plans configured"
                  body="The API returned no plan. Check STRIPE_PRICE_* and read from Stripe."
                />
              </Card>
            ) : (
            <div className="gm-grid gm-grid--3 gm-plans">
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
                    <div className="gm-row" style={{ gap: 8, marginBottom: 4, alignItems: "baseline" }}>
                      <b style={{ fontSize: 26, letterSpacing: "-0.02em" }}>{aud(p.price)}</b>
                      <span className="gm-muted">
                        {p.currency !== "AUD" ? `${p.currency} ` : ""}a {p.interval}
                      </span>
                    </div>
                    {/* Where the figure above came from. A price Stripe has
                        confirmed and one the API fell back to look identical,
                        and only one of them is what anybody is charged. */}
                    <div className="gm-tiny gm-dim" style={{ marginBottom: 12 }}>
                      {p.syncedAt
                        ? `From Stripe · read ${shortDate(p.syncedAt)}`
                        : "Not read from Stripe yet. This is the API's own figure."}
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

                    <div className="gm-row gm-plan-actions">
                      {/* Only an operator who may write settings sees this,
                          and only when the API can reach Stripe. A control
                          that cannot work is worse than one that is absent. */}
                      {canEditPlans ? (
                        <button
                          type="button"
                          className="gm-btn gm-btn--sm gm-btn--primary"
                          onClick={() => startEdit(p)}
                        >
                          <IconTag />
                          Edit at Stripe
                        </button>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
            )}

            <Note tone="gold">
              <b>Stripe is still the only copy of the price.</b> Editing a plan here calls Stripe
              and then reads the answer back, so the figure on the card is what Stripe says it
              charges, never a second number kept beside it. A price cannot be edited in place at
              Stripe, so changing one creates a new price and retires the old:{" "}
              <b>anybody already subscribed keeps the price they signed up on</b> until their
              subscription is moved, which is not something this page does.
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
                <Loading label="Reading the ledger…" />
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
                              {b.compReason ? `. ${b.compReason}` : ""}
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
                            {e.planId ? e.planId[0].toUpperCase() + e.planId.slice(1) : "No plan"}
                          </td>
                          <td className="gm-mono gm-sm gm-nowrap">
                            {e.amount == null ? "No amount" : aud(e.amount)}
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

      {/* ======================================================== edit plan */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : "Edit plan"}
        sub="Written straight to Stripe, then read back. Nothing is stored here as a second copy."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={!draftValid || saving}
              onClick={savePlan}
            >
              <IconTag />
              {saving ? "Saving at Stripe…" : "Save at Stripe"}
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Written to the audit log</span>
          </>
        }
      >
        {editing ? (
          <>
            <div className="gm-field">
              <label className="gm-label" htmlFor="pl-name">
                Name
              </label>
              <input
                id="pl-name"
                className="gm-input"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
              <span className="gm-hint">The Stripe product name. Members see it at checkout.</span>
            </div>

            <div className="gm-field">
              <label className="gm-label" htmlFor="pl-blurb">
                Description
              </label>
              <input
                id="pl-blurb"
                className="gm-input"
                value={draft.blurb}
                onChange={(e) => setDraft((d) => ({ ...d, blurb: e.target.value }))}
              />
            </div>

            <div className="gm-field">
              <label className="gm-label" htmlFor="pl-price">
                {editing.currency} a {editing.interval}
              </label>
              <input
                id="pl-price"
                className="gm-input"
                type="number"
                min={0}
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
              />
              <span className="gm-hint">
                Currently {aud(editing.price)}. Whole dollars, not cents.
              </span>
            </div>

            {/* The one thing about this that is not what it sounds like. A
                Stripe price cannot be edited, so changing the figure creates a
                new price and retires the old one; the people already paying
                stay on the old one until each subscription is moved, which is
                not something this console does. */}
            {priceChanged ? (
              <Note tone="warn">
                <b>
                  This creates a new Stripe price and retires the current one.
                </b>{" "}
                New subscriptions will be sold at {aud(Number(draft.price))}.{" "}
                {editing.subscribers > 0 ? (
                  <>
                    The <b>{editing.subscribers.toLocaleString("en-AU")}</b> already on{" "}
                    {editing.name} keep paying {aud(editing.price)} until their subscriptions are
                    migrated in Stripe. This page does not migrate them.
                  </>
                ) : (
                  <>Nobody is on this plan yet, so nothing is left behind on the old price.</>
                )}
              </Note>
            ) : null}

            <Card pad>
              <DL
                rows={[
                  ["Stripe product", editing.stripeProductId || "Resolved from the price on save"],
                  ["Current price", editing.stripePriceId || "None configured"],
                  [
                    "Last read from Stripe",
                    editing.syncedAt ? shortDate(editing.syncedAt) : "Never",
                  ],
                ]}
              />
            </Card>
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
