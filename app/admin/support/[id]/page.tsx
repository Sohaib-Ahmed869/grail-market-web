"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  cannedReplies,
  money,
  nextTier,
  shortDate,
  supportTierDetail,
  supportTierLabel,
} from "../../lib/data";
import {
  ApiError,
  fetchTicket,
  replyToTicket,
  setTicketState,
  type AdminTicket,
  type AdminTicketMessage,
  type TicketContext,
} from "../../lib/api";
import {
  ActionBar,
  Badge,
  Card,
  CardBody,
  CardHead,
  DL,
  Loading,
  Modal,
  Note,
  PageHead,
  PriorityBadge,
  TicketBadge,
  Toast,
} from "../../components/ui";
import {
  IconAlert,
  IconArrowUp,
  IconCard,
  IconCheck,
  IconSend,
  IconUsers,
} from "../../components/icons";
import { Gate } from "../../components/Gate";
import { useRole } from "../../components/RoleContext";

/**
 * One ticket, as a page.
 *
 * The desk used to open a window over the queue holding the thread, the reply
 * box and the member's context — and escalating, resolving or raising anything
 * from inside it opened a second window on top. Answering a ticket is the
 * longest single job in this console, and it was being done in a box with
 * another box's scrim behind it.
 *
 * The ticket has a URL now. The three overlays left are the three that take
 * something typed: an escalation handover, a resolution outcome, and nothing
 * else.
 */

/** The first-reply target by priority. The API is the authority; this mirrors
 *  it so a badge can be drawn before the first response lands. */
const REPLY_TARGET: Record<string, number> = { urgent: 1, high: 4, normal: 12, low: 24 };

/**
 * The first-reply clock, as a badge.
 *
 * Negative is over, anything inside a quarter of the target is the warning. A
 * resolved ticket has no clock, and one that has already been answered shows
 * that it was met rather than a number that keeps ticking.
 */
function Sla({ t }: { t: AdminTicket }) {
  if (t.status === "resolved") return null;
  if (t.answered) return <Badge tone="ok">First reply met</Badge>;
  const target = REPLY_TARGET[t.priority];
  if (t.slaHours < 0) return <Badge tone="bad">{Math.abs(t.slaHours)}h over SLA</Badge>;
  if (t.slaHours <= Math.max(1, target / 4))
    return <Badge tone="warn">{t.slaHours}h to first reply</Badge>;
  return <Badge tone="ok">{t.slaHours}h left</Badge>;
}

