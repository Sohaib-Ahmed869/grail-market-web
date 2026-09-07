"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  conductActions,
  conflictKindLabel,
  money,
  shortDate,
  type Conflict,
} from "../../lib/data";
import {
  ActionBar,
  Badge,
  Card,
  CardBody,
  CardHead,
  ConflictBadge,
  DL,
  Loading,
  MetaBox,
  Modal,
  Note,
  PageHead,
  Slab,
  Toast,
} from "../../components/ui";
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconNote,
  IconScale,
  IconSend,
  IconShield,
  IconTag,
} from "../../components/icons";
import {
  ApiError,
  claimCase,
  decideCase,
  fetchCase,
  messageBothParties,
  setCaseState,
} from "../../lib/api";
import { toConflict } from "../../lib/cases";
import { Gate } from "../../components/Gate";

/**
 * One case, as a page.
 *
 * The board used to open a window over itself carrying both claims, the
 * evidence, the thread and the outcome panel — and applying that outcome
 * opened a second window on top of it. The confirmation is the one thing here
 * that genuinely must not be dismissed by clicking away, and it was the one
 * thing sitting behind another overlay's scrim.
 *
 * The case has a URL of its own now, so it can be sent to the moderator who
 * should really be working it, and the only overlays left are the two that
 * take something: the confirmation, and the line written to both parties.
 */

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
    return `Write the reason it is recorded under. ${left} more character${left === 1 ? "" : "s"} needed.`;
  }
  return null;
}

/** The board's action keys, in the API's outcome vocabulary. `escalate` is not
 *  here because it is a state change, not an outcome. */
const OUTCOME_BY_ACTION: Record<string, string> = {
  none: "none",
  warn: "warned",
  restrict: "restricted",
  close: "closed",
  police: "police",
};

