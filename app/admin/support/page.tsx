"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
/** The first-reply target by priority. The API is the authority; this mirrors
 *  it so a badge can be drawn before the first response lands. */
const REPLY_TARGET: Record<string, number> = { urgent: 1, high: 4, normal: 12, low: 24 };

import {
  cannedReplies,
  money,
  nextTier,
  shortDate,
  supportTierDetail,
  supportTierLabel,
  type SupportTier,
  type TicketStatus,
} from "../lib/data";
import {
  ApiError,
  fetchTicket,
  fetchTickets,
  openTicket,
  replyToTicket,
  setTicketState,
  type AdminTicket,
  type AdminTicketMessage,
  type TicketContext,
} from "../lib/api";
import {
  Badge,
  Card,
  CardBody,
  CardHead,
  DL,
  Empty,
  Modal,
  Note,
  PageHead,
  PriorityBadge,
  PillTabs,
  TicketBadge,
  Toast,
} from "../components/ui";
import {
  IconAlert,
  IconArrowUp,
  IconCard,
  IconCheck,
  IconClock,
  IconInbox,
  IconMail,
  IconSearch,
  IconSend,
  IconSupport,
  IconUsers,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { useRole } from "../components/RoleContext";

type Filter = "all" | TicketStatus;

/**
 * The first-reply clock, as a badge.
 *
 * Same shape and same reading as the listing queue's: negative is over,
 * anything inside a quarter of the target is the warning. A resolved ticket
 * has no clock, and one that has already been answered shows that it was met
 * rather than a number that keeps ticking.
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

/** Tier as a chip. Trust and safety is the one worth spotting from the row. */
function TierChip({ tier }: { tier: SupportTier }) {
  return tier === "trust-safety" ? (
    <Badge tone="bad">{supportTierLabel[tier]}</Badge>
  ) : (
    <span className="gm-scope">{supportTierLabel[tier]}</span>
  );
}

const FILTERS: { key: Filter; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <IconInbox /> },
  { key: "new", label: "New", icon: <IconAlert /> },
  { key: "open", label: "Open", icon: <IconSupport /> },
  { key: "waiting", label: "Waiting", icon: <IconClock /> },
  { key: "resolved", label: "Resolved", icon: <IconCheck /> },
];

/* Linked from the sidebar as `?status=new` and friends. */
const STATUSES = FILTERS.map((f) => f.key as string);