function TicketRecord() {
  const id = String(useParams().id ?? "");
  const { role } = useRole();

  const [active, setActive] = useState<AdminTicket | null>(null);
  const [thread, setThread] = useState<AdminTicketMessage[]>([]);
  const [context, setContext] = useState<TicketContext>({ listings: [], cases: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reply, setReply] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [handover, setHandover] = useState("");
  const [outcome, setOutcome] = useState("");
  const [toast, setToast] = useState<{
    title: string;
    body: string;
    tone?: "ok" | "bad";
  } | null>(null);
  const [writes, setWrites] = useState(0);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetchTicket(id)
      .then((r) => {
        if (!alive) return;
        setActive(r.ticket);
        setThread(r.thread);
        setContext(r.context);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, writes]);

  /**
   * Tier 1 gets the ticket and nothing behind it.
   *
   * This is about who is reading, not about which queue the ticket sits in — a
   * Trust and safety ticket opened by a Tier 1 agent must not show the member's
   * history either, and keying this off the ticket rather than the reader was
   * exactly that hole. The API applies the same rule.
   */
  const canSeeContext = role !== "tier-1";
  const up = active ? nextTier(active.tier) : null;

  async function send(alsoResolve: boolean) {
    if (!active || reply.trim().length < 4) return;
    try {
      await replyToTicket(active.id, reply.trim());
      if (alsoResolve) {
        setResolving(true);
        return;
      }
      await setTicketState(active.id, { status: "waiting" });
      setReply("");
      setWrites((n) => n + 1);
      setToast({ title: "Reply sent", body: `${active.subject} · now waiting on the member` });
    } catch (e) {
      setToast({
        title: "Nothing was sent",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
    }
  }

  async function resolve() {
    if (!active) return;
    try {
      if (outcome.trim()) await replyToTicket(active.id, outcome.trim(), true);
      await setTicketState(active.id, { status: "resolved" });
      setResolving(false);
      setOutcome("");
      setReply("");
      setWrites((n) => n + 1);
      setToast({ title: "Resolved", body: `${active.subject} · the outcome is on the record` });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
    }
  }

  async function doEscalate() {
    if (!active || !up) return;
    try {
      await setTicketState(active.id, { tier: up, status: "open" });
      if (handover.trim()) {
        await replyToTicket(
          active.id,
          `Escalated to ${supportTierLabel[up]}. ${handover.trim()}`,
          true,
        );
      }
      setEscalating(false);
      setHandover("");
      setWrites((n) => n + 1);
      setToast({
        title: `Now with ${supportTierLabel[up]}`,
        body: `${active.subject} · it has left your rung unassigned`,
      });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
    }
  }

  const back = { href: "/admin/support", label: "Support" };

  if (error) {
    return (
      <>
        <PageHead title="Ticket" back={back} />
        <Note tone="bad">
          <b>That ticket could not be read.</b> {error}
        </Note>
      </>
    );
  }

  if (loading || !active) {
    return (
      <>
        <PageHead title="Opening…" back={back} />
        <Card>
          <Loading label="Reading the ticket…" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={active.subject}
        sub={`${active.category} · opened ${shortDate(active.opened)}`}
        back={back}
        right={
          <div className="gm-row" style={{ gap: 8 }}>
            <TicketBadge status={active.status} />
            <Sla t={active} />
          </div>
        }
      />

      <div className="gm-stack">
        {/* ------------------------------------------- who and where

            The queue row carries the state, the priority and the clock. Where
            it sits in the tiers, and who holds it, only matter once the ticket
            is open — so they are here rather than as two more chips on every
            row of the table. */}
        <Card pad>
          <div className="gm-row" style={{ gap: 7, marginBottom: 12 }}>
            <PriorityBadge priority={active.priority} />
            <span className="gm-scope">{supportTierLabel[active.tier]}</span>
            {active.assignee ? (
              <span className="gm-sm gm-muted gm-spacer">Assigned to {active.assignee}</span>
            ) : (
              <button
                type="button"
                className="gm-btn gm-btn--sm gm-btn--gold gm-spacer"
                onClick={async () => {
                  await setTicketState(active.id, { assign: true }).catch(() => null);
                  setWrites((n) => n + 1);
                }}
              >
                Assign to me
              </button>
            )}
          </div>
          <div className="gm-row" style={{ gap: 11, flexWrap: "nowrap" }}>
            <div className="gm-cell2" style={{ flex: "1 1 auto" }}>
              <b>{active.member.name}</b>
              <span>
                {active.member.handle} · {active.member.role.replace("-", " & ")}
              </span>
            </div>
            <Link
              className="gm-btn gm-btn--sm"
              href={`/admin/members?scope=market&q=${encodeURIComponent(active.member.handle)}`}
            >
              <IconUsers />
              Member record
            </Link>
          </div>
        </Card>

        {/* --------------------------------------------- conversation */}
        <Card>
          <CardHead
            title="Conversation"
            sub={`${thread.length} message${thread.length === 1 ? "" : "s"}`}
          />
          <CardBody>
            <div className="gm-thread">
              {thread.map((m) =>
                m.from === "system" ? (
                  <div key={m.id} className="gm-feed-time" style={{ textAlign: "center" }}>
                    {m.body}
                  </div>
                ) : (
                  <div key={m.id} className={`gm-msg${m.from === "admin" ? " gm-msg--out" : ""}`}>
                    <div style={{ minWidth: 0 }}>
                      {/* An internal note is on the same thread but is never
                          sent to the member, so it has to be unmistakable from
                          a reply that was. */}
                      <div className="gm-msg-bubble">
                        {m.internal ? (
                          <>
                            <b className="gm-tiny">Internal note · not sent</b>
                            <br />
                          </>
                        ) : null}
                        {m.body}
                      </div>
                      <div className="gm-msg-meta">
                        {m.author} · {shortDate(m.at)}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </CardBody>
        </Card>

        {/* ---------------------------------------------------- reply */}
        {active.status === "resolved" ? (
          <Note>
            <b>This ticket is resolved.</b> A reply from the member reopens it with the thread
            intact.
          </Note>
        ) : (
          <Card>
            <CardHead
              title="Reply"
              sub="The member sees this exactly as written."
              right={
                <span className="gm-tiny gm-dim">
                  <span className="gm-kbd">⌘</span> <span className="gm-kbd">↵</span> to send
                </span>
              }
            />
            <CardBody>
              <div className="gm-row" style={{ gap: 6, marginBottom: 11 }}>
                {cannedReplies.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="gm-btn gm-btn--sm gm-btn--ghost"
                    title={c.when}
                    /* Appends rather than replaces: an agent who has already
                       typed something specific should not lose it to a
                       template. */
                    onClick={() =>
                      setReply((r) => (r.trim() ? `${r.trimEnd()}\n\n${c.body}` : c.body))
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea
                className="gm-textarea"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void send(false);
                  }
                }}
                placeholder="Answer the question that was actually asked, and say what happens next."
                style={{ minHeight: 116 }}
              />
              <span className="gm-hint">
                Sending moves the ticket to waiting. The buttons are at the foot of this page.
              </span>
            </CardBody>
          </Card>
        )}

        {/* ------------------------------------------- member context

            The agent should not have to leave the ticket to find out who they
            are talking to. Tier 1 does not get this panel — their scope is
            their own queue, and the role table says so.
        */}
        {canSeeContext ? (
          <Card>
            <CardHead title="Member context" sub="For this ticket only" />
            <CardBody>
              {/* Their listings, from the store. The plan, verification and
                  strike count that used to sit above this came from a fixture;
                  the console does not invent them. */}
              <div>
                <div className="gm-label" style={{ marginBottom: 7 }}>
                  Listings ({context.listings.length})
                </div>
                {context.listings.length === 0 ? (
                  <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                    Nothing in the queue or on the market.
                  </p>
                ) : (
                  <div className="gm-feed">
                    {context.listings.map((l) => (
                      <div key={l.id} className="gm-feed-item">
                        <span className="gm-feed-ico gm-feed-ico--gold">
                          <IconCard />
                        </span>
                        <div className="gm-feed-body">
                          <p>
                            <b>{l.card}</b>
                          </p>
                          <div className="gm-feed-time">
                            {l.grader ?? "Raw"} {l.grade ?? ""} · {money(l.price)} · {l.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="gm-label" style={{ marginBottom: 7 }}>
                  Cases ({context.cases.length})
                </div>
                {context.cases.length === 0 ? (
                  <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                    No conduct case on record, raised or received.
                  </p>
                ) : (
                  <div className="gm-feed">
                    {context.cases.map((c) => (
                      <div key={c.id} className="gm-feed-item">
                        <span className="gm-feed-ico gm-feed-ico--warn">
                          <IconAlert />
                        </span>
                        <div className="gm-feed-body">
                          <p>
                            <b>{c.reason}</b>
                          </p>
                          <div className="gm-feed-time">
                            {c.status} · {shortDate(c.at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        ) : (
          <Note>
            Tier 1 sees the ticket, not the member. Escalate if answering it needs the history.
          </Note>
        )}

        <ActionBar
          note={
            active.status !== "resolved" && reply.trim().length < 4
              ? "Write a reply first"
              : undefined
          }
        >
          {active.status === "resolved" ? (
            <span className="gm-sm gm-muted">
              Resolved. A reply from the member reopens it with the thread intact.
            </span>
          ) : (
            <>
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                disabled={reply.trim().length < 4}
                onClick={() => send(false)}
              >
                <IconSend />
                Send reply
              </button>
              <button
                type="button"
                className="gm-btn"
                disabled={reply.trim().length < 4}
                onClick={() => send(true)}
              >
                <IconCheck />
                Send and resolve
              </button>
              {up ? (
                <button
                  type="button"
                  className="gm-btn gm-btn--gold"
                  onClick={() => setEscalating(true)}
                >
                  <IconArrowUp />
                  Escalate to {supportTierLabel[up]}
                </button>
              ) : null}
            </>
          )}
        </ActionBar>
      </div>

      {/* ==================================================== escalate */}
      <Modal
        open={escalating}
        onClose={() => setEscalating(false)}
        title={up ? `Escalate to ${supportTierLabel[up]}` : "Escalate"}
        sub="One rung up. There is no way to hand a ticket sideways to another agent on the same tier."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--gold"
              disabled={handover.trim().length < 10}
              onClick={doEscalate}
            >
              <IconArrowUp />
              Escalate
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--ghost"
              onClick={() => setEscalating(false)}
            >
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Written to the member record</span>
          </>
        }
      >
        {up ? (
          <>
            <Card pad>
              <DL
                rows={[
                  ["Ticket", active.subject],
                  ["From", supportTierLabel[active.tier]],
                  ["To", supportTierLabel[up]],
                  ["They will see", supportTierDetail[up]],
                ]}
              />
            </Card>

            <div className="gm-field">
              <label className="gm-label" htmlFor="gm-handover">
                What the next tier needs to know
              </label>
              <textarea
                id="gm-handover"
                className="gm-textarea"
                value={handover}
                onChange={(e) => setHandover(e.target.value)}
                placeholder="What you have already tried, what the member has said, and what you think it needs."
              />
              <span className="gm-hint">
                At least 10 characters. It leaves your queue unassigned either way.
              </span>
            </div>
          </>
        ) : null}
      </Modal>

      {/* ===================================================== resolve */}
      <Modal
        open={resolving}
        onClose={() => setResolving(false)}
        title="Resolve this ticket"
        sub="The outcome goes on the member's record, not only on the ticket."
        footer={
          <>
            <button type="button" className="gm-btn gm-btn--primary" onClick={resolve}>
              <IconCheck />
              Resolve and file
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--ghost"
              onClick={() => setResolving(false)}
            >
              Go back
            </button>
          </>
        }
      >
        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-outcome">
            Outcome, for the record
          </label>
          <textarea
            id="gm-outcome"
            className="gm-textarea"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What was actually done, and what changed as a result."
          />
          <span className="gm-hint">
            What the next agent reads when the same member writes in again. Reopening keeps the
            thread.
          </span>
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
export default function GatedTicketRecord() {
  return (
    <Gate need="support.read">
      <TicketRecord />
    </Gate>
  );
}
