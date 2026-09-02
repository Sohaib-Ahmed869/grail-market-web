"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  dateOnly,
  members,
  money,
  revokeReasons,
  staff,
  type Member,
  type Staff,
} from "../lib/data";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHead,
  DL,
  Drawer,
  Empty,
  MemberBadge,
  Modal,
  Note,
  PageHead,
  Rating,
  Select,
  FilterField,
  Toast,
  Toggle,
} from "../components/ui";
import {
  IconBan,
  IconCalendar,
  IconCheck,
  IconClock,
  IconExternal,
  IconLock,
  IconMail,
  IconPin,
  IconScale,
  IconShield,
  IconUsers,
} from "../components/icons";

type Scope = "team" | "market";
type Action = "revoke" | "restrict" | "reinstate" | "suspend";

const ACTION_COPY: Record<Action, { title: string; sub: string; cta: string; cls: string }> = {
  revoke: {
    title: "Revoke marketplace access",
    sub: "The member is signed out everywhere and cannot buy, sell or bid.",
    cta: "Revoke access",
    cls: "gm-btn--danger",
  },
  restrict: {
    title: "Restrict this member",
    sub: "Selling and listing are paused. Buying and browsing continue.",
    cta: "Apply restriction",
    cls: "gm-btn--gold",
  },
  reinstate: {
    title: "Reinstate this member",
    sub: "Full access is returned. The strike record stays on file.",
    cta: "Reinstate",
    cls: "gm-btn--primary",
  },
  suspend: {
    title: "Suspend this admin account",
    sub: "Their sessions end and every scope is withdrawn until a lead restores it.",
    cta: "Suspend account",
    cls: "gm-btn--danger",
  },
};

const ROLE_LABEL: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  "buyer-seller": "Buyer & seller",
  consignor: "Consignor",
};

/** The two directories this page holds, and how each one introduces itself. */
const DIRECTORY: Record<Scope, { title: string; sub: string }> = {
  team: {
    title: "Admin team",
    sub: "The accounts that run this console, what each one can reach, and what it has decided.",
  },
  market: {
    title: "Members",
    sub: "Everyone trading on the marketplace — their standing, their history, and the levers that change it.",
  },
};

