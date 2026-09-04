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
  FilterMenu,
  RecordModal,
  TicketBadge,
  Toast,
} from "../components/ui";
import {
  IconAlert,
  IconArrowUp,
  IconCard,
  IconCheck,
  IconEye,
  IconInbox,
  IconMail,
  IconSearch,
  IconSend,
  IconUsers,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { useRole } from "../components/RoleContext";

/**
 * The support desk — one table, and a window over the ticket in hand.
 *
 * This used to be a split pane: a scrolling inbox down the left and the whole
 * ticket — member, context, conversation, reply box — stacked in a column on
 * the right. Both halves were too narrow to do their job. The inbox showed
 * four badges per row and truncated the subject they were about, and the
 * thread read in a 500px column with the reply box below the fold.
 *
 * So the queue is a table across the full width, carrying only what an agent
 * triages on, and everything behind a ticket is in the record window a row
 * opens. Same shape as the listing queue, for the same reason.
 */

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

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "open", label: "Open" },
  { key: "waiting", label: "Waiting" },
  { key: "resolved", label: "Resolved" },
];

/** Loudness, as its own filter. The queue is ordered by the reply clock, so
 *  "show me the urgent ones" was previously a thing you did by reading. */
const PRIORITIES: { key: string; label: string }[] = [
  { key: "all", label: "Any priority" },
  { key: "urgent", label: "Urgent" },
  { key: "high", label: "High" },
  { key: "normal", label: "Normal" },
  { key: "low", label: "Low" },
];

/* Linked from the sidebar as `?status=new` and friends. */
const STATUSES = FILTERS.map((f) => f.key as string);

