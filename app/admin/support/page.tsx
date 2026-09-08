"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
/** The first-reply target by priority. The API is the authority; this mirrors
 *  it so a badge can be drawn before the first response lands. */
const REPLY_TARGET: Record<string, number> = { urgent: 1, high: 4, normal: 12, low: 24 };

import { type TicketStatus } from "../lib/data";
import { ApiError, fetchTickets, openTicket, type AdminTicket } from "../lib/api";
import {
  Badge,
  Card,
  Empty,
  Modal,
  Loading,
  Note,
  PageHead,
  Pagination,
  PriorityBadge,
  FilterMenu,
  Toast,
} from "../components/ui";
import {
  IconEye,
  IconInbox,
  IconMail,
  IconSearch,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { useRole } from "../components/RoleContext";

/**
 * The support desk — one table, and a route per ticket.
 *
 * This used to be a split pane: a scrolling inbox down the left and the whole
 * ticket — member, context, conversation, reply box — stacked in a column on
 * the right. Both halves were too narrow to do their job. The inbox showed
 * four badges per row and truncated the subject they were about, and the
 * thread read in a 500px column with the reply box below the fold.
 *
 * Then it was a table with a window over the ticket, which fixed the width and
 * broke something else: escalating or resolving from inside that window opened
 * a second window on top of the first, so the longest job in this console was
 * being done two overlays deep.
 *
 * So the queue is a table across the full width carrying only what an agent
 * triages on, and the ticket is a page at `/admin/support/<id>` — an address
 * that can be sent to whoever should really be answering it.
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

/** Rows per page. A queue is read a screenful at a time, not scrolled. */
const PAGE_SIZE = 10;

function SupportPage() {
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get("status");
  const fromUrl = (STATUSES.includes(wanted ?? "") ? wanted : "all") as Filter;

  const [filter, setFilter] = useState<Filter>(fromUrl);
  useEffect(() => setFilter(fromUrl), [fromUrl]);
  const [priority, setPriority] = useState("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{
    title: string;
    body: string;
    tone?: "ok" | "bad";
  } | null>(null);
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

  const [page, setPage] = useState(1);
  /* Whichever filter, priority or search brought this set of rows into
     being, page 1 is where it should be read from — carrying a page index
     across a change of filter lands an agent on a page that may no longer
     exist. */
  useEffect(() => setPage(1), [filter, priority, query]);
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* Anything unanswered and past its target — the number the desk is judged
     on, and the reason the queue is ordered the way it is. */
  const breaching = mine.filter(
    (t) => t.status !== "resolved" && !t.answered && t.slaHours < 0
  ).length;

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
      /* Straight onto the ticket that was just raised. It is a page of its
         own now, so this is a navigation rather than opening a window over
         the queue the ticket has only just joined. */
      router.push(`/admin/support/${created.id}`);
    } catch (e) {
      setToast({
        title: "It was not raised",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
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

        {/* The card now holds only the table; the controls that filter it sit
            above it, here, where they read as belonging to the page rather
            than as part of the data underneath them. */}
        <div className="gm-tablebar">
          <span className="gm-tablebar-count">
            {loading && rows.length === 0
              ? "Reading the queue…"
              : `${FILTERS.find((f) => f.key === filter)!.label} · ${list.length} shown${
                  priority === "all" ? "" : ` · ${priority} priority`
                }`}
          </span>
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
        </div>

        {/* ------------------------------------------------------- the queue */}
        <Card>
          {/* Loading and empty are different answers and must not share a
              screen: "Nothing matches that filter" while the request is still
              in flight tells an agent their filter is wrong when it is not. */}
          {loading ? (
            <Loading label="Reading the queue…" />
          ) : list.length === 0 ? (
            <Empty
              icon={<IconInbox />}
              title="Nothing here"
              body="No ticket matches that filter or search."
            />
          ) : (
            <div className="gm-tablewrap">
              {/* Five columns, and two badges a row rather than four.

                  Every row was carrying a state chip, a priority chip, a tier
                  chip and a clock chip, and then a line of small print under
                  the last of them — four coloured pills per row, fifteen rows
                  deep, none of which outranked the others. Colour that is on
                  everything marks nothing.

                  So: the state and the reply clock, which are the two an agent
                  picks the next ticket on, and priority as a chip only when it
                  is loud enough to jump the queue. The tier moved to the
                  ticket itself — which rung a ticket sits on is a fact about
                  handling it, not about choosing it, and the queue is already
                  cut to the rungs this agent holds. */}
              <table className="gm-table" style={{ minWidth: 840 }}>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Member</th>
                    <th>Priority</th>
                    <th>First reply</th>
                    <th className="gm-rowend">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="gm-cell2">
                          <b>{t.subject}</b>
                          <span>{t.category}</span>
                        </div>
                      </td>
                      <td>
                        <div className="gm-cell2">
                          <b>{t.member.handle}</b>
                          <span>{t.member.role.replace("-", " & ")}</span>
                        </div>
                      </td>
                      <td>
                        {/* The ticket's state is what the filter above the
                            table already selects and what the "First reply"
                            column implies. How loud a ticket is, is what an
                            agent picks the next one on. */}
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td>
                        {/* The opening time and who holds the ticket live on
                            the ticket's page, so keep this cell to one line to
                            hold the priority chip and reply badge side-by-side. */}
                        <Sla t={t} />
                      </td>
                      <td className="gm-rowend">
                        <div className="gm-rowact">
                          {/* A link, not a button that opens a window over the
                              queue. Answering a ticket is the longest job on
                              this console and it now has a page to do it on. */}
                          <Link className="gm-btn gm-btn--sm" href={`/admin/support/${t.id}`}>
                            <IconEye />
                            {t.status === "resolved" ? "Open" : "Answer"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* A queue that grows past a screenful becomes a scroll with no
              sense of how much is left; the count above answers that. */}
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.length} onPage={setPage} />
        </Card>
      </div>

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