function CaseRecord() {
  const id = String(useParams().id ?? "");

  const [open, setOpen] = useState<Conflict | null>(null);
  /* The board draws two roles; the API decides against a person. These are the
     two user ids, so a decision can name one of them. */
  const [ids, setIds] = useState<{ buyer: string; seller: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** Which conduct action closes the case. */
  const [outcome, setOutcome] = useState<string | null>(null);
  /** Whose standing it lands on — seeded from the case, changeable. */
  const [target, setTarget] = useState<"buyer" | "seller">("seller");
  const [rationale, setRationale] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    body: string;
    tone?: "ok" | "bad";
  } | null>(null);

  /* Read the case, and claim it if it is still open, so two moderators cannot
     decide one case. Reading a closed one must not put your name on it as the
     person working it — the board would then show every case anybody had ever
     looked at as taken. */
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetchCase(id)
      .then(async ({ record, thread }) => {
        if (!alive) return;
        const c = toConflict(record, thread);
        setOpen(c);
        setTarget(c.against);
        const raiserIsBuyer = record.raiserRole !== "seller";
        setIds({
          buyer: raiserIsBuyer ? record.raisedBy.id : record.against.id,
          seller: raiserIsBuyer ? record.against.id : record.raisedBy.id,
        });
        if (record.status !== "resolved") await claimCase(id).catch(() => null);
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  async function reread() {
    const r = await fetchCase(id).catch(() => null);
    if (r) setOpen(toConflict(r.record, r.thread));
  }

  const chosen = conductActions.find((a) => a.key === outcome) ?? null;
  const accused = open ? open[target] : null;
  const blocked = blockedBecause(outcome, rationale);

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
    try {
      if (chosen.escalates) {
        await setCaseState(open.id, "escalated", rationale.trim());
      } else {
        await decideCase(open.id, {
          outcome: OUTCOME_BY_ACTION[chosen.key] ?? "none",
          note: rationale.trim(),
          againstId: ids?.[target],
        });
      }
      setConfirming(false);
      setOutcome(null);
      setRationale("");
      await reread();
      setToast({
        title: chosen.escalates ? "Handed to Trust and safety" : "Outcome applied",
        body: `${open.listing.card} · ${chosen.title}, written to the member record`,
      });
    } catch (e) {
      setConfirming(false);
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
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
      const { delivery } = await messageBothParties(open.id, message.trim());
      setMessaging(false);
      setMessage("");
      await reread();
      /* What happened, not what was attempted. "Sent to both parties" was true
         of the attempt whether or not either of them could receive it. */
      setToast({
        title: "Written to both parties",
        body:
          `${open.listing.card} · ${delivery.delivered} of ${delivery.of} have it in the app` +
          (delivery.pushed > 0
            ? `, ${delivery.pushed} pushed to a device`
            : ". Neither has a device registered, so nothing was pushed."),
      });
    } catch (e) {
      setToast({
        title: "Nothing was sent",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
    } finally {
      setSending(false);
    }
  }

  const back = { href: "/admin/conflicts", label: "Reports & conduct" };

  if (error) {
    return (
      <>
        <PageHead title="Case" back={back} />
        <Note tone="bad">
          <b>That case could not be read.</b> {error}
        </Note>
      </>
    );
  }

  if (loading || !open) {
    return (
      <>
        <PageHead title="Opening…" back={back} />
        <Card>
          <Loading label="Reading the case…" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={`${conflictKindLabel[open.kind]} · against ${open[open.against].handle}`}
        sub={`${open.listing.card} · reported by ${open[open.against === "seller" ? "buyer" : "seller"].handle}`}
        back={back}
        /* No severity score. It was a number this console computed for
           itself — a weighting of the kind, the amount and the age — printed
           as "Medium 6/10" beside a case whose actual severity is decided by
           reading it. Nothing keyed off it, nothing sorted by it, and a
           made-up score sitting next to real facts invites being trusted
           like one. The three inputs are all on this page in their own
           words. */
        right={<ConflictBadge status={open.status} />}
      />

      <div className="gm-stack">
        <Card pad>
          <div className="gm-record-top">
            <Slab
              grader={open.listing.grader}
              grade={open.listing.grade}
              art={open.listing.art}
              size="lg"
            />
            <div className="gm-stack" style={{ gap: 12, minWidth: 0 }}>
              <div className="gm-cell2">
                <b style={{ fontSize: 15 }}>{open.listing.card}</b>
                <span>{open.listing.setLine}</span>
              </div>
              <div className="gm-cell2">
                <b style={{ fontSize: 15 }}>{money(open.amount)}</b>
                <span>What the trade was worth. Nothing is held against it.</span>
              </div>
              <div className="gm-metagrid">
                <MetaBox label="Opened" value={shortDate(open.opened)} icon={<IconCalendar />} />
                <MetaBox
                  label="Running"
                  value={`${Math.round(open.ageHours)} hours`}
                  icon={<IconClock />}
                />
                <MetaBox label="Trade value" value={money(open.amount)} icon={<IconTag />} />
                <MetaBox
                  label="Prior cases"
                  value={
                    open[open.against].disputes === 0
                      ? "None before this"
                      : `${open[open.against].disputes} against them`
                  }
                  icon={<IconShield />}
                />
              </div>
            </div>
          </div>
        </Card>

        {open.kind === "threats" ? (
          <Note tone="bad">
            <b>This one can leave the platform.</b> Keep the thread unedited. A referral to police
            is judged on what was actually sent.
          </Note>
        ) : null}

        {open[open.against].disputes >= 4 ? (
          <Note tone="bad">
            <b>Pattern worth checking.</b> {open[open.against].handle} has{" "}
            {open[open.against].disputes} prior cases. Read the member record before deciding this
            one on its own.
          </Note>
        ) : null}

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
            <div className="gm-quote">&ldquo;{open.buyerClaim}&rdquo;</div>
          </div>
          <div className="gm-side-panel gm-side-panel--seller">
            <h4>Seller{open.against === "seller" ? " · reported" : ""}</h4>
            <div className="gm-row" style={{ gap: 9, marginBottom: 10, flexWrap: "nowrap" }}>
              <div className="gm-cell2">
                <b>{open.seller.name}</b>
                <span>{open.seller.handle}</span>
              </div>
            </div>
            <div className="gm-quote">&ldquo;{open.sellerClaim}&rdquo;</div>
          </div>
        </div>

        <Card>
          <CardHead title="Evidence" sub={`${open.evidence.length} items submitted`} />
          <CardBody style={{ paddingTop: 8 }}>
            {open.evidence.length === 0 ? (
              <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                Neither side has attached anything. The case is decided on what is written above.
              </p>
            ) : (
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
                  </div>
                ))}
              </div>
            )}
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
                    {/* `shortDate`, not the raw value. The thread carries the
                        store's own timestamps, so this line read
                        "2026-09-06T10:19:21.004Z" — a machine's answer to a
                        question a moderator asked in order to work out how
                        long the two of them have been waiting. */}
                    <div className="gm-feed-time">
                      {t.by} · {shortDate(t.at)}
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
              title="Outcome"
              sub="Both parties are told the outcome and the reason you record."
            />
            <CardBody>
              {/* Who it lands on. A conduct action is against a person, so the
                  side is picked before the action, not after. */}
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
                          flex: "1 1 180px",
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
                            {side === open.against ? "reported" : "the reporter"} · {who.disputes}{" "}
                            prior
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
                  anybody saw. The mark on the left is the answer to "why is the
                  button still off". */}
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
                  <b>{chosen.title} is not yours to apply alone.</b> Confirming hands the case, the
                  evidence and this reason to Trust and safety, who carry it out. It leaves your
                  queue either way.
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
        ) : null}

        <ActionBar note={open.status !== "resolved" ? blocked ?? undefined : undefined}>
          {open.status !== "resolved" ? (
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
              <button type="button" className="gm-btn" onClick={() => setMessaging(true)}>
                <IconSend />
                Message both
              </button>
            </>
          ) : (
            <span className="gm-sm gm-muted">
              Closed. Reopening needs a lead moderator and leaves a record.
            </span>
          )}
        </ActionBar>
      </div>

      {/* ============================================================= modal */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Apply this outcome?"
        sub="It lands on a member's standing and stays on their record."
        footer={
          <>
            <button type="button" className="gm-btn gm-btn--primary" onClick={commit}>
              <IconShield />
              {chosen?.escalates ? "Confirm and hand over" : "Confirm and close case"}
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--ghost"
              onClick={() => setConfirming(false)}
            >
              Go back
            </button>
          </>
        }
      >
        <Card pad>
          <DL
            rows={[
              ["Case", conflictKindLabel[open.kind]],
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
              <b>This ends someone&rsquo;s access.</b> Closing an account retires the handle, and a
              referral cannot be withdrawn once Trust and safety have filed it. Only a lead
              moderator can reverse either, and the reversal is recorded too.
            </>
          ) : (
            <>
              <b>This stays on the record.</b> Nothing is deleted later. A lifted restriction reads
              as lifted rather than as never applied.
            </>
          )}
        </Note>
        <div>
          <div className="gm-label" style={{ marginBottom: 6 }}>
            Reason both parties will see
          </div>
          <div className="gm-quote">{rationale}</div>
        </div>
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
        <Card pad>
          <DL
            rows={[
              ["Case", conflictKindLabel[open.kind]],
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
      </Modal>

      {toast ? (
        <Toast
          title={toast.title}
          body={toast.body}
          tone={toast.tone}
          onDone={() => setToast(null)}
        />
      ) : null}
    </>
  );
}

/* Access is decided before the page renders, not inside it — see the warning
   in RoleContext about what this gate is and is not. */
export default function GatedCaseRecord() {
  return (
    <Gate need="conduct.decide">
      <CaseRecord />
    </Gate>
  );
}