function SupportPage() {
  const params = useSearchParams();
  const wanted = params.get("status");
  const fromUrl = (STATUSES.includes(wanted ?? "") ? wanted : "all") as Filter;

  const [filter, setFilter] = useState<Filter>(fromUrl);
  useEffect(() => setFilter(fromUrl), [fromUrl]);
  const [priority, setPriority] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
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
      if (priority !== "all" && t.priority !== priority) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.member.handle.toLowerCase().includes(q)
      );
    });
  }, [mine, filter, priority, query]);

  /* Anything unanswered and past its target — the number the desk is judged
     on, and the reason the queue is ordered the way it is. */
  const breaching = mine.filter(
    (t) => t.status !== "resolved" && !t.answered && t.slaHours < 0
  ).length;

  /* ------------------------------------------------- the ticket in hand

     Read by id from the API rather than lifted out of the list: the row
     carries what a row needs, and the record needs the conversation and what
     else the member has going on as well. It is also the authority on the
     ticket's own state after a write, so the badges in the window cannot
     disagree with what just happened to it. */
  const [record, setRecord] = useState<AdminTicket | null>(null);
  const [thread, setThread] = useState<AdminTicketMessage[]>([]);
  const [context, setContext] = useState<TicketContext>({ listings: [], cases: [] });
  const [recordError, setRecordError] = useState<string | null>(null);

  useEffect(() => {
    if (!openId) {
      setRecord(null);
      setThread([]);
      setContext({ listings: [], cases: [] });
      setRecordError(null);
      return;
    }
    let alive = true;
    setRecordError(null);
    fetchTicket(openId)
      .then((r) => {
        if (!alive) return;
        setRecord(r.ticket);
        setThread(r.thread);
        setContext(r.context);
      })
      .catch((e) => {
        if (alive) setRecordError(e instanceof ApiError ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [openId, writes]);

  const active = record;

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

  function openRow(id: string) {
    setReply("");
    setOpenId(id);
  }

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
      setWrites((n) => n + 1);
      openRow(created.id);
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
      /* It has left this agent's rung, so the window over it closes with it.
         Leaving the record open on a ticket the queue behind it no longer
         lists is how an agent carries on typing into somebody else's work. */
      setOpenId(null);
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

        {/* ------------------------------------------------------- the queue */}
        <Card>
          {/* One filter language, the same as the listing queue and the case
              board: the heading names what is shown, its subtitle spells out
              what is applied, and the control sits beside it. A row of five
              pills above the card said the state was the only thing you could
              filter on, which is why priority had nowhere to live. */}
          <CardHead
            title="Tickets"
            sub={
              loading && rows.length === 0
                ? "Reading the queue…"
                : `${FILTERS.find((f) => f.key === filter)!.label} · ${list.length} shown${
                    priority === "all" ? "" : ` · ${priority} priority`
                  }`
            }
            right={
              <div className="gm-row" style={{ gap: 8 }}>
                <div className="gm-search" style={{ width: 224 }}>
                  <IconSearch />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Subject, ticket id, member…"
                    aria-label="Search tickets"
                  />
                </div>
                <FilterMenu
                  applied={(filter === "all" ? 0 : 1) + (priority === "all" ? 0 : 1)}
                  onClear={() => {
                    setFilter("all");
                    setPriority("all");
                  }}
                  groups={[
                    {
                      key: "status",
                      label: "Ticket state",
                      value: filter,
                      onChange: (v) => setFilter(v as Filter),
                      options: FILTERS.map((f) => ({
                        value: f.key,
                        label: f.label,
                        count: counts[f.key] ?? 0,
                      })),
                    },
                    {
                      key: "priority",
                      label: "Priority",
                      value: priority,
                      onChange: setPriority,
                      options: PRIORITIES.map((p) => ({ value: p.key, label: p.label })),
                    },
                  ]}
                />
              </div>
            }
          />

          {/* Loading and empty are different answers and must not share a
              screen: "Nothing matches that filter" while the request is still
              in flight tells an agent their filter is wrong when it is not. */}
          {loading && rows.length === 0 ? (
            <Empty icon={<IconInbox />} title="Reading the queue…" />
          ) : list.length === 0 ? (
            <Empty
              icon={<IconInbox />}
              title="Nothing here"
              body="No ticket matches that filter or search."
            />
          ) : (
            <div className="gm-tablewrap">
              {/* Seven columns, and the ticket itself is the wide one.

                  What a row carries is what an agent picks the next ticket
                  on: what it is about, who wrote in, where it is, how loud it
                  is, whose rung it is on, and how long they have been
                  waiting. Everything else — the conversation, the member's
                  listings, their cases, the reply box — is behind the row,
                  because none of it can be read at row height anyway. */}
              <table className="gm-table" style={{ minWidth: 1040 }}>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Member</th>
                    <th>State</th>
                    <th>Priority</th>
                    <th>Tier</th>
                    <th>First reply</th>
                    <th className="gm-rowend">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="gm-cell2">
                          <b>{t.subject}</b>
                          <span>
                            <span className="gm-mono">{t.id}</span> · {t.category}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="gm-cell2">
                          <b>{t.member.handle}</b>
                          <span>{t.member.role.replace("-", " & ")}</span>
                        </div>
                      </td>
                      <td>
                        <TicketBadge status={t.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td>
                        <TierChip tier={t.tier} />
                      </td>
                      <td>
                        <Sla t={t} />
                        <div className="gm-tiny gm-dim" style={{ marginTop: 3 }}>
                          {/* Which time this is has to be said. "2 days ago"
                              on a resolved ticket and on one nobody has
                              touched are opposite facts. */}
                          {t.answered || t.status === "resolved"
                            ? `Last reply ${shortDate(t.lastReply)}`
                            : `Opened ${shortDate(t.opened)}`}
                          {t.assignee ? ` · ${t.assignee}` : " · unassigned"}
                        </div>
                      </td>
                      <td className="gm-rowend">
                        <div className="gm-rowact">
                          <button
                            type="button"
                            className="gm-btn gm-btn--sm"
                            onClick={() => openRow(t.id)}
                          >
                            <IconEye />
                            {t.status === "resolved" ? "Open" : "Answer"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ===================================================== the record */}
      <RecordModal
        open={!!openId}
        onClose={() => setOpenId(null)}
        title={active ? active.subject : "Opening…"}
        sub={
          active
            ? `${active.id} · ${active.category} · opened ${new Date(active.opened).toLocaleDateString(
                "en-GB",
                { day: "2-digit", month: "short" },
              )}`
            : (openId ?? "")
        }
        footer={
          active ? (
            active.status === "resolved" ? (
              <span className="gm-sm gm-muted">
                This ticket is resolved. A reply from the member reopens it with the thread
                intact.
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
                    className="gm-btn gm-btn--gold gm-spacer"
                    onClick={() => setEscalating(true)}
                  >
                    <IconArrowUp />
                    Escalate to {supportTierLabel[up]}
                  </button>
                ) : null}
              </>
            )
          ) : null
        }
      >
        {recordError ? (
          <Note tone="bad">
            <b>That ticket could not be read.</b> {recordError}
          </Note>
        ) : !active ? (
          <p className="gm-sm gm-muted" style={{ margin: 0 }}>
            Reading the ticket…
          </p>
        ) : (
          <>
            {/* ------------------------------------------- who and where */}
            <Card pad>
              <div className="gm-row" style={{ gap: 7, marginBottom: 12 }}>
                <TicketBadge status={active.status} />
                <PriorityBadge priority={active.priority} />
                <TierChip tier={active.tier} />
                <Sla t={active} />
                {active.assignee ? (
                  <span className="gm-sm gm-muted gm-spacer">
                    Assigned to {active.assignee}
                  </span>
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
                <a
                  className="gm-btn gm-btn--sm"
                  href={`/admin/members?scope=market&q=${encodeURIComponent(
                    active.member.handle,
                  )}`}
                >
                  <IconUsers />
                  Member record
                </a>
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
                    ),
                  )}
                </div>
              </CardBody>
            </Card>

            {/* ---------------------------------------------------- reply */}
            {active.status === "resolved" ? null : (
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
                  <span className="gm-hint">
                    Sending moves the ticket to waiting. The buttons are at the foot of this
                    window.
                  </span>
                </CardBody>
              </Card>
            )}

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
          </>
        )}
      </RecordModal>

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