function SupportPage() {
  const params = useSearchParams();
  const wanted = params.get("status");
  const fromUrl = (STATUSES.includes(wanted ?? "") ? wanted : "all") as Filter;

  const [filter, setFilter] = useState<Filter>(fromUrl);
  useEffect(() => setFilter(fromUrl), [fromUrl]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [handover, setHandover] = useState("");
  const [outcome, setOutcome] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [writes, setWrites] = useState(0);
  /* The third intake route from the feature set: an agent raising one on a
     member's behalf, for the calls and emails that never reach in-app help. */
  const [raising, setRaising] = useState(false);
  const [newTicket, setNewTicket] = useState({ memberId: "", subject: "", body: "" });

  const { role } = useRole();

  /* The queue, from the API. */
  const [rows, setRows] = useState<AdminTicket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchTickets("all")
      .then((r) => {
        if (!live) return;
        setRows(r.tickets);
        setCounts(r.counts);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [writes]);

  /**
   * The queue this role actually holds.
   *
   * "Their own queue only" is the line in the roles table that the whole
   * outsourcing argument rests on. The API enforces the capability; this cuts
   * the list to the rung, so a Tier 1 agent has no way to reach a Trust and
   * safety ticket from this page, including by pasting its id into the search
   * box. Each tier sees its own rung and everything below it, because an
   * escalation has to leave the sender's view without vanishing from the
   * history of the person who took it.
   */
  const mine = useMemo(() => {
    if (role === "tier-1") return rows.filter((t) => t.tier === "tier-1");
    if (role === "tier-2") return rows.filter((t) => t.tier !== "trust-safety");
    return rows;
  }, [rows, role]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.member.handle.toLowerCase().includes(q)
      );
    });
  }, [mine, filter, query]);

  const active = list.find((t) => t.id === selectedId) ?? list[0] ?? null;

  /* Anything unanswered and past its target — the number the desk is judged
     on, and the reason the queue is ordered the way it is. */
  const breaching = mine.filter(
    (t) => t.status !== "resolved" && !t.answered && t.slaHours < 0
  ).length;

  /* ------------------------------------------------- the ticket in hand */
  const [thread, setThread] = useState<AdminTicketMessage[]>([]);
  const [context, setContext] = useState<TicketContext>({ listings: [], cases: [] });

  useEffect(() => {
    if (!active) {
      setThread([]);
      setContext({ listings: [], cases: [] });
      return;
    }
    let alive = true;
    fetchTicket(active.id)
      .then((r) => {
        if (!alive) return;
        setThread(r.thread);
        setContext(r.context);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [active?.id, writes]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Tier 1 gets the ticket and nothing behind it.
   *
   * This is about who is reading, not about which queue the ticket sits in —
   * a Trust and safety ticket opened by a Tier 1 agent must not show the
   * member's history either, and keying this off the ticket rather than the
   * reader was exactly that hole. The API applies the same rule.
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
      setToast(`${active.id} · replied`);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
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
      setToast(`${active.id} · resolved`);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function raise() {
    const t = newTicket;
    if (!t.memberId.trim() || t.subject.trim().length < 3 || t.body.trim().length < 3) return;
    try {
      const created = await openTicket({
        memberId: t.memberId.trim(),
        subject: t.subject.trim(),
        body: t.body.trim(),
      });
      setRaising(false);
      setNewTicket({ memberId: "", subject: "", body: "" });
      setSelectedId(created.id);
      setWrites((n) => n + 1);
      setToast(`${created.id} · raised`);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
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
      setToast(`${active.id} · now with ${supportTierLabel[up]}`);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <>
      <PageHead
        title="Support"
        sub="One queue for every member question."
        right={
          /* One button, and it does something. "Claim next unassigned" was a
             second way to do what "Assign to me" already does on the ticket
             itself, and Compose was wired to nothing at all. */
          <button
            type="button"
            className="gm-btn gm-btn--primary"
            onClick={() => setRaising(true)}
          >
            <IconMail />
            Raise a ticket
          </button>
        }
      />

      <div className="gm-stack">
        {loadError ? (
          <Note tone="bad">
            <b>The desk could not be read.</b> {loadError}
          </Note>
        ) : null}

        {breaching > 0 ? (
          <Note tone="bad">
            <b>
              {breaching} ticket{breaching === 1 ? " is" : "s are"} past the first-reply target.
            </b>{" "}
            Answer {breaching === 1 ? "it" : "those"} before picking up anything newer.
          </Note>
        ) : null}

        <div className="gm-row">
          <PillTabs
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => ({ ...f, count: counts[f.key] ?? 0 }))}
          />
          <div className="gm-search gm-spacer" style={{ width: 260 }}>
            <IconSearch />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Subject, ticket id, member…"
              aria-label="Search tickets"
            />
          </div>
        </div>

        <div className="gm-grid gm-grid--pane-wide">
          {/* ------------------------------------------------------- inbox */}
          <Card>
            <CardHead title="Inbox" sub={`${list.length} shown`} />
            <div className="gm-picklist">
              {loading && list.length === 0 ? (
                <Empty icon={<IconInbox />} title="Reading the queue…" />
              ) : list.length === 0 ? (
                <Empty icon={<IconInbox />} title="Nothing here" body="No ticket matches that filter." />
              ) : (
                list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`gm-pick${active?.id === t.id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <div className="gm-pick-main">
                      <div className="gm-pick-top">
                        <b>{t.subject}</b>
                        <span className="gm-pick-time">{shortDate(t.lastReply)}</span>
                      </div>
                      <div className="gm-pick-sub">{t.preview}</div>
                      {/* Four things at most. The tier only appears when it
                          is not the default one, because a chip that reads
                          "Tier 1" on every row is not telling anybody
                          anything. */}
                      <div className="gm-row" style={{ gap: 6, marginTop: 7 }}>
                        <TicketBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
                        {t.tier !== "tier-1" ? <TierChip tier={t.tier} /> : null}
                        <Sla t={t} />
                        {!t.assignee ? <Badge tone="gold">Unassigned</Badge> : null}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* ------------------------------------------------------ thread */}
          {active ? (
            <div className="gm-stack">
              <Card>
                <CardHead
                  title={active.subject}
                  sub={`${active.id} · ${active.category} · opened ${new Date(active.opened).toLocaleDateString(
                    "en-GB",
                    { day: "2-digit", month: "short" }
                  )}`}
                  right={
                    <div className="gm-row" style={{ gap: 7 }}>
                      <TicketBadge status={active.status} />
                      <PriorityBadge priority={active.priority} />
                      <TierChip tier={active.tier} />
                      <Sla t={active} />
                    </div>
                  }
                />
                <CardBody>
                  <div className="gm-row" style={{ gap: 11, flexWrap: "nowrap" }}>
                    <div className="gm-cell2" style={{ flex: "1 1 auto" }}>
                      <b>{active.member.name}</b>
                      <span>
                        {active.member.handle} · {active.member.role.replace("-", " & ")}
                      </span>
                    </div>
                    <a
                      className="gm-btn gm-btn--sm"
                      href={`/admin/members?scope=market&q=${encodeURIComponent(
                        active.member.handle
                      )}`}
                    >
                      <IconUsers />
                      Member record
                    </a>
                  </div>
                </CardBody>
              </Card>

              {/* ------------------------------------------- member context

                  The agent should not have to leave the ticket to find out
                  who they are talking to. Tier 1 does not get this panel —
                  their scope is their own queue, and the role table says so.
              */}
              {canSeeContext ? (
                <Card>
                  <CardHead title="Member context" sub="For this ticket only" />
                  <CardBody>
                    {/* Their listings, from the store. The plan, verification
                        and strike count that used to sit above this came from
                        a fixture; the console does not invent them. */}
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
                                  {l.grader ?? "Raw"} {l.grade ?? ""} · {money(l.price)} ·{" "}
                                  {l.status} · <span className="gm-mono">{l.id}</span>
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
                                  {c.status} · {shortDate(c.at)} ·{" "}
                                  <span className="gm-mono">{c.id}</span>
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
                <p className="gm-sm gm-muted">
                  Tier 1 sees the ticket, not the member. Escalate if answering it needs the
                  history.
                </p>
              )}

              <Card>
                <CardHead
                  title="Conversation"
                  sub={`${thread.length} message${thread.length === 1 ? "" : "s"}`}
                  right={
                    active.assignee ? (
                      <span className="gm-sm gm-muted">Assigned to {active.assignee}</span>
                    ) : (
                      <button
                        type="button"
                        className="gm-btn gm-btn--sm gm-btn--gold"
                        onClick={async () => {
                          await setTicketState(active.id, { assign: true }).catch(() => null);
                          setWrites((n) => n + 1);
                        }}
                      >
                        Assign to me
                      </button>
                    )
                  }
                />
                <CardBody>
                  <div className="gm-thread">
                    {thread.map((m) =>
                      m.from === "system" ? (
                        <div key={m.id} className="gm-feed-time" style={{ textAlign: "center" }}>
                          {m.body}
                        </div>
                      ) : (
                        <div
                          key={m.id}
                          className={`gm-msg${m.from === "admin" ? " gm-msg--out" : ""}`}
                        >
                          <div style={{ minWidth: 0 }}>
                            {/* An internal note is on the same thread but is
                                never sent to the member, so it has to be
                                unmistakable from a reply that was. */}
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
                      )
                    )}
                  </div>
                </CardBody>
              </Card>

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
                        /* Appends rather than replaces: an agent who has
                           already typed something specific should not lose it
                           to a template. */
                        onClick={() =>
                          setReply((r) => (r.trim() ? `${r.trimEnd()}\n\n${c.body}` : c.body))
                        }
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  {/* The header has promised this shortcut since the page
                      was drawn and nothing ever listened for it. */}
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
                  <div className="gm-row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="gm-btn gm-btn--primary"
                      disabled={reply.trim().length < 4 || active.status === "resolved"}
                      onClick={() => send(false)}
                    >
                      <IconSend />
                      Send reply
                    </button>
                    <button
                      type="button"
                      className="gm-btn"
                      disabled={reply.trim().length < 4 || active.status === "resolved"}
                      onClick={() => send(true)}
                    >
                      <IconCheck />
                      Send and resolve
                    </button>
                    {up ? (
                      <button
                        type="button"
                        className="gm-btn gm-btn--gold gm-spacer"
                        onClick={() => setEscalating(true)}
                      >
                        <IconArrowUp />
                        Escalate to {supportTierLabel[up]}
                      </button>
                    ) : null}
                  </div>
                </CardBody>
              </Card>

            </div>
          ) : (
            <Card>
              <Empty
                icon={<IconSupport />}
                title="No ticket selected"
                body="Pick one from the inbox to read the thread."
              />
            </Card>
          )}
        </div>
      </div>

      {/* ==================================================== escalate */}
      <Modal
        open={escalating}
        onClose={() => setEscalating(false)}
        title={active && up ? `Escalate to ${supportTierLabel[up]}` : "Escalate"}
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
        {active && up ? (
          <>
            <Card pad>
              <DL
                rows={[
                  ["Ticket", <span className="gm-mono">{active.id}</span>],
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
        {active ? (
          <>
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
          </>
        ) : null}
      </Modal>

      {/* ======================================================== raise */}
      <Modal
        open={raising}
        onClose={() => setRaising(false)}
        title="Raise a ticket for a member"
        sub="For the calls and emails that never reach in-app help. It lands in Tier 1 like any other."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={
                !newTicket.memberId.trim() ||
                newTicket.subject.trim().length < 3 ||
                newTicket.body.trim().length < 3
              }
              onClick={raise}
            >
              <IconInbox />
              Raise it
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setRaising(false)}>
              Cancel
            </button>
          </>
        }
      >
        <div className="gm-field">
          <label className="gm-label" htmlFor="nt-member">
            Member
          </label>
          <input
            id="nt-member"
            className="gm-input gm-mono"
            value={newTicket.memberId}
            onChange={(e) => setNewTicket((t) => ({ ...t, memberId: e.target.value }))}
            placeholder="u_…"
          />
          <span className="gm-hint">The account id from the member record.</span>
        </div>
        <div className="gm-field">
          <label className="gm-label" htmlFor="nt-subject">
            Subject
          </label>
          <input
            id="nt-subject"
            className="gm-input"
            value={newTicket.subject}
            onChange={(e) => setNewTicket((t) => ({ ...t, subject: e.target.value }))}
            placeholder="What they got in touch about"
          />
        </div>
        <div className="gm-field">
          <label className="gm-label" htmlFor="nt-body">
            What they said
          </label>
          <textarea
            id="nt-body"
            className="gm-textarea"
            value={newTicket.body}
            onChange={(e) => setNewTicket((t) => ({ ...t, body: e.target.value }))}
            placeholder="In their words, so the next agent is not reading your summary of a summary."
          />
        </div>
      </Modal>

      {toast ? <Toast title="Ticket updated" body={toast} onDone={() => setToast(null)} /> : null}
    </>
  );
}

/* `useSearchParams` opts its subtree out of the static shell, so it gets a
   boundary of its own rather than the whole route being client-rendered. */
function SupportRoute() {
  return (
    <Suspense fallback={null}>
      <SupportPage />
    </Suspense>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedSupportRoute() {
  return (
    <Gate need="support.read">
      <SupportRoute />
    </Gate>
  );
}
