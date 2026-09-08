"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  can,
  commsTemplates,
  dateOnly,
  LAPSED_DAYS,
  money,
  planLabel,
  roleLabel,
  scopesOf,
  segments,
  verificationLabel,
  type Member,
} from "../lib/data";
import {
  ApiError,
  fetchMembers,
  fetchStaff,
  messageMembers,
  type AdminStaff,
} from "../lib/api";
import { exportCsv } from "../lib/csv";
import { Gate } from "../components/Gate";
import { useRole } from "../components/RoleContext";
import {
  Avatar,
  Badge,
  Card,
  DL,
  Empty,
  MemberBadge,
  Modal,
  Loading,
  Note,
  PageHead,
  Rating,
  Select,
  BlockHead,
  FilterMenu,
  Toast,
  ViewToggle,
} from "../components/ui";
import {
  IconDownload,
  IconEye,
  IconLock,
  IconMail,
  IconSend,
  IconSearch,
  IconShield,
  IconUsers,
} from "../components/icons";

type Scope = "team" | "market";
/** What a console role can reach, in the words the team cards use. */
const TEAM_SCOPES = ["Verification", "Conflicts", "Members", "Pricing", "Support", "Settings"];

const ROLE_LABEL: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  "buyer-seller": "Buyer & seller",
  consignor: "Consignor",
};

/** The two directories this page holds, and how each one introduces itself. */
const DIRECTORY: Record<Scope, { title: string; sub: string }> = {
  team: {
    title: "Admin Team",
    sub: "The accounts that run this console, what each one can reach, and what it has decided.",
  },
  market: {
    title: "Members",
    sub: "Everyone trading on the marketplace: their standing, their history, and the levers that change it.",
  },
};

