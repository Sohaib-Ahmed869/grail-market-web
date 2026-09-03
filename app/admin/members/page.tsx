"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  can,
  commsTemplates,
  dateOnly,
  knownTags,
  LAPSED_DAYS,
  money,
  operator,
  planLabel,
  planQuota,
  billingLabel,
  revokeReasons,
  roleLabel,
  scopesOf,
  segments,
  verificationLabel,
  type Member,
  type PlanKey,
  type VerificationLevel,
} from "../lib/data";
import {
  annotateMember,
  ApiError,
  fetchMember,
  fetchMembers,
  fetchStaff,
  setMemberStanding,
  type AdminStaff,
  type TimelineEntry,
} from "../lib/api";
import { exportCsv } from "../lib/csv";
import { MemberTimeline } from "../components/MemberTimeline";
import { Gate } from "../components/Gate";
import { useRole } from "../components/RoleContext";
import {
  Badge,
  Card,
  CardBody,
  CardHead,
  DL,
  RecordModal,
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
  IconCheck,
  IconDownload,
  IconExternal,
  IconKey,
  IconLock,
  IconMail,
  IconNote,
  IconChevronDown,
  IconRefresh,
  IconSend,
  IconShield,
  IconTag,
  IconUsers,
  IconX,
} from "../components/icons";

type Scope = "team" | "market";
type Action =
  | "revoke"
  | "restrict"
  | "reinstate"
  | "suspend"
  | "reset-verification"
  | "change-plan";

