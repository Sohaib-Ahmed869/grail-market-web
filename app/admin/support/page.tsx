"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  cannedReplies,
  tickets,
  type Ticket,
  type TicketStatus,
} from "../lib/data";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHead,
  DL,
  Empty,
  Note,
  PageHead,
  PriorityBadge,
  PillTabs,
  TicketBadge,
} from "../components/ui";
import {
  IconAlert,
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconInbox,
  IconMail,
  IconSearch,
  IconSend,
  IconSupport,
  IconUsers,
} from "../components/icons";

type Filter = "all" | TicketStatus;

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
  const [selectedId, setSelectedId] = useState(tickets[0].id);
  const [reply, setReply] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length };
    for (const t of tickets) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.member.handle.toLowerCase().includes(q)
      );
    });
  }, [filter, query]);

  const active: Ticket | undefined = list.find((t) => t.id === selectedId) ?? list[0];

  return (
    <>
      <PageHead
        title="Support"
        sub="One queue for every member question. A ticket that touches a conflict or a verification links straight to it."
        right={
          <>
            <button type="button" className="gm-btn">
              <IconMail />
              Compose
            </button>
            <button type="button" className="gm-btn gm-btn--primary">
              <IconInbox />
              Claim next unassigned
            </button>
          </>
        }
      />

      <div className="gm-stack">
        <p className="gm-row gm-sm gm-muted" style={{ gap: 14, margin: 0 }}>
          <span>
            <b className="gm-strong">{counts.new ?? 0}</b> new · {counts.open ?? 0} open
          </span>
          <span>
            Median first reply <b className="gm-strong">1h 48m</b>
          </span>
          <span className="gm-dim">61 resolved this week · 94% satisfaction</span>
        </p>

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
              {list.length === 0 ? (
                <Empty icon={<IconInbox />} title="Nothing here" body="No ticket matches that filter." />
              ) : (
                list.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`gm-pick${active?.id === t.id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <Avatar initials={t.member.initials} size="sm" />
                    <div className="gm-pick-main">
                      <div className="gm-pick-top">
                        <b>{t.subject}</b>
                        <span className="gm-pick-time">{t.lastReply}</span>
                      </div>
                      <div className="gm-pick-sub">{t.preview}</div>
                      <div className="gm-row" style={{ gap: 6, marginTop: 7 }}>
                        <TicketBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
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
                    </div>
                  }
                />
                <CardBody>
                  <div className="gm-row" style={{ gap: 11, flexWrap: "nowrap" }}>
                    <Avatar initials={active.member.initials} />
                    <div className="gm-cell2" style={{ flex: "1 1 auto" }}>
                      <b>{active.member.name}</b>
                      <span>
                        {active.member.handle} · {active.member.role.replace("-", " & ")}
                      </span>
                    </div>
                    <a className="gm-btn gm-btn--sm" href="/admin/members?scope=market">
                      <IconUsers />
                      Member record
                    </a>
                  </div>
                </CardBody>
              </Card>

              {active.priority === "urgent" && active.status !== "resolved" ? (
                <Note tone="bad">
                  <b>Marked urgent.</b> Money or trust-and-safety is involved. First reply target is
                  one hour.
                </Note>
              ) : null}

              <Card>
                <CardHead
                  title="Conversation"
                  sub={`${active.thread.length} message${active.thread.length === 1 ? "" : "s"}`}
                  right={
                    active.assignee ? (
                      <span className="gm-sm gm-muted">Assigned to {active.assignee}</span>
                    ) : (
                      <button type="button" className="gm-btn gm-btn--sm gm-btn--gold">
                        Assign to me
                      </button>
                    )
                  }
                />
                <CardBody>
                  <div className="gm-thread">
                    {active.thread.map((m, i) => (
                      <div key={i} className={`gm-msg${m.from === "admin" ? " gm-msg--out" : ""}`}>
                        <Avatar
                          initials={m.author
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")}
                          size="sm"
                          gold={m.from === "admin"}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="gm-msg-bubble">{m.text}</div>
                          <div className="gm-msg-meta">
                            {m.author} · {m.at}
                          </div>
                        </div>
                      </div>
                    ))}
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
                        onClick={() =>
                          setReply((r) => (r ? r : `[${c.label}] `))
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
                    placeholder="Answer the question that was actually asked, and say what happens next."
                    style={{ minHeight: 116 }}
                  />
                  <div className="gm-row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="gm-btn gm-btn--primary"
                      disabled={reply.trim().length < 4}
                      onClick={() => setReply("")}
                    >
                      <IconSend />
                      Send reply
                    </button>
                    <button type="button" className="gm-btn">
                      <IconCheck />
                      Send and resolve
                    </button>
                    <button type="button" className="gm-btn gm-btn--gold gm-spacer">
                      <IconAlert />
                      Escalate
                    </button>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Ticket detail" />
                <CardBody>
                  <DL
                    rows={[
                      ["Ticket", <span className="gm-mono">{active.id}</span>],
                      ["Category", active.category],
                      ["Priority", <PriorityBadge priority={active.priority} />],
                      ["Status", <TicketBadge status={active.status} />],
                      ["Assignee", active.assignee ?? "Unassigned"],
                      ["Last reply", active.lastReply],
                    ]}
                  />
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
    </>
  );
}

/* `useSearchParams` opts its subtree out of the static shell, so it gets a
   boundary of its own rather than the whole route being client-rendered. */
export default function SupportRoute() {
  return (
    <Suspense fallback={null}>
      <SupportPage />
    </Suspense>
  );
}