function MembersPage() {
  /* Which directory you are in is the sidebar's business, not a control on
     the page: the two rows in the nav are the switch, and a second switch
     here only asked the same question twice. `?scope=market` from the nav;
     anything else, including a bare link, is the team. */
  const params = useSearchParams();
  const scope: Scope = params.get("scope") === "market" ? "market" : "team";

  /* team filters */
  const [teamRole, setTeamRole] = useState("all");
  const [teamScope, setTeamScope] = useState("all");
  const [teamStatus, setTeamStatus] = useState("all");

  /* marketplace filters */
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [country, setCountry] = useState("all");
  const [query, setQuery] = useState("");

  const [openMember, setOpenMember] = useState<Member | null>(null);
  const [openStaff, setOpenStaff] = useState<Staff | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reasonKey, setReasonKey] = useState(revokeReasons[0]);
  const [reasonNote, setReasonNote] = useState("");
  const [freezeListings, setFreezeListings] = useState(true);
  const [holdPayouts, setHoldPayouts] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const teamRows = useMemo(
    () =>
      staff.filter((p) => {
        if (teamRole !== "all" && p.title !== teamRole) return false;
        if (teamScope !== "all" && !p.scopes.includes(teamScope)) return false;
        if (teamStatus !== "all" && p.status !== teamStatus) return false;
        return true;
      }),
    [teamRole, teamScope, teamStatus]
  );

  const marketRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (role !== "all" && m.role !== role) return false;
      if (country !== "all" && m.country !== country) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.handle.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    });
  }, [status, role, country, query]);

  const countries = useMemo(
    () => Array.from(new Set(members.map((m) => m.country))).sort(),
    []
  );
  const titles = useMemo(() => Array.from(new Set(staff.map((p) => p.title))).sort(), []);

  function startAction(a: Action) {
    setReasonKey(revokeReasons[0]);
    setReasonNote("");
    setAction(a);
  }

  const target = openStaff?.name ?? openMember?.handle ?? "";

  return (
    <>
      <PageHead
        title={DIRECTORY[scope].title}
        sub={DIRECTORY[scope].sub}
        right={
          scope === "market" ? (
            <button type="button" className="gm-btn">
              <IconMail />
              Message selected
            </button>
          ) : (
            /* Staff accounts are provisioned in the backend, not invited from
               here — the settings page says so, and a button that cannot do
               it would say otherwise. */
            <span className="gm-badge gm-badge--gold gm-badge--nodot">
              <IconLock style={{ width: 12, height: 12 }} />
              Backend-provisioned
            </span>
          )
        }
      />

      <div className="gm-stack">
        {/* The count and the shape of the list, in one line — the same
            summary the listing queue opens with. */}
        <p className="gm-row gm-sm gm-muted" style={{ gap: 14, margin: 0 }}>
          {scope === "team" ? (
            <>
              <span>
                <b className="gm-strong">{teamRows.length}</b> of {staff.length} accounts
              </span>
              <span>{staff.filter((p) => p.status === "active").length} active</span>
              <span className="gm-dim">{staff.filter((p) => p.lead).length} lead</span>
            </>
          ) : (
            <>
              <span>
                <b className="gm-strong">{marketRows.length}</b> of {members.length} records
              </span>
              <span>{members.filter((m) => m.status === "restricted").length} restricted</span>
              <span className="gm-dim">
                {members.filter((m) => m.status === "revoked").length} revoked
              </span>
            </>
          )}
        </p>

        {/* ================================================== admin team */}
        {scope === "team" ? (
          <>
            <div className="gm-filterbar">
              <FilterField label="Role" htmlFor="gm-teamrole">
                <Select
                  id="gm-teamrole"
                  variant="bare"
                  value={teamRole}
                  onChange={setTeamRole}
                  ariaLabel="Filter the team by role"
                  options={[
                    { value: "all", label: "All roles" },
                    ...titles.map((t) => ({ value: t, label: t })),
                  ]}
                />
              </FilterField>
              <FilterField label="Scope" htmlFor="gm-teamscope">
                <Select
                  id="gm-teamscope"
                  variant="bare"
                  value={teamScope}
                  onChange={setTeamScope}
                  ariaLabel="Filter the team by scope"
                  options={[
                    { value: "all", label: "Any scope" },
                    "Verification",
                    "Conflicts",
                    "Members",
                    "Pricing",
                    "Support",
                    "Settings",
                  ]}
                />
              </FilterField>
              <FilterField label="Status" htmlFor="gm-teamstatus">
                <Select
                  id="gm-teamstatus"
                  variant="bare"
                  value={teamStatus}
                  onChange={setTeamStatus}
                  ariaLabel="Filter the team by status"
                  options={[
                    { value: "all", label: "Any status" },
                    { value: "active", label: "Active" },
                    { value: "restricted", label: "Restricted" },
                    { value: "revoked", label: "Revoked" },
                  ]}
                />
              </FilterField>
            </div>

            <div>
              {teamRows.length === 0 ? (
                <Card>
                  <Empty icon={<IconShield />} title="No accounts match that role" />
                </Card>
              ) : (
                <div className="gm-people">
                  {teamRows.map((p) => (
                    <article key={p.id} className="gm-person">
                      <div className="gm-person-top">
                        <Avatar initials={p.initials} gold={p.lead} size="lg" />
                        <div className="gm-person-id">
                          <b>{p.name}</b>
                          <span>{p.title}</span>
                        </div>
                        <Rating value={p.rating} />
                      </div>

                      <div className="gm-person-facts">
                        <span className="gm-person-fact">
                          <IconPin />
                          {p.location}
                        </span>
                        <span className="gm-person-fact">
                          <IconCalendar />
                          On the team since {p.since}
                        </span>
                        <span className="gm-person-fact">
                          <IconScale />
                          {p.decisions.toLocaleString("en-US")} decisions · median{" "}
                          {p.medianDecision}
                        </span>
                      </div>

                      <div className="gm-person-tags">
                        {p.scopes.slice(0, 3).map((sc) => (
                          <span key={sc} className="gm-scope">
                            {sc}
                          </span>
                        ))}
                        {p.scopes.length > 3 ? (
                          <span className="gm-scope">+{p.scopes.length - 3}</span>
                        ) : null}
                      </div>

                      <div className="gm-person-foot">
                        <span className="gm-tiny gm-dim">
                          <IconClock style={{ width: 12, height: 12, verticalAlign: "-2px" }} />{" "}
                          {p.lastActive}
                        </span>
                        <button
                          type="button"
                          className="gm-btn gm-btn--sm gm-btn--primary gm-spacer"
                          onClick={() => setOpenStaff(p)}
                        >
                          View account
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* =========================================== marketplace members */
          <>
            <div className="gm-filterbar">
              <FilterField label="Status" htmlFor="gm-mstatus">
                <Select
                  id="gm-mstatus"
                  variant="bare"
                  value={status}
                  onChange={setStatus}
                  ariaLabel="Filter members by status"
                  options={[
                    { value: "all", label: "Any status" },
                    { value: "active", label: "Active" },
                    { value: "restricted", label: "Restricted" },
                    { value: "revoked", label: "Revoked" },
                    { value: "pending", label: "Pending" },
                  ]}
                />
              </FilterField>
              <FilterField label="Role" htmlFor="gm-mrole">
                <Select
                  id="gm-mrole"
                  variant="bare"
                  value={role}
                  onChange={setRole}
                  ariaLabel="Filter members by role"
                  options={[
                    { value: "all", label: "Any role" },
                    { value: "buyer", label: "Buyer" },
                    { value: "seller", label: "Seller" },
                    { value: "buyer-seller", label: "Buyer & seller" },
                    { value: "consignor", label: "Consignor" },
                  ]}
                />
              </FilterField>
              <FilterField label="Country" htmlFor="gm-mcountry">
                <Select
                  id="gm-mcountry"
                  variant="bare"
                  value={country}
                  onChange={setCountry}
                  ariaLabel="Filter members by country"
                  options={[{ value: "all", label: "Anywhere" }, ...countries]}
                />
              </FilterField>
              <FilterField label="Search" htmlFor="gm-mq">
                <input
                  id="gm-mq"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or handle"
                />
              </FilterField>
            </div>

            <div>
              {marketRows.length === 0 ? (
                <Card>
                  <Empty
                    icon={<IconUsers />}
                    title="No members match"
                    body="Widen a filter or clear the search."
                  />
                </Card>
              ) : (
                <div className="gm-people">
                  {marketRows.map((m) => (
                    <article key={m.id} className="gm-person">
                      <div className="gm-person-top">
                        <Avatar initials={m.initials} gold={m.verifiedSeller} size="lg" />
                        <div className="gm-person-id">
                          <b>{m.name}</b>
                          <span>
                            {m.handle} · {ROLE_LABEL[m.role]}
                          </span>
                        </div>
                        <Rating value={m.rating} />
                      </div>

                      <div className="gm-person-facts">
                        <span className="gm-person-fact">
                          <IconPin />
                          {m.country}
                        </span>
                        <span className="gm-person-fact">
                          <IconCalendar />
                          Member since {dateOnly(m.joined)}
                        </span>
                        <span className="gm-person-fact">
                          <IconUsers />
                          {m.sales} sales · {money(m.volume)} lifetime
                        </span>
                      </div>

                      <div className="gm-person-tags">
                        <MemberBadge status={m.status} />
                        {m.verifiedSeller ? <span className="gm-scope">Verified seller</span> : null}
                        {m.strikes > 0 ? (
                          <Badge tone={m.strikes >= 3 ? "bad" : "warn"}>
                            {m.strikes} strike{m.strikes > 1 ? "s" : ""}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="gm-person-foot">
                        <span className="gm-tiny gm-dim">{m.lastSeen}</span>
                        <button
                          type="button"
                          className="gm-btn gm-btn--sm gm-btn--primary gm-spacer"
                          onClick={() => setOpenMember(m)}
                        >
                          Open record
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ==================================================== staff drawer */}
      <Drawer
        open={!!openStaff}
        onClose={() => setOpenStaff(null)}
        title={openStaff ? openStaff.name : ""}
        sub={openStaff ? `${openStaff.title} · ${openStaff.id}` : ""}
        footer={
          openStaff ? (
            openStaff.status === "active" ? (
              <>
                <button
                  type="button"
                  className="gm-btn gm-btn--danger"
                  onClick={() => startAction("suspend")}
                >
                  <IconBan />
                  Suspend account
                </button>
              </>
            ) : (
              <span className="gm-sm gm-muted">Restricted.</span>
            )
          ) : null
        }
      >
        {openStaff ? (
          <>
            <div className="gm-row" style={{ gap: 13, flexWrap: "nowrap" }}>
              <Avatar initials={openStaff.initials} gold={openStaff.lead} size="lg" />
              <div className="gm-cell2" style={{ flex: "1 1 auto" }}>
                <b style={{ fontSize: 15 }}>{openStaff.name}</b>
                <span>{openStaff.email}</span>
              </div>
              <Rating value={openStaff.rating} />
            </div>

            <Card>
              <CardHead title="Account" />
              <CardBody>
                <DL
                  rows={[
                    ["Admin id", <span className="gm-mono">{openStaff.id}</span>],
                    ["Title", openStaff.title],
                    ["Location", openStaff.location],
                    ["On the team since", openStaff.since],
                    ["Last active", openStaff.lastActive],
                    ["Decisions taken", openStaff.decisions.toLocaleString("en-US")],
                    ["Median time to decide", openStaff.medianDecision],
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead title="Scopes" sub="What this account can reach" />
              <CardBody>
                <div className="gm-person-tags">
                  {openStaff.scopes.map((sc) => (
                    <span key={sc} className="gm-scope">
                      {sc}
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>

          </>
        ) : null}
      </Drawer>

      {/* =================================================== member drawer */}
      <Drawer
        open={!!openMember}
        onClose={() => setOpenMember(null)}
        title={openMember ? openMember.name : ""}
        sub={openMember ? `${openMember.handle} · ${openMember.id}` : ""}
        footer={
          openMember ? (
            openMember.status === "revoked" ? (
              <>
                <button
                  type="button"
                  className="gm-btn gm-btn--primary"
                  onClick={() => startAction("reinstate")}
                >
                  <IconCheck />
                  Reinstate access
                </button>
                <span className="gm-spacer gm-tiny gm-dim">Strike record kept</span>
              </>
            ) : (
              <>
                {openMember.status !== "restricted" ? (
                  <button
                    type="button"
                    className="gm-btn gm-btn--gold"
                    onClick={() => startAction("restrict")}
                  >
                    <IconLock />
                    Restrict selling
                  </button>
                ) : (
                  <button
                    type="button"
                    className="gm-btn gm-btn--primary"
                    onClick={() => startAction("reinstate")}
                  >
                    <IconCheck />
                    Lift restriction
                  </button>
                )}
                <button
                  type="button"
                  className="gm-btn gm-btn--danger gm-spacer"
                  onClick={() => startAction("revoke")}
                >
                  <IconBan />
                  Revoke access
                </button>
              </>
            )
          ) : null
        }
      >
        {openMember ? (
          <>
            <div className="gm-row" style={{ gap: 13, flexWrap: "nowrap" }}>
              <Avatar initials={openMember.initials} gold={openMember.verifiedSeller} size="lg" />
              <div className="gm-cell2" style={{ flex: "1 1 auto" }}>
                <b style={{ fontSize: 15 }}>{openMember.name}</b>
                <span>{openMember.email}</span>
              </div>
              <MemberBadge status={openMember.status} />
            </div>

            {openMember.note ? (
              <Note tone={openMember.status === "revoked" ? "bad" : "warn"}>
                <b>Moderator note.</b> {openMember.note}
              </Note>
            ) : null}

            <Card>
              <CardHead title="Account" />
              <CardBody>
                <DL
                  rows={[
                    ["Member id", <span className="gm-mono">{openMember.id}</span>],
                    ["Role", ROLE_LABEL[openMember.role]],
                    ["Verified seller", openMember.verifiedSeller ? "Yes" : "No"],
                    ["Country", openMember.country],
                    ["Joined", dateOnly(openMember.joined)],
                    ["Last seen", openMember.lastSeen],
                    ["Lifetime volume", money(openMember.volume)],
                    ["Sales · purchases", `${openMember.sales} · ${openMember.purchases}`],
                    [
                      "Strikes",
                      openMember.strikes === 0 ? (
                        <Badge tone="ok">None</Badge>
                      ) : (
                        <Badge tone={openMember.strikes >= 3 ? "bad" : "warn"}>
                          {openMember.strikes} in the last 30 days
                        </Badge>
                      ),
                    ],
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead title="What revoking does" sub="So it is clear before you use it" />
              <CardBody>
                <ul
                  style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 7 }}
                  className="gm-sm gm-muted"
                >
                  <li>Every session ends and sign-in is blocked.</li>
                  <li>Live listings are pulled and open bids cancelled.</li>
                  <li>Pending payouts are held for finance review, not forfeited.</li>
                  <li>Open orders still ship — revocation does not cancel a paid order.</li>
                  <li>The member is emailed the reason recorded at the time.</li>
                </ul>
              </CardBody>
            </Card>

            <div className="gm-row" style={{ gap: 8 }}>
              <button type="button" className="gm-btn gm-btn--sm">
                <IconMail />
                Message
              </button>
              <button type="button" className="gm-btn gm-btn--sm">
                <IconExternal />
                Their listings
              </button>
            </div>
          </>
        ) : null}
      </Drawer>

      {/* ============================================================ modal */}
      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action ? ACTION_COPY[action].title : ""}
        sub={action ? ACTION_COPY[action].sub : ""}
        footer={
          <>
            <button
              type="button"
              className={`gm-btn ${action ? ACTION_COPY[action].cls : ""}`}
              disabled={action !== "reinstate" && reasonNote.trim().length < 10}
              onClick={() => {
                setToast(target);
                setAction(null);
                setOpenMember(null);
                setOpenStaff(null);
              }}
            >
              {action === "revoke" || action === "suspend" ? <IconBan /> : <IconCheck />}
              {action ? ACTION_COPY[action].cta : ""}
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setAction(null)}>
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Written to the audit log</span>
          </>
        }
      >
        <Card pad>
          <div className="gm-row" style={{ gap: 11, flexWrap: "nowrap" }}>
            <Avatar initials={openStaff?.initials ?? openMember?.initials ?? "?"} />
            <div className="gm-cell2">
              <b>{openStaff?.name ?? openMember?.name}</b>
              <span>{openStaff?.title ?? openMember?.handle}</span>
            </div>
          </div>
        </Card>

        {action === "revoke" ? (
          <Note tone="bad">
            <b>{openMember?.handle} loses access immediately.</b> Live listings are pulled and open
            bids cancelled. Any paid order already in flight still has to ship.
          </Note>
        ) : action === "suspend" ? (
          <Note tone="bad">
            <b>Every scope is withdrawn.</b> Work already assigned to this account returns to the
            unclaimed queue. Restoring it is a backend change.
          </Note>
        ) : action === "restrict" ? (
          <Note tone="warn">
            Selling and listing stop. The member keeps browsing and buying, and is told which
            behaviour caused it.
          </Note>
        ) : (
          <Note tone="gold">
            Access returns in full. The strike record and every past action stay on file.
          </Note>
        )}

        {action !== "reinstate" ? (
          <>
            {action === "revoke" || action === "restrict" ? (
              <div className="gm-field">
                <label className="gm-label" htmlFor="gm-reason-key">
                  Reason
                </label>
                <Select
                  id="gm-reason-key"
                  value={reasonKey}
                  onChange={setReasonKey}
                  options={[...revokeReasons]}
                  style={{ width: "100%" }}
                />
              </div>
            ) : null}

            <div className="gm-field">
              <label className="gm-label" htmlFor="gm-reason-note">
                Detail for the record
              </label>
              <textarea
                id="gm-reason-note"
                className="gm-textarea"
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="Case references, dates, what the evidence showed."
              />
              <span className="gm-hint">At least 10 characters.</span>
            </div>

            {action === "revoke" ? (
              <Card pad>
                <div className="gm-setrow">
                  <div className="gm-setrow-main">
                    <b>Pull live listings</b>
                    <span>Remove everything they have on the market right now.</span>
                  </div>
                  <div className="gm-setrow-ctl">
                    <Toggle checked={freezeListings} onChange={setFreezeListings} label="Pull listings" />
                  </div>
                </div>
                <div className="gm-setrow">
                  <div className="gm-setrow-main">
                    <b>Hold pending payouts</b>
                    <span>Funds stay held until finance clears them.</span>
                  </div>
                  <div className="gm-setrow-ctl">
                    <Toggle checked={holdPayouts} onChange={setHoldPayouts} label="Hold payouts" />
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
      </Modal>

      {toast ? (
        <Toast title="Access updated" body={`${toast} · written to the audit log`} onDone={() => setToast(null)} />
      ) : null}
    </>
  );
}

/* `useSearchParams` opts its subtree out of the static shell, so it gets a
   boundary of its own rather than the whole route being client-rendered. */
export default function MembersRoute() {
  return (
    <Suspense fallback={null}>
      <MembersPage />
    </Suspense>
  );
}