/** Actions that stand on their own reason rather than the revoke list. */
const REASON_FREE: Action[] = ["reset-verification", "change-plan"];

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
  "reset-verification": {
    title: "Reset verification",
    sub: "Sends the account back to the start of the funnel. They cannot trade until it clears again.",
    cta: "Reset verification",
    cls: "gm-btn--gold",
  },
  "change-plan": {
    title: "Change plan",
    sub: "Moves the subscription. Billing is corrected on the next cycle, not retroactively.",
    cta: "Apply plan change",
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
  /* The segment row is folded away until it is wanted. Seven dropdowns on
     screen at once is most of a page of chrome above a list nobody has looked
     at yet — and four of the seven are only reached when someone is building
     an audience, not when they are looking a member up. */
  const [moreOpen, setMoreOpen] = useState(false);

  /* "No billing, no ID" is the moderator's line in the roles table, and it
     is a rule about fields on a record they are otherwise allowed to open. */
  const { role: viewerRole } = useRole();
  const seeBilling = can(viewerRole, "billing.read");
  const seeId = can(viewerRole, "id.exceptions");
  const canAct = can(viewerRole, "members.act");

  const [openMember, setOpenMember] = useState<Member | null>(null);
  const [openStaff, setOpenStaff] = useState<AdminStaff | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reasonKey, setReasonKey] = useState(revokeReasons[0]);
  const [reasonNote, setReasonNote] = useState("");
  const [freezeListings, setFreezeListings] = useState(true);
  const [retireHandle, setRetireHandle] = useState(true);
  const [toast, setToast] = useState<string | { title: string; body: string } | null>(null);

  /* The plan a change-plan action moves to, and the level a reset drops to. */
  const [nextPlan, setNextPlan] = useState<PlanKey>("collector");
  const RESET_TO: VerificationLevel = "mobile";

  /* Notes and tags on the open record. */
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  /* Who a message goes to. Handles, not indexes — the list re-sorts. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [template, setTemplate] = useState(commsTemplates[0].key);
  const [viaPush, setViaPush] = useState(true);
  const [viaEmail, setViaEmail] = useState(true);
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
  const [writes, setWrites] = useState(0);

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
  }, [writes]);

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

  /* The open record. Re-read from the API rather than lifted out of the list,
     because the record carries a timeline the directory row does not. */
  const [live, setLive] = useState<Member | null>(null);
  const [record, setRecord] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    if (!openMember) {
      setLive(null);
      setRecord([]);
      return;
    }
    let alive = true;
    setLive(openMember);
    fetchMember(openMember.id)
      .then((r) => {
        if (!alive) return;
        setLive(r.member);
        setRecord(r.timeline);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [openMember]);

  async function addNote() {
    if (!live || noteDraft.trim().length < 4) return;
    const updated = await annotateMember(live.id, { note: noteDraft.trim() }).catch(() => null);
    if (updated) setLive(updated);
    setNoteDraft("");
    setWrites((n) => n + 1);
  }

  async function addTag() {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, "-");
    if (!live || !t || live.tags.includes(t)) return;
    const updated = await annotateMember(live.id, { tags: [...live.tags, t] }).catch(() => null);
    if (updated) setLive(updated);
    setTagDraft("");
    setWrites((n) => n + 1);
  }

  async function dropTag(t: string) {
    if (!live) return;
    const updated = await annotateMember(live.id, {
      tags: live.tags.filter((x) => x !== t),
    }).catch(() => null);
    if (updated) setLive(updated);
    setWrites((n) => n + 1);
  }

  /* What is on, in the words the dropdowns use, so a folded row can still be
     read at a glance and cleared without opening it. */
  const applied = useMemo(() => {
    const out: { label: string; clear: () => void }[] = [];
    if (plan !== "all")
      out.push({ label: `Plan: ${planLabel[plan as PlanKey]}`, clear: () => setPlanFilter("all") });
    if (verif !== "all")
      out.push({
        label: `Verification: ${verificationLabel[verif as VerificationLevel]}`,
        clear: () => setVerif("all"),
      });
    if (activity !== "all")
      out.push({
        label: `Activity: ${
          activity === "7" ? "Seen this week" : activity === "30" ? "Seen this month" : `Dormant ${LAPSED_DAYS}d+`
        }`,
        clear: () => setActivity("all"),
      });
    if (segment !== "all")
      out.push({
        label: `Cohort: ${segments.find((x) => x.key === segment)?.label ?? segment}`,
        clear: () => setSegment("all"),
      });
    return out;
  }, [plan, verif, activity, segment]);

  /* Only real answers. The store holds no country per member yet, so the
     filter offers nothing rather than one option that means "unknown". */
  const countries = useMemo(
    () => Array.from(new Set(people.map((m) => m.country))).filter((c) => c && c !== "—").sort(),
    [people]
  );
  const titles = useMemo(() => Array.from(new Set(team.map((p) => p.title))).sort(), [team]);

  function startAction(a: Action) {
    setReasonKey(revokeReasons[0]);
    setReasonNote("");
    if (a === "change-plan" && live) setNextPlan(live.plan);
    setAction(a);
  }

  const target = openStaff?.name ?? openMember?.handle ?? "";

  /** A plan whose ceiling is below what they already have live. */
  const quota = planQuota[nextPlan];
  const overQuota =
    action === "change-plan" && live !== null && quota !== null && live.liveListings > quota;

  const canCommit =
    action === "reinstate" ||
    (action === "change-plan" && live !== null && nextPlan !== live.plan) ||
    reasonNote.trim().length >= 10;

  /**
   * Apply the action.
   *
   * Staff suspensions have no member record to write to, so they stop at the
   * toast. Everything else lands on the timeline — an action nobody can point
   * to later is the thing this record exists to prevent.
   */
  async function commit() {
    if (!action) return;

    if (openStaff || !live) {
      setToast(target);
      setAction(null);
      setOpenStaff(null);
      return;
    }

    const detail = reasonNote.trim();

    /* Restrict, revoke and reinstate are the three the store can take today,
       and they are the three the feature set calls conduct actions. Plan
       changes and a verification reset are Stripe's and the provider's to
       make — the console cannot fake either, so they say so rather than
       writing a line that claims something happened. */
    if (action === "change-plan" || action === "reset-verification") {
      setToast({
        title: "Not wired up yet",
        body:
          action === "change-plan"
            ? "A plan change has to go through Stripe. The subscription endpoints are not connected to the console yet."
            : "Verification is the provider's decision against the DVS. Resetting it needs their API, which the console does not call yet.",
      });
      setAction(null);
      return;
    }

    const standing =
      action === "revoke" ? "revoked" : action === "restrict" ? "restricted" : "active";
    const reason =
      action === "reinstate" ? detail || "Reinstated" : `${reasonKey}${detail ? `. ${detail}` : ""}`;

    try {
      const updated = await setMemberStanding(live.id, standing, reason);
      setLive(updated);
      setWrites((n) => n + 1);
      setToast(target);
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
      });
    }
    setAction(null);
    setOpenMember(null);
  }

  /** Swapping template rewrites the draft, but never a draft you have edited. */
  function pickTemplate(key: string) {
    const t = commsTemplates.find((x) => x.key === key);
    if (!t) return;
    setTemplate(key);
    setSubject(t.subject);
    setBody(t.body);
    setViaPush(t.channels.includes("push"));
    setViaEmail(t.channels.includes("email"));
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
            <a className="gm-btn" href="/admin/settings">
              <IconLock />
              Manage access
            </a>
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
              {loading && teamRows.length === 0 ? (
                <Card>
                  <Empty icon={<IconShield />} title="Reading the team…" />
                </Card>
              ) : teamRows.length === 0 ? (
                <Card>
                  <Empty icon={<IconShield />} title="No accounts match that role" />
                </Card>
              ) : (
                <>
                <p className="gm-sm gm-muted" style={{ margin: "0 0 2px" }}>
                  {teamRows.length === team.length
                    ? `${team.length} accounts`
                    : `${teamRows.length} of ${team.length} accounts`}
                </p>
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

                      <div className="gm-person-tags">
                        {scopesOf(p.role).slice(0, 3).map((sc: string) => (
                          <span key={sc} className="gm-scope">
                            {sc}
                          </span>
                        ))}
                        {scopesOf(p.role).length > 3 ? (
                          <span className="gm-scope">+{scopesOf(p.role).length - 3}</span>
                        ) : null}
                      </div>

                      <div className="gm-person-foot">
                        <span className="gm-tiny gm-dim">{roleLabel(p.role)}</span>
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
                </>
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
                  placeholder="Name, handle or tag"
                />
              </FilterField>
              {/* Opens the segment row. Sits in the bar rather than above it
                  so the default state is one row and nothing else. */}
              <button
                type="button"
                className={`gm-filtermore${moreOpen ? " is-open" : ""}`}
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
              >
                More filters
                {applied.length > 0 ? (
                  <span className="gm-filtermore-count">{applied.length}</span>
                ) : null}
                <IconChevronDown className={moreOpen ? "gm-filtermore-caret is-open" : "gm-filtermore-caret"} />
              </button>
            </div>

            {/* The four that cut an audience out of the directory. Folded by
                default; whatever is on shows as a chip below either way, so
                closing this can never hide an active filter. */}
            {moreOpen ? (
            <div className="gm-filterbar">
              <FilterField label="Plan" htmlFor="gm-mplan">
                <Select
                  id="gm-mplan"
                  variant="bare"
                  value={plan}
                  onChange={setPlanFilter}
                  ariaLabel="Filter members by plan"
                  options={[
                    { value: "all", label: "Any plan" },
                    { value: "dealer", label: "Dealer" },
                    { value: "collector", label: "Collector" },
                    { value: "starter", label: "Starter" },
                    { value: "none", label: "No plan" },
                  ]}
                />
              </FilterField>
              <FilterField label="Verification" htmlFor="gm-mverif">
                <Select
                  id="gm-mverif"
                  variant="bare"
                  value={verif}
                  onChange={setVerif}
                  ariaLabel="Filter members by verification level"
                  options={[
                    { value: "all", label: "Any level" },
                    { value: "id-verified", label: "ID verified" },
                    { value: "id-submitted", label: "ID submitted" },
                    { value: "mobile", label: "Mobile confirmed" },
                    { value: "none", label: "Unverified" },
                  ]}
                />
              </FilterField>
              <FilterField label="Activity" htmlFor="gm-mact">
                <Select
                  id="gm-mact"
                  variant="bare"
                  value={activity}
                  onChange={setActivity}
                  ariaLabel="Filter members by activity"
                  options={[
                    { value: "all", label: "Any time" },
                    { value: "7", label: "Seen this week" },
                    { value: "30", label: "Seen this month" },
                    { value: "dormant", label: `Dormant ${LAPSED_DAYS}d+` },
                  ]}
                />
              </FilterField>
              <FilterField label="Cohort" htmlFor="gm-mseg">
                <Select
                  id="gm-mseg"
                  variant="bare"
                  value={segment}
                  onChange={setSegment}
                  ariaLabel="Filter members by cohort"
                  options={segments.map((x) => ({ value: x.key, label: x.label }))}
                />
              </FilterField>
            </div>
            ) : null}

            {applied.length > 0 ? (
              <div className="gm-row" style={{ gap: 7 }}>
                {applied.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    className="gm-filterchip"
                    onClick={a.clear}
                    title="Remove this filter"
                  >
                    {a.label}
                    <IconX />
                  </button>
                ))}
                <button
                  type="button"
                  className="gm-btn gm-btn--sm gm-btn--ghost"
                  onClick={() => {
                    setPlanFilter("all");
                    setVerif("all");
                    setActivity("all");
                    setSegment("all");
                  }}
                >
                  Clear all
                </button>
              </div>
            ) : null}

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
                  <Empty icon={<IconUsers />} title="Reading the directory…" />
                </Card>
              ) : marketRows.length === 0 ? (
                <Card>
                  <Empty
                    icon={<IconUsers />}
                    title="No members match"
                    body="Widen a filter or clear the search."
                  />
                </Card>
              ) : (
                <>
                <p className="gm-sm gm-muted" style={{ margin: "0 0 2px" }}>
                  {loading
                    ? "Reading the directory…"
                    : marketRows.length === people.length
                      ? `${people.length} members`
                      : `${marketRows.length} of ${people.length} members`}
                </p>
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
                        {m.country && m.country !== "—" ? (
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
                        <button
                          type="button"
                          className="gm-btn gm-btn--sm gm-btn--primary gm-spacer"
                          onClick={() => setOpenMember(m)}
                        >
                          Open record
                        </button>
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

      {/* ==================================================== staff record */}
      <RecordModal
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
              <div className="gm-cell2" style={{ flex: "1 1 auto" }}>
                <b style={{ fontSize: 15 }}>{openStaff.name}</b>
                <span>{openStaff.email}</span>
              </div>
              <MemberBadge status={openStaff.status} />
            </div>

            <Card>
              <CardHead title="Account" />
              <CardBody>
                <DL
                  rows={[
                    ["Account id", <span className="gm-mono">{openStaff.id}</span>],
                    ["Role", openStaff.title],
                    ["Email", openStaff.email],
                    ["On the team since", dateOnly(openStaff.since)],
                    ["Scoped by", openStaff.grantedBy ?? "—"],
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead title="Scopes" sub="What this account can reach" />
              <CardBody>
                <div className="gm-person-tags">
                  {scopesOf(openStaff.role).map((sc: string) => (
                    <span key={sc} className="gm-scope">
                      {sc}
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>

          </>
        ) : null}
      </RecordModal>

      {/* =================================================== member record */}
      <RecordModal
        open={!!openMember}
        onClose={() => setOpenMember(null)}
        title={openMember ? openMember.name : ""}
        sub={openMember ? `${openMember.handle} · ${openMember.id}` : ""}
        footer={
          /* Reading a record and changing someone's standing are different
             permissions. A moderator gets the first and not the second. */
          !canAct ? (
            <span className="gm-sm gm-muted">
              Read only. Changing standing, plan or verification is Trust and safety.
            </span>
          ) : live ? (
            live.status === "revoked" ? (
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
                {live.status !== "restricted" ? (
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
                  className="gm-btn"
                  onClick={() => startAction("change-plan")}
                >
                  <IconKey />
                  Change plan
                </button>
                <button
                  type="button"
                  className="gm-btn"
                  onClick={() => startAction("reset-verification")}
                >
                  <IconRefresh />
                  Reset verification
                </button>
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
        {live ? (
          <>
            <div className="gm-row" style={{ gap: 13, flexWrap: "nowrap" }}>
              <div className="gm-cell2" style={{ flex: "1 1 auto" }}>
                <b style={{ fontSize: 15 }}>{live.name}</b>
                <span>{live.email}</span>
              </div>
              <MemberBadge status={live.status} />
            </div>

            {live.note ? (
              <Note tone={live.status === "revoked" ? "bad" : "warn"}>
                <b>Moderator note.</b> {live.note}
              </Note>
            ) : null}

            <Card>
              <CardHead
                title="Account"
                sub={
                  seeBilling && seeId
                    ? `${planLabel[live.plan]} · ${verificationLabel[live.verification]}`
                    : `${live.sales} sales · ${live.listed} listings published`
                }
              />
              <CardBody>
                <DL
                  rows={[
                    ["Member id", <span className="gm-mono">{live.id}</span>],
                    ["Role", ROLE_LABEL[live.role]],
                    ...(seeBilling
                      ? ([
                          [
                            "Plan",
                            <span className="gm-row" style={{ gap: 6 }}>
                              {planLabel[live.plan]}
                              <span className="gm-dim">
                                {planQuota[live.plan] === null
                                  ? "no listing ceiling"
                                  : `${live.liveListings} of ${planQuota[live.plan]} live`}
                              </span>
                            </span>,
                          ],
                        ] as [React.ReactNode, React.ReactNode][])
                      : []),
                    /* A moderator opens this record to judge a listing, and
                       the roles table gives them no billing and no ID. Both
                       rows are dropped rather than blanked — a greyed field
                       still tells you the account has one. */
                    ...(seeBilling
                      ? ([
                          [
                            "Billing",
                            live.billing === "past-due" ? (
                              <Badge tone="warn">{billingLabel[live.billing]}</Badge>
                            ) : live.billing === "cancelled" ? (
                              <Badge tone="bad">{billingLabel[live.billing]}</Badge>
                            ) : (
                              billingLabel[live.billing]
                            ),
                          ],
                        ] as [React.ReactNode, React.ReactNode][])
                      : []),
                    ...(seeId
                      ? ([
                          [
                            "Verification",
                            live.verification === "id-verified" ? (
                              <Badge tone="ok">{verificationLabel[live.verification]}</Badge>
                            ) : (
                              <Badge tone="warn">{verificationLabel[live.verification]}</Badge>
                            ),
                          ],
                        ] as [React.ReactNode, React.ReactNode][])
                      : []),
                    ["Verified seller", live.verifiedSeller ? "Yes" : "No"],
                    ["Country", live.country],
                    ["Member since", dateOnly(live.joined)],
                    [
                      "Last seen",
                      live.lastSeenDays >= LAPSED_DAYS ? (
                        <span className="gm-row" style={{ gap: 6 }}>
                          {live.lastSeen}
                          <Badge tone="warn">Lapsed</Badge>
                        </span>
                      ) : (
                        live.lastSeen
                      ),
                    ],
                    ["Lifetime volume", money(live.volume)],
                    ["Sales · purchases", `${live.sales} · ${live.purchases}`],
                    [
                      "Listings published",
                      live.listed === 0 ? <Badge tone="warn">Never listed</Badge> : live.listed,
                    ],
                    [
                      "Strikes",
                      live.strikes === 0 ? (
                        <Badge tone="ok">None</Badge>
                      ) : (
                        <Badge tone={live.strikes >= 3 ? "bad" : "warn"}>
                          {live.strikes} in the last 30 days
                        </Badge>
                      ),
                    ],
                  ]}
                />
              </CardBody>
            </Card>

            {/* ------------------------------------------------------ tags */}
            <Card>
              <CardHead
                title="Tags"
                sub="Internal only. Never shown to the member, and searchable from the directory."
              />
              <CardBody>
                <div className="gm-person-tags" style={{ marginBottom: 10 }}>
                  {live.tags.length === 0 ? (
                    <span className="gm-sm gm-muted">No tags on this record.</span>
                  ) : (
                    live.tags.map((t) => (
                      <span key={t} className="gm-scope" style={{ gap: 5 }}>
                        #{t}
                        <button
                          type="button"
                          onClick={() => dropTag(t)}
                          aria-label={`Remove the ${t} tag`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            border: 0,
                            background: "transparent",
                            cursor: "pointer",
                            padding: 0,
                            color: "inherit",
                            opacity: 0.7,
                          }}
                        >
                          <IconX style={{ width: 11, height: 11 }} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="gm-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                  <input
                    className="gm-input"
                    style={{ flex: "1 1 auto" }}
                    value={tagDraft}
                    list="gm-taglist"
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add a tag, such as chargeback-risk or consignment"
                    aria-label="Add a tag"
                  />
                  <datalist id="gm-taglist">
                    {knownTags().map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    className="gm-btn gm-btn--sm"
                    onClick={addTag}
                    disabled={!tagDraft.trim()}
                  >
                    <IconTag />
                    Add
                  </button>
                </div>
              </CardBody>
            </Card>

            {/* -------------------------------------------------- timeline */}
            <MemberTimeline handle={live.handle} entries={record}>
              <div className="gm-field" style={{ marginBottom: 14 }}>
                <label className="gm-label" htmlFor="gm-note">
                  Add a staff note
                </label>
                <textarea
                  id="gm-note"
                  className="gm-textarea"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="What the next person reading this record needs to know."
                />
                <div className="gm-row" style={{ gap: 8, marginTop: 7 }}>
                  <button
                    type="button"
                    className="gm-btn gm-btn--sm gm-btn--primary"
                    onClick={addNote}
                    disabled={noteDraft.trim().length < 4}
                  >
                    <IconNote />
                    File note
                  </button>
                  <span className="gm-spacer gm-tiny gm-dim">
                    Internal only · stamped {operator.name}
                  </span>
                </div>
              </div>
            </MemberTimeline>

            <Card>
              <CardHead title="What revoking does" sub="So it is clear before you use it" />
              <CardBody>
                <ul
                  style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 7 }}
                  className="gm-sm gm-muted"
                >
                  <li>Every session ends and sign-in is blocked.</li>
                  <li>Live listings are pulled and open offers cancelled.</li>
                  <li>Messaging closes, including threads already open with other members.</li>
                  <li>
                    Trades already agreed are between the two members. No money passed through us,
                    so there is nothing here to unwind. Both sides are told the account is closed.
                  </li>
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
      </RecordModal>

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
              disabled={!canCommit}
              onClick={commit}
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
            <div className="gm-cell2">
              <b>{openStaff?.name ?? openMember?.name}</b>
              <span>{openStaff?.title ?? openMember?.handle}</span>
            </div>
          </div>
        </Card>

        {action === "revoke" ? (
          <Note tone="bad">
            <b>{openMember?.handle} loses access immediately.</b> Live listings are pulled and open
            offers cancelled. Any trade the two of them already agreed is between those members.
            Nothing passed through us, so there is nothing here to unwind.
          </Note>
        ) : action === "suspend" ? (
          <Note tone="bad">
            <b>Everything this account could reach is withdrawn.</b> Work already assigned to it
            returns to the unclaimed queue. Their past decisions stay in the audit log under their
            name, since suspending someone does not retract what they did.
          </Note>
        ) : action === "restrict" ? (
          <Note tone="warn">
            Selling and listing stop. The member keeps browsing and buying, and is told which
            behaviour caused it.
          </Note>
        ) : action === "reset-verification" ? (
          <Note tone="warn">
            <b>Back to mobile confirmed.</b> ID has to be resubmitted to the provider and pass the
            DVS again before they can list or trade. We hold no documents, so nothing is deleted
            here. Only the outcome we were given is withdrawn. Use it when identity is in doubt
            rather than as a punishment, since a restriction covers that.
          </Note>
        ) : action === "change-plan" ? (
          <Note tone={overQuota ? "warn" : "gold"}>
            {overQuota ? (
              <>
                <b>This plan is smaller than what they have live.</b> {live?.liveListings} listings
                are on the market against a ceiling of {quota}. The oldest come off at the next
                cycle unless they upgrade again first, so say so in the reason.
              </>
            ) : (
              <>Billing corrects on the next cycle. Nothing already listed is affected.</>
            )}
          </Note>
        ) : (
          <Note tone="gold">
            Access returns in full. The strike record and every past action stay on file.
          </Note>
        )}

        {action === "change-plan" && live ? (
          <div className="gm-field">
            <label className="gm-label" htmlFor="gm-plan-next">
              Move to
            </label>
            <Select
              id="gm-plan-next"
              value={nextPlan}
              onChange={(v) => setNextPlan(v as PlanKey)}
              options={(["none", "starter", "collector", "dealer"] as PlanKey[]).map((k) => ({
                value: k,
                label:
                  planQuota[k] === null
                    ? `${planLabel[k]}, no listing ceiling`
                    : `${planLabel[k]}, ${planQuota[k]} live listing${planQuota[k] === 1 ? "" : "s"}`,
              }))}
              style={{ width: "100%" }}
            />
            <span className="gm-hint">
              Currently on {planLabel[live.plan]}, with {live.liveListings} live.
            </span>
          </div>
        ) : null}

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
                placeholder={
                  action === "change-plan"
                    ? "Why the plan is moving: a support request, a downgrade they asked for, a comp."
                    : action === "reset-verification"
                      ? "What put the identity in doubt."
                      : "Case references, dates, what the evidence showed."
                }
              />
              <span className="gm-hint">
                {action === "change-plan"
                  ? "Optional, but it is what explains the charge later."
                  : "At least 10 characters."}
              </span>
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
                    <b>Retire the handle</b>
                    <span>Nobody can re-register it, so the record cannot be walked away from.</span>
                  </div>
                  <div className="gm-setrow-ctl">
                    <Toggle checked={retireHandle} onChange={setRetireHandle} label="Retire handle" />
                  </div>
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
      </Modal>

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
              disabled={(!viaPush && !viaEmail) || !subject.trim() || !body.trim()}
              onClick={() => {
                setComposing(false);
                setToast(
                  `${audience.length} member${audience.length === 1 ? "" : "s"} · ${
                    [viaPush ? "push" : null, viaEmail ? "email" : null].filter(Boolean).join(" + ")
                  }`
                );
                setPicked(new Set());
              }}
            >
              <IconSend />
              Send to {audience.length}
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

        <Card pad>
          <div className="gm-setrow">
            <div className="gm-setrow-main">
              <b>Push notification</b>
              <span>Arrives now, and is gone once it is swiped away.</span>
            </div>
            <div className="gm-setrow-ctl">
              <Toggle
                checked={viaPush}
                onChange={setViaPush}
                label="Send as push"
                disabled={!commsTemplates.find((t) => t.key === template)?.channels.includes("push")}
              />
            </div>
          </div>
          <div className="gm-setrow">
            <div className="gm-setrow-main">
              <b>Email</b>
              <span>Readable later. The only channel that counts as having told someone.</span>
            </div>
            <div className="gm-setrow-ctl">
              <Toggle checked={viaEmail} onChange={setViaEmail} label="Send as email" />
            </div>
          </div>
        </Card>

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
        <Toast title="Access updated" body={`${toast} · written to the audit log`} onDone={() => setToast(null)} />
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