function MembersPage() {
  /* Which directory you are in is the sidebar's business, not a control on
     the page: the two rows in the nav are the switch, and a second switch
     here only asked the same question twice. `?scope=market` from the nav;
     anything else, including a bare link, is the team. */
  const params = useSearchParams();
  const scope: Scope = params.get("scope") === "market" ? "market" : "team";
  /* Support links straight to a person — `?q=@handle` from the ticket pane —
     so the agent lands on the record rather than on the whole directory. */
  const seededQuery = params.get("q") ?? "";

  /* team filters */
  const [teamRole, setTeamRole] = useState("all");
  const [teamScope, setTeamScope] = useState("all");
  const [teamStatus, setTeamStatus] = useState("all");

  /* marketplace filters — status/role/country are the directory, the four
     below are the segment: plan, verification, activity and a named cohort. */
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [country, setCountry] = useState("all");
  const [plan, setPlanFilter] = useState("all");
  const [verif, setVerif] = useState("all");
  const [activity, setActivity] = useState("all");
  const [segment, setSegment] = useState("all");
  const [query, setQuery] = useState(seededQuery);

  /* The same switch the listing queue carries. One piece of state for both
     directories rather than one each: the scope comes from the sidebar, so
     only ever one of them is on screen, and a moderator who reads people as
     rows reads both of them as rows. */
  const [layout, setLayout] = useState<"table" | "gallery">("table");

  /* "No billing, no ID" is the moderator's line in the roles table, and it
     is a rule about fields on a record they are otherwise allowed to open. */
  const { role: viewerRole, me } = useRole();
  const seeBilling = can(viewerRole, "billing.read");
  const seeId = can(viewerRole, "id.exceptions");
  const canAct = can(viewerRole, "members.act");

  const [toast, setToast] = useState<{
    title: string;
    body: string;
    tone?: "ok" | "bad";
  } | null>(null);

  /* Who a message goes to. Handles, not indexes — the list re-sorts. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [template, setTemplate] = useState(commsTemplates[0].key);
  const [subject, setSubject] = useState(commsTemplates[0].subject);
  const [body, setBody] = useState(commsTemplates[0].body);

  /* Both directories, from the API. The filtering below stays in the client:
     it is instant, it is what a moderator does dozens of times a minute, and
     the row counts here are people rather than events. The search box is the
     one that goes to the database, because a name we have not loaded cannot
     be found by filtering what we have. */
  const [people, setPeople] = useState<Member[]>([]);
  const [team, setTeam] = useState<AdminStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([fetchMembers({}), fetchStaff()])
      .then(([m, t]) => {
        if (!live) return;
        setPeople(m);
        setTeam(t);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  const teamRows = useMemo(
    () =>
      team.filter((p) => {
        if (teamRole !== "all" && p.title !== teamRole) return false;
        if (teamScope !== "all" && !scopesOf(p.role).includes(teamScope)) return false;
        if (teamStatus !== "all" && p.status !== teamStatus) return false;
        return true;
      }),
    [team, teamRole, teamScope, teamStatus]
  );

  const marketRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seg = segments.find((x) => x.key === segment);
    return people.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (role !== "all" && m.role !== role) return false;
      if (country !== "all" && m.country !== country) return false;
      if (plan !== "all" && m.plan !== plan) return false;
      if (verif !== "all" && m.verification !== verif) return false;
      if (activity === "7" && m.lastSeenDays > 7) return false;
      if (activity === "30" && m.lastSeenDays > 30) return false;
      if (activity === "dormant" && m.lastSeenDays < LAPSED_DAYS) return false;
      if (seg && !seg.match(m)) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.handle.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        /* A tag is only worth applying if it is also a way back to the record. */
        m.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, status, role, country, plan, verif, activity, segment, query]);

  /* Selection follows the filter: narrowing the list drops anyone no longer
     in it, so "message selected" can never send to a row you cannot see. */
  const chosen = useMemo(
    () => marketRows.filter((m) => picked.has(m.handle)),
    [marketRows, picked]
  );
  const audience = chosen.length > 0 ? chosen : marketRows;
  const [sending, setSending] = useState(false);

  /**
   * Actually write to them.
   *
   * This used to close the dialog and show a toast. Nothing was sent, and the
   * toast said it had been — the worst shape a control can have, because it
   * looks like it worked. It goes through the API now, and the toast reports
   * what the API says happened rather than what was asked for.
   */
  async function sendToAudience() {
    if (sending || audience.length === 0) return;
    setSending(true);
    try {
      const r = await messageMembers(
        audience.map((m) => m.id),
        subject.trim(),
        body.trim(),
      );
      setComposing(false);
      setPicked(new Set());
      setToast({
        title: `Written to ${r.delivered} of ${r.of}`,
        /* Said apart, because they are different facts. Nobody has a device
           registered in development, so "0 pushed" is the normal answer and
           must not read as a failure. */
        body:
          `${r.delivered} will see it in the app. ` +
          (r.pushed > 0
            ? `${r.pushed} had a device to push to.`
            : "None had a device registered, so none was pushed.") +
          (r.failed > 0 ? ` ${r.failed} could not be written to.` : ""),
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

  function togglePick(handle: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }

  const allPicked = marketRows.length > 0 && marketRows.every((m) => picked.has(m.handle));

  function toggleAll() {
    setPicked(allPicked ? new Set() : new Set(marketRows.map((m) => m.handle)));
  }

  /* What is on, in the words the dropdowns use, so a folded row can still be
     read at a glance and cleared without opening it. */
  /* How many filters are away from their default, per list. The chips this
     replaced existed so a folded-away filter could not be silently on; the
     count in the heading does the same job, and the dot on the button says
     it again without needing a row of its own. */
  const teamApplied =
    (teamRole === "all" ? 0 : 1) + (teamScope === "all" ? 0 : 1) + (teamStatus === "all" ? 0 : 1);

  const marketApplied =
    (status === "all" ? 0 : 1) +
    (role === "all" ? 0 : 1) +
    (plan === "all" ? 0 : 1) +
    (verif === "all" ? 0 : 1) +
    (activity === "all" ? 0 : 1) +
    (segment === "all" ? 0 : 1) +
    (country === "all" ? 0 : 1);

  function clearMarketFilters() {
    setStatus("all");
    setRole("all");
    setPlanFilter("all");
    setVerif("all");
    setActivity("all");
    setSegment("all");
    setCountry("all");
  }

  /* Only real answers. The store holds no country per member yet, so the
     filter offers nothing rather than one option that means "unknown". */
  const countries = useMemo(
    () => Array.from(new Set(people.map((m) => m.country))).filter((c) => c && c !== "Unknown").sort(),
    [people]
  );
  const titles = useMemo(() => Array.from(new Set(team.map((p) => p.title))).sort(), [team]);

  /** Swapping template rewrites the draft, but never a draft you have edited. */
  function pickTemplate(key: string) {
    const t = commsTemplates.find((x) => x.key === key);
    if (!t) return;
    setTemplate(key);
    setSubject(t.subject);
    setBody(t.body);
  }

  return (
    <>
      <PageHead
        title={DIRECTORY[scope].title}
        sub={DIRECTORY[scope].sub}
        right={
          scope === "market" ? (
            <>
            <button
              type="button"
              className="gm-btn"
              onClick={() =>
                exportCsv("grailmarket-members", marketRows, [
                  { header: "Member", value: (m) => m.id },
                  { header: "Handle", value: (m) => m.handle },
                  { header: "Name", value: (m) => m.name },
                  { header: "Email", value: (m) => m.email },
                  { header: "Standing", value: (m) => m.status },
                  { header: "Plan", value: (m) => m.plan },
                  { header: "Billing", value: (m) => m.billing },
                  { header: "Verification", value: (m) => m.verification },
                  { header: "Joined", value: (m) => m.joined },
                  { header: "Listings", value: (m) => m.listed },
                  { header: "Live listings", value: (m) => m.liveListings },
                  { header: "Sales", value: (m) => m.sales },
                  { header: "Purchases", value: (m) => m.purchases },
                  { header: "Volume", value: (m) => m.volume },
                  { header: "Rating", value: (m) => m.rating },
                  { header: "Tags", value: (m) => m.tags.join(" ") },
                ])
              }
            >
              <IconDownload />
              Export
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={audience.length === 0}
              onClick={() => setComposing(true)}
            >
              <IconMail />
              {chosen.length > 0
                ? `Message ${chosen.length} selected`
                : `Message this segment (${marketRows.length})`}
            </button>
            </>
          ) : (
            /* Inviting someone, changing what they can reach and revoking
               them all live together under Settings. This directory is for
               reading a colleague's record, so it points there rather than
               carrying a second copy of the same three buttons. */
            /* `Link`, not `<a href>`. A bare anchor is a full page load: the
               whole console boots again and you watch an empty shell assemble
               before the page you asked for appears. It also names the
               section, so it lands on the team rather than on thresholds. */
            <Link className="gm-btn" href="/admin/settings?section=team">
              <IconLock />
              Manage access
            </Link>
          )
        }
      />

      <div className="gm-stack">
        {loadError ? (
          <Note tone="bad">
            <b>The directory could not be read.</b> {loadError}
          </Note>
        ) : null}
        {/* ================================================== admin team */}
        {scope === "team" ? (
          <>
            {/* One filter language, the same as every other page: the heading
                names what is shown, its subtitle spells out what is applied,
                and the control sits beside it. Three bare dropdowns in a bar
                of their own was the last idiom left in the console. */}
            <BlockHead
              title="Admin team"
              sub={
                loading && teamRows.length === 0
                  ? "Reading the team…"
                  : `${teamRows.length} of ${team.length} account${team.length === 1 ? "" : "s"}${
                      teamApplied === 0 ? "" : ` · ${teamApplied} filter${teamApplied === 1 ? "" : "s"}`
                    }`
              }
              right={
                <div className="gm-row" style={{ gap: 8 }}>
                <FilterMenu
                  applied={teamApplied}
                  onClear={() => {
                    setTeamRole("all");
                    setTeamScope("all");
                    setTeamStatus("all");
                  }}
                  groups={[
                    {
                      key: "team-role",
                      label: "Role",
                      value: teamRole,
                      onChange: setTeamRole,
                      options: [
                        { value: "all", label: "All roles" },
                        ...titles.map((t) => ({
                          value: t,
                          label: t,
                          count: team.filter((x) => x.title === t).length,
                        })),
                      ],
                    },
                    {
                      key: "team-scope",
                      label: "Scope",
                      value: teamScope,
                      onChange: setTeamScope,
                      options: [
                        { value: "all", label: "Any scope" },
                        ...TEAM_SCOPES.map((x) => ({ value: x, label: x })),
                      ],
                    },
                    {
                      key: "team-status",
                      label: "Status",
                      value: teamStatus,
                      onChange: setTeamStatus,
                      options: [
                        { value: "all", label: "Any status" },
                        { value: "active", label: "Active" },
                        { value: "restricted", label: "Restricted" },
                        { value: "revoked", label: "Revoked" },
                      ],
                    },
                  ]}
                />
                <ViewToggle value={layout} onChange={setLayout} />
                </div>
              }
            />

            <div>
              {loading && teamRows.length === 0 ? (
                <Card>
                  <Loading label="Reading the team…" />
                </Card>
              ) : teamRows.length === 0 ? (
                <Card>
                  <Empty icon={<IconShield />} title="No accounts match that role" />
                </Card>
              ) : layout === "table" ? (
                <Card>
                  <div className="gm-tablewrap">
                    {/* Four columns and a button. Who the account is, what it
                        holds, whether it still works and when it was given —
                        the scopes the role carries and who granted it are on
                        the record, which is one click from every row. */}
                    <table className="gm-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Role</th>
                          <th>Standing</th>
                          <th>Since</th>
                          <th className="gm-rowend">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamRows.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div className="gm-cell-user">
                                <Avatar initials={p.initials} size="sm" />
                                <div className="gm-cell2">
                                  <b>{p.name}</b>
                                  <span>{p.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="gm-sm gm-muted gm-nowrap">{roleLabel(p.role)}</td>
                            <td>
                              <MemberBadge status={p.status} />
                            </td>
                            <td className="gm-sm gm-muted gm-nowrap">{dateOnly(p.since)}</td>
                            <td className="gm-rowend">
                              <div className="gm-rowact">
                                {/* A link, because the record is a page with
                                    an address of its own — the same one the
                                    card's button goes to. */}
                                <Link
                                  className="gm-btn gm-btn--sm gm-btn--icon"
                                  href={`/admin/members/${p.id}?scope=team`}
                                  title="View account"
                                  aria-label={`View ${p.name}`}
                                >
                                  <IconEye />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <>
                <div className="gm-people">
                  {teamRows.map((p) => (
                    <article key={p.id} className="gm-person">
                      <div className="gm-person-top">
                        <div className="gm-person-id">
                          <b>{p.name}</b>
                          <span>{p.title}</span>
                        </div>
                        <MemberBadge status={p.status} />
                      </div>

                      {/* Location, decision counts and a median response time
                          were on this card and none of them exist in the store.
                          What does: the address the account signs in with, when
                          the role was granted, and who granted it. */}
                      <div className="gm-person-facts">
                        <span className="gm-person-fact">{p.email}</span>
                        <span className="gm-person-fact">
                          On the team since {dateOnly(p.since)}
                        </span>
                        {p.grantedBy ? (
                          <span className="gm-person-fact">Scoped by {p.grantedBy}</span>
                        ) : null}
                      </div>

                      {/* Three scopes and a "+2" told neither what the account can
                          reach nor what it cannot. The card already names the role,
                          which is what the scopes are derived from, and the record
                          behind it lists them in full. */}

                      <div className="gm-person-foot">
                        <span className="gm-tiny gm-dim">{roleLabel(p.role)}</span>
                        <Link
                          className="gm-btn gm-btn--sm gm-btn--primary gm-spacer"
                          href={`/admin/members/${p.id}?scope=team`}
                        >
                          View account
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
                </>
              )}
            </div>
          </>
        ) : (
          /* =========================================== marketplace members */
          <>
            {/* One filter language, the same as every other page. This was
                the last of three idioms in the console: a bar of four bare
                dropdowns, a "More filters" fold hiding four more, and a row
                of removable chips underneath to undo what the fold had hidden.
                All eight are groups in one menu now, and the subtitle says how
                many are on — so nothing can be applied without being visible,
                which is what the chips were there to guarantee. */}
            <BlockHead
              title="Marketplace members"
              sub={
                loading && marketRows.length === 0
                  ? "Reading the directory…"
                  : `${marketRows.length} of ${people.length} member${people.length === 1 ? "" : "s"}${
                      marketApplied === 0
                        ? ""
                        : ` · ${marketApplied} filter${marketApplied === 1 ? "" : "s"}`
                    }`
              }
              right={
                <div className="gm-row" style={{ gap: 8 }}>
                  <div className="gm-search" style={{ width: 224 }}>
                    <IconSearch />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Name, handle or tag"
                      aria-label="Search members"
                    />
                  </div>
                  <FilterMenu
                    applied={marketApplied}
                    onClear={clearMarketFilters}
                    groups={[
                      {
                        key: "status",
                        label: "Standing",
                        value: status,
                        onChange: setStatus,
                        options: [
                          { value: "all", label: "Any standing" },
                          { value: "active", label: "Active" },
                          { value: "restricted", label: "Restricted" },
                          { value: "revoked", label: "Revoked" },
                          { value: "pending", label: "Pending" },
                        ],
                      },
                      {
                        key: "role",
                        label: "Role",
                        value: role,
                        onChange: setRole,
                        options: [
                          { value: "all", label: "Any role" },
                          { value: "buyer", label: "Buyer" },
                          { value: "seller", label: "Seller" },
                          { value: "buyer-seller", label: "Buyer & seller" },
                          { value: "consignor", label: "Consignor" },
                        ],
                      },
                      {
                        key: "plan",
                        label: "Plan",
                        value: plan,
                        onChange: setPlanFilter,
                        options: [
                          { value: "all", label: "Any plan" },
                          { value: "dealer", label: "Dealer" },
                          { value: "collector", label: "Collector" },
                          { value: "starter", label: "Starter" },
                          { value: "none", label: "No plan" },
                        ],
                      },
                      {
                        key: "verification",
                        label: "Verification",
                        value: verif,
                        onChange: setVerif,
                        options: [
                          { value: "all", label: "Any level" },
                          { value: "id-verified", label: "ID verified" },
                          { value: "id-submitted", label: "ID submitted" },
                          { value: "mobile", label: "Mobile confirmed" },
                          { value: "none", label: "Unverified" },
                        ],
                      },
                      {
                        key: "activity",
                        label: "Activity",
                        value: activity,
                        onChange: setActivity,
                        options: [
                          { value: "all", label: "Any time" },
                          { value: "7", label: "Seen this week" },
                          { value: "30", label: "Seen this month" },
                          { value: "dormant", label: `Dormant ${LAPSED_DAYS}d+` },
                        ],
                      },
                      {
                        key: "segment",
                        label: "Cohort",
                        value: segment,
                        onChange: setSegment,
                        options: segments.map((x) => ({ value: x.key, label: x.label })),
                      },
                      /* Only offered when the store actually holds one. A
                         country filter with nothing in it is a control that
                         cannot be wrong because it cannot be used. */
                      ...(countries.length > 0
                        ? [
                            {
                              key: "country",
                              label: "Country",
                              value: country,
                              onChange: setCountry,
                              options: [
                                { value: "all", label: "Anywhere" },
                                ...countries.map((c) => ({ value: c, label: c })),
                              ],
                            },
                          ]
                        : []),
                    ]}
                  />
                  <ViewToggle value={layout} onChange={setLayout} />
                </div>
              }
            />

            {/* What the cohort means, and the handle on the whole selection.
                A segment nobody can read the definition of gets used wrong. */}
            <div className="gm-row gm-sm" style={{ gap: 12 }}>
              <label
                className="gm-row gm-sm"
                style={{ gap: 7, cursor: "pointer", flexWrap: "nowrap" }}
              >
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={toggleAll}
                  aria-label="Select every member in this segment"
                  style={{ accentColor: "var(--gold)", width: 15, height: 15 }}
                />
                <span className="gm-muted">
                  {chosen.length > 0 ? `${chosen.length} selected` : "Select all"}
                </span>
              </label>
              {chosen.length > 0 ? (
                <button
                  type="button"
                  className="gm-btn gm-btn--sm gm-btn--ghost"
                  onClick={() => setPicked(new Set())}
                >
                  Clear
                </button>
              ) : null}
              <span className="gm-spacer gm-tiny gm-dim">
                {segments.find((x) => x.key === segment)?.detail}
              </span>
            </div>

            <div>
              {loading && marketRows.length === 0 ? (
                <Card>
                  <Loading label="Reading the directory…" />
                </Card>
              ) : marketRows.length === 0 ? (
                <Card>
                  <Empty
                    icon={<IconUsers />}
                    title="No members match"
                    body="Widen a filter or clear the search."
                  />
                </Card>
              ) : layout === "table" ? (
                <Card>
                  <div className="gm-tablewrap">
                    {/* Five columns, one of which is the tick box the message
                        composer above reads. What a directory is scanned on is
                        who somebody is, whether anything is wrong with them,
                        how much they trade and how recently — the plan, the
                        verification level, the tags and the strike count are on
                        the record, where each of them is a sentence rather than
                        a chip competing with five others. */}
                    <table className="gm-table">
                      <thead>
                        <tr>
                          <th className="gm-pickcol">
                            <input
                              type="checkbox"
                              checked={allPicked}
                              onChange={toggleAll}
                              aria-label="Select every member in this segment"
                              style={{ accentColor: "var(--gold)", width: 15, height: 15 }}
                            />
                          </th>
                          <th>Member</th>
                          <th>Standing</th>
                          <th>Trading</th>
                          <th>Last active</th>
                          <th className="gm-rowend">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketRows.map((m) => (
                          <tr key={m.id}>
                            <td className="gm-pickcol">
                              <input
                                type="checkbox"
                                checked={picked.has(m.handle)}
                                onChange={() => togglePick(m.handle)}
                                aria-label={`Select ${m.handle}`}
                                style={{ accentColor: "var(--gold)", width: 15, height: 15 }}
                              />
                            </td>
                            <td>
                              <div className="gm-cell-user">
                                <Avatar initials={m.initials} size="sm" />
                                <div className="gm-cell2">
                                  <b>{m.name}</b>
                                  <span>
                                    {m.handle} · {ROLE_LABEL[m.role]}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <MemberBadge status={m.status} />
                            </td>
                            <td className="gm-sm gm-muted gm-nowrap">
                              {m.sales} sale{m.sales === 1 ? "" : "s"} · {money(m.volume)}
                            </td>
                            <td className="gm-sm gm-muted gm-nowrap">
                              {m.lastSeenDays === 0 ? "Today" : dateOnly(m.lastSeen)}
                            </td>
                            <td className="gm-rowend">
                              <div className="gm-rowact">
                                <Link
                                  className="gm-btn gm-btn--sm gm-btn--icon"
                                  href={`/admin/members/${m.id}`}
                                  title="Open record"
                                  aria-label={`Open ${m.name}`}
                                >
                                  <IconEye />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <>
                <div className="gm-people">
                  {marketRows.map((m) => {
                    return (
                    <article key={m.id} className="gm-person">
                      <div className="gm-person-top">
                        <input
                          type="checkbox"
                          checked={picked.has(m.handle)}
                          onChange={() => togglePick(m.handle)}
                          aria-label={`Select ${m.handle}`}
                          style={{
                            accentColor: "var(--gold)",
                            width: 15,
                            height: 15,
                            marginRight: 2,
                            flex: "none",
                          }}
                        />
                        <div className="gm-person-id">
                          <b>{m.name}</b>
                          <span>
                            {m.handle} · {ROLE_LABEL[m.role]}
                          </span>
                        </div>
                        <Rating value={m.rating} />
                      </div>

                      <div className="gm-person-facts">
                        {m.country && m.country !== "Unknown" ? (
                          <span className="gm-person-fact">{m.country}</span>
                        ) : null}
                        <span className="gm-person-fact">
                          Member since {dateOnly(m.joined)}
                        </span>
                        <span className="gm-person-fact">
                          {m.sales} sales · {money(m.volume)} lifetime
                        </span>
                        {seeBilling || seeId ? (
                          <span className="gm-person-fact">
                            {[
                              seeBilling ? planLabel[m.plan] : null,
                              seeId ? verificationLabel[m.verification] : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </div>

                      <div className="gm-person-tags">
                        {/* No chip for an active account. Eleven of fifteen rows
                            are active, so saying so on each one was noise;
                            absence means nothing is wrong with it. */}
                        {m.status !== "active" ? <MemberBadge status={m.status} /> : null}
                        {m.verifiedSeller ? <span className="gm-scope">Verified seller</span> : null}
                        {seeBilling && m.billing === "past-due" ? (
                          <Badge tone="warn">Payment failed</Badge>
                        ) : null}
                        {m.lastSeenDays >= LAPSED_DAYS ? <Badge tone="warn">Lapsed</Badge> : null}
                        {m.listed === 0 ? <span className="gm-scope">Never listed</span> : null}
                        {m.strikes > 0 ? (
                          <Badge tone={m.strikes >= 3 ? "bad" : "warn"}>
                            {m.strikes} strike{m.strikes > 1 ? "s" : ""}
                          </Badge>
                        ) : null}
                        {m.tags.map((t) => (
                          <span key={t} className="gm-scope">
                            #{t}
                          </span>
                        ))}
                      </div>

                      <div className="gm-person-foot">
                        {/* Their most recent listing, which is the closest
                            thing the store holds to "last seen" — labelled as
                            activity so nobody reads it as a sign-in. */}
                        <span className="gm-tiny gm-dim">
                          {m.lastSeenDays === 0 ? "Active today" : `Active ${dateOnly(m.lastSeen)}`}
                        </span>
                        {/* A link, not a button that opens a window over the
                            directory. The record is a page with an address of
                            its own now, so it can be sent to a colleague and
                            left with the browser's own back. */}
                        <Link
                          className="gm-btn gm-btn--sm gm-btn--primary gm-spacer"
                          href={`/admin/members/${m.id}`}
                        >
                          Open record
                        </Link>
                      </div>
                    </article>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ========================================================= comms */}
      <Modal
        open={composing}
        onClose={() => setComposing(false)}
        title="Message this segment"
        sub="Push and email. Nothing here reaches a member who has opted out of that channel."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={sending || !subject.trim() || body.trim().length < 10 || audience.length === 0}
              onClick={sendToAudience}
            >
              <IconSend />
              {sending ? "Sending…" : `Send to ${audience.length}`}
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--ghost"
              onClick={() => setComposing(false)}
            >
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Logged against every recipient</span>
          </>
        }
      >
        <Card pad>
          <DL
            rows={[
              [
                "Audience",
                chosen.length > 0
                  ? `${chosen.length} hand-picked`
                  : `${segments.find((x) => x.key === segment)?.label ?? "Everyone"}, ${marketRows.length} matching the current filters`,
              ],
              [
                "Excluded",
                `${people.length - audience.length} not in this segment`,
              ],
            ]}
          />
        </Card>

        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-template">
            Template
          </label>
          <Select
            id="gm-template"
            value={template}
            onChange={pickTemplate}
            options={commsTemplates.map((t) => ({ value: t.key, label: t.label }))}
            style={{ width: "100%" }}
          />
          <span className="gm-hint">
            {commsTemplates.find((t) => t.key === template)?.detail}
          </span>
        </div>

        {/* These were two channel toggles. They controlled nothing — the same
            fault as the send button above them, one level down — so they say
            what happens instead of pretending to choose it. */}
        <Note>
          <b>Where this goes.</b> Every recipient gets it in the app, and a push
          as well wherever they have a device registered. Email is not wired: no
          provider is configured, so nothing here reaches an inbox. The toast
          reports how many of each actually went.
        </Note>

        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-subject">
            Subject
          </label>
          <input
            id="gm-subject"
            className="gm-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-body">
            Message
          </label>
          <textarea
            id="gm-body"
            className="gm-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <span className="gm-hint">
            No card prices or figures in a broadcast. They are out of date by the time it lands.
          </span>
        </div>

        {audience.length > 40 ? (
          <Note tone="warn">
            <b>{audience.length} people.</b> Narrow the segment first if this is a test.
          </Note>
        ) : null}
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
function MembersRoute() {
  return (
    <Suspense fallback={null}>
      <MembersPage />
    </Suspense>
  );
}

/**
 * One route, two directories, two different answers.
 *
 * The member directory is a moderator's tool. The admin roster next to it is
 * the list of who can do what, which is an owner's — so the capability is
 * picked from the scope rather than from the path.
 */
function MembersGate() {
  const params = useSearchParams();
  const team = params.get("scope") !== "market";
  return (
    <Gate need={team ? "team.read" : "members.read"}>
      <MembersRoute />
    </Gate>
  );
}

export default function GatedMembers() {
  return (
    <Suspense fallback={null}>
      <MembersGate />
    </Suspense>
  );
}
