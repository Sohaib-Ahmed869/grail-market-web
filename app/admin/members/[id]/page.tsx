"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  billingLabel,
  can,
  dateOnly,
  knownTags,
  LAPSED_DAYS,
  money,
  planLabel,
  planQuota,
  revokeReasons,
  roleLabel,
  scopesOf,
  verificationLabel,
  type Member,
  type PlanKey,
} from "../../lib/data";
import {
  annotateMember,
  ApiError,
  fetchMember,
  fetchStaff,
  messageMembers,
  setMemberStanding,
  type AdminStaff,
  type TimelineEntry,
} from "../../lib/api";
import { MemberTimeline } from "../../components/MemberTimeline";
import { Gate } from "../../components/Gate";
import { useRole } from "../../components/RoleContext";
import {
  ActionBar,
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHead,
  DL,
  Loading,
  MemberBadge,
  Modal,
  Note,
  PageHead,
  Rating,
  Select,
  Toast,
  Toggle,
} from "../../components/ui";
import {
  IconBan,
  IconCheck,
  IconKey,
  IconLock,
  IconMail,
  IconNote,
  IconRefresh,
  IconSend,
  IconTag,
  IconX,
} from "../../components/icons";

/**
 * One person, as a page.
 *
 * The record was a window over the directory, and every lever on it — revoke,
 * restrict, change plan, reset verification, write to them — opened a second
 * window on top of the first. Two overlays deep the footer of the inner one
 * sat below the bottom of the outer one on a laptop, so the button that
 * applied the thing you had just typed a reason for was off the screen.
 *
 * The record is a route now. One overlay is left: the confirmation that takes
 * the reason, which is the only part of this that must not be dismissed by
 * looking away.
 */

type Action =
  | "revoke"
  | "restrict"
  | "reinstate"
  | "suspend"
  | "reset-verification"
  | "change-plan";

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
    sub: "Their ID check starts again. They cannot buy or sell until it passes.",
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

/* What the identity panel has to leave for the action bar: the bar is 82 tall,
   sticky at the foot of the window, and paints over whatever is under it. */
const ASIDE_FOOT = 116;

/* The shortest the panel is allowed to get. Below this it is no longer a
   record of anything, and a window that small is already on the one-column
   layout where the panel takes its own height instead. */
const ASIDE_FLOOR = 240;

/**
 * The height of the identity panel, measured rather than assumed.
 *
 * `.gm-rec-aside` is sticky under the topbar and the CSS sized it from that
 * offset — window, less topbar, less the action bar. That is right only once
 * the page head has scrolled away. At the top of the record the panel is
 * still in flow below that head, so it started ~140px lower than the sum
 * allowed for and ran the same distance past the bottom of the window: its
 * last two figures behind the action bar, and a scrollbar inside a card that
 * had room going spare.
 *
 * Measuring from the panel's own `top` is right in both states — the box
 * grows as the head scrolls out from above it and stops at the floor of the
 * window either way — and it is the only way to be right, since the head is
 * not a constant CSS could be told: the name wraps, the record loads, the
 * moderator note appears above the grid. Reading the panel's `top` cannot
 * feed back into it, because the box is top-aligned: its height is what
 * changes, never where it starts.
 *
 * `--gm-zoom` is divided back out for the reason every other measurement
 * against the window in this console divides it out — `:root` carries a zoom
 * above 1600 and a client rectangle is reported after it.
 */
function useAsideHeight(ref: React.RefObject<HTMLElement | null>) {
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const zoom = Number(getComputedStyle(el).getPropertyValue("--gm-zoom")) || 1;
    const free = (window.innerHeight - el.getBoundingClientRect().top) / zoom - ASIDE_FOOT;
    el.style.setProperty("--rec-aside-h", `${Math.round(Math.max(ASIDE_FLOOR, free))}px`);
  }, [ref]);

  useEffect(() => {
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  /* No dependency list, deliberately. What moves this panel is the height of
     everything above it, and none of that is a value this component holds —
     it is the head, the note that is there on a restricted account and not on
     any other, and the fonts once they land. One rectangle read per render on
     a page that renders when somebody clicks something. */
  useEffect(measure);
}

function MemberRecord() {
  const id = String(useParams().id ?? "");
  const params = useSearchParams();
  /* The same query parameter the directory uses. A staff account and a
     marketplace member are two different records with two different sets of
     levers, and the id alone does not say which one this is. */
  const team = params.get("scope") === "team";

  const aside = useRef<HTMLElement | null>(null);
  useAsideHeight(aside);

  const { role: viewerRole, me } = useRole();
  /* "No billing, no ID" is the moderator's line in the roles table, and it is
     a rule about fields on a record they are otherwise allowed to open. */
  const seeBilling = can(viewerRole, "billing.read");
  const seeId = can(viewerRole, "id.exceptions");
  const canAct = can(viewerRole, "members.act");

  const [live, setLive] = useState<Member | null>(null);
  const [staff, setStaff] = useState<AdminStaff | null>(null);
  const [record, setRecord] = useState<TimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [action, setAction] = useState<Action | null>(null);
  const [reasonKey, setReasonKey] = useState(revokeReasons[0]);
  const [reasonNote, setReasonNote] = useState("");
  const [freezeListings, setFreezeListings] = useState(true);
  const [retireHandle, setRetireHandle] = useState(true);
  const [nextPlan, setNextPlan] = useState<PlanKey>("collector");
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [toast, setToast] = useState<{ title: string; body: string; tone?: "ok" | "bad" } | null>(
    null,
  );

  /* Writing to one person uses the same composer the directory aims at a
     segment, because a second message dialog would be a second thing to keep
     in step with what sending actually does. */
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    const job = team
      ? /* There is no single-staff endpoint: the roster is short, and one read
           of it is cheaper than an endpoint that exists for one page. */
        fetchStaff().then((all) => {
          if (!alive) return;
          const found = all.find((p) => p.id === id) ?? null;
          setStaff(found);
          if (!found) setError("No staff account with that id.");
        })
      : fetchMember(id).then((r) => {
          if (!alive) return;
          setLive(r.member);
          setRecord(r.timeline);
        });
    job
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, team]);

  async function reread() {
    if (team) return;
    const r = await fetchMember(id).catch(() => null);
    if (r) {
      setLive(r.member);
      setRecord(r.timeline);
    }
  }

  async function addNote() {
    if (!live || noteDraft.trim().length < 4) return;
    const updated = await annotateMember(live.id, { note: noteDraft.trim() }).catch(() => null);
    if (updated) setLive(updated);
    setNoteDraft("");
    void reread();
  }

  async function addTag() {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, "-");
    if (!live || !t || live.tags.includes(t)) return;
    const updated = await annotateMember(live.id, { tags: [...live.tags, t] }).catch(() => null);
    if (updated) setLive(updated);
    setTagDraft("");
  }

  async function dropTag(t: string) {
    if (!live) return;
    const updated = await annotateMember(live.id, {
      tags: live.tags.filter((x) => x !== t),
    }).catch(() => null);
    if (updated) setLive(updated);
  }

  function startAction(a: Action) {
    setReasonKey(revokeReasons[0]);
    setReasonNote("");
    if (a === "change-plan" && live) setNextPlan(live.plan);
    setAction(a);
  }

  const target = staff?.name ?? live?.handle ?? "";

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

    if (staff || !live) {
      setToast({
        title: "Not done",
        body: `${target} is a staff account. Change what they can reach under Settings, Team and access.`,
        tone: "bad",
      });
      setAction(null);
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
            ? "A plan change has to be made in Stripe. The console cannot do it yet."
            : "The company that checks IDs makes this decision, and the console cannot reach them yet.",
        tone: "bad",
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
      void reread();
      setToast({
        title:
          standing === "revoked"
            ? "Account closed"
            : standing === "restricted"
              ? "Account restricted"
              : "Access returned",
        body: `${target} · the reason is on their record`,
      });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
    }
    setAction(null);
  }

  async function sendToMember() {
    if (!live || sending) return;
    setSending(true);
    try {
      const r = await messageMembers([live.id], subject.trim(), body.trim());
      setComposing(false);
      setSubject("");
      setBody("");
      setToast({
        title: r.delivered > 0 ? "Written to them" : "Nothing was delivered",
        tone: r.delivered > 0 ? "ok" : "bad",
        /* Said apart, because they are different facts. Nobody has a device
           registered in development, so "0 pushed" is the normal answer and
           must not read as a failure. */
        body:
          `${live.handle} will see it in the app. ` +
          (r.pushed > 0
            ? "It was pushed to their device as well."
            : "No device is registered, so nothing was pushed."),
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

  /* The one overlay this route keeps: a standing change and the reason it is
     recorded under, which must not be dismissed by looking away.

     Held as an element rather than as a nested component. A component declared
     inside another is a new type on every render, so React tears the old one
     down and mounts a fresh one — and the textarea in here lost its focus on
     every keystroke because of it. */
  const actionModal = (
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
            <b>{staff?.name ?? live?.name}</b>
            <span>{staff?.title ?? live?.handle}</span>
          </div>
        </div>
      </Card>

      {action === "revoke" ? (
        <Note tone="bad">
          <b>{live?.handle} loses access immediately.</b> Live listings are pulled and open offers
          cancelled. Any trade the two of them already agreed is between those members. Nothing
          passed through us, so there is nothing here to unwind.
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
          <b>They will have to prove who they are again.</b> Their ID check is set back to the
          start, and they cannot buy or sell until it passes. We never held a copy of their
          documents, so nothing of theirs is deleted here.
          <br />
          Use this when you doubt who the person is. If the problem is how they have behaved,
          restrict the account instead.
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
      ) : action === "reinstate" ? (
        <Note tone="gold">
          Access returns in full. The strike record and every past action stay on file.
        </Note>
      ) : null}

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

      {action && action !== "reinstate" ? (
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
                  <Toggle
                    checked={freezeListings}
                    onChange={setFreezeListings}
                    label="Pull listings"
                  />
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
  );

  const back = team
    ? { href: "/admin/members?scope=team", label: "Admin team" }
    : { href: "/admin/members?scope=market", label: "Members" };

  if (error) {
    return (
      <>
        <PageHead title="Record" back={back} />
        <Note tone="bad">
          <b>That record could not be read.</b> {error}
        </Note>
      </>
    );
  }

  if (loading || (!live && !staff)) {
    return (
      <>
        <PageHead title="Opening…" back={back} />
        <Card>
          <Loading label="Reading the record…" />
        </Card>
      </>
    );
  }

  /* ================================================== a staff account */
  if (staff) {
    return (
      <>
        <PageHead
          title={staff.name}
          sub={staff.title}
          back={back}
          right={<MemberBadge status={staff.status} />}
        />

        <div className="gm-stack">
          <div className="gm-grid gm-grid--2">
            <Card>
              <CardHead title="Account" />
              <CardBody>
                <DL
                  rows={[
                    ["Role", staff.title],
                    ["Email", staff.email],
                    ["On the team since", dateOnly(staff.since)],
                    ["Scoped by", staff.grantedBy ?? "Not recorded"],
                    ["Console role", roleLabel(staff.role)],
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead title="Scopes" sub="What this account can reach" />
              <CardBody>
                <div className="gm-person-tags">
                  {scopesOf(staff.role).map((sc: string) => (
                    <span key={sc} className="gm-scope">
                      {sc}
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          <ActionBar note="Changing what an account can reach is done under Settings, Team and access">
            {staff.status === "active" ? (
              <button
                type="button"
                className="gm-btn gm-btn--danger"
                onClick={() => startAction("suspend")}
              >
                <IconBan />
                Suspend account
              </button>
            ) : (
              <span className="gm-sm gm-muted">This account is already restricted.</span>
            )}
          </ActionBar>
        </div>

        {actionModal}

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

  if (!live) return null;

  /* Written once because it is rendered in two places: beside Verification
     when the viewer can see it, and on its own when they cannot. */
  const verifiedSellerFact = (
    <div className="gm-idfact">
      <span>Verified seller</span>
      <b>{live.verifiedSeller ? "Yes" : "No"}</b>
    </div>
  );

  /* ============================================== a marketplace member */
  return (
    <>
      {/* The standing and the rating used to sit up here. They are on the
          identity panel now, beside the face they describe and in view for as
          long as the record is — which is the whole point of pinning it.

          The name and the handle went the same way, and for a second reason.
          They were printed here and printed again sixty pixels lower on the
          identity card, and the copy up here cost 75px of head that the panel
          below it could not use — which is what put the panel's own foot
          behind the action bar and a scrollbar inside a card that had the
          record to show. The heading is the name on the card now. */}
      <PageHead back={back} />

      <div className="gm-stack">
        {live.note ? (
          <Note tone={live.status === "revoked" ? "bad" : "warn"}>
            <b>Moderator note.</b> {live.note}
          </Note>
        ) : null}

        <div className="gm-rec">
          {/* ------------------------------------------- who this is */}
          <aside className="gm-rec-aside" ref={aside}>
            <Card>
              <div className="gm-idcard">
                <div className="gm-idcard-band" aria-hidden />
                <Avatar initials={live.initials} size="xl" />
                {/* The page's heading, not a bold line: this is the only
                    place the record is named now, and a page still needs one
                    heading for anything reading it in order. */}
                <h2 className="gm-idcard-name">{live.name}</h2>
                <span className="gm-idcard-sub">
                  {live.handle} · {ROLE_LABEL[live.role]}
                </span>
                <div className="gm-idcard-chips">
                  <MemberBadge status={live.status} />
                  <Rating value={live.rating} />
                </div>

                {/* The four facts that say who the account belongs to, as
                    against what it has been doing — that is the split down
                    the middle of this page, and it is why Plan, Billing and
                    Verification are still in the Account card beside rather
                    than up here. */}
                <div className="gm-idfacts">
                  <div className="gm-idfact">
                    <span>Email</span>
                    <b>{live.email}</b>
                  </div>
                  {/* No country. The store has no column for one — the
                      normaliser fills it with "Unknown" for every account in
                      the database — so the row was a label with a placeholder
                      under it on every record, which says less than nothing.
                      It is still a filter on the directory, where it will
                      start working the day the column exists. */}
                  {/* Two to a row from here down. Seven facts stacked ran to
                      620px in a panel that gets 540 on a laptop, so the last
                      of them were behind a scrollbar however the box was
                      sized — a column that only ever grows is the wrong shape
                      for a fixed height. The dates pair, the two billing facts
                      pair, the two verification facts pair, and the foot strip
                      below already reads as two columns, so this is the card's
                      own idiom rather than a new one. Email stays full width:
                      it is the one value long enough to burst a 304px panel on
                      its own. */}
                  <div className="gm-idpair">
                  <div className="gm-idfact">
                    <span>Member since</span>
                    <b>{dateOnly(live.joined)}</b>
                  </div>
                  <div className="gm-idfact">
                    <span>Last seen</span>
                    <b>
                      {/* Their most recent listing, which is the closest thing
                          the store holds to "last seen" — and `dateOnly`, not
                          the raw column, which printed the ISO string straight
                          out of Postgres. */}
                      {live.lastSeenDays >= LAPSED_DAYS ? (
                        <span className="gm-row" style={{ gap: 6 }}>
                          {dateOnly(live.lastSeen)}
                          <Badge tone="warn">Lapsed</Badge>
                        </span>
                      ) : (
                        dateOnly(live.lastSeen)
                      )}
                    </b>
                  </div>
                  </div>

                  {/* The state of the account, which was a card of its own
                      beside this one holding four rows. It belongs to the
                      subject as much as the address does, and the panel is
                      the thing that stays on screen — so a moderator who has
                      scrolled to the timeline can still see whether this
                      person is verified and whether their card is bouncing.

                      Both halves are permission-gated as they were: a
                      moderator's role carries neither billing nor ID, and the
                      rows are dropped rather than blanked, because a greyed
                      field still tells you the account has one. */}
                  {seeBilling ? (
                    <div className="gm-idpair">
                      <div className="gm-idfact">
                        <span>Plan</span>
                        <b>
                          {planLabel[live.plan]}{" "}
                          <span className="gm-dim">
                            {planQuota[live.plan] === null
                              ? "no listing ceiling"
                              : `${live.liveListings} of ${planQuota[live.plan]} live`}
                          </span>
                        </b>
                      </div>
                      <div className="gm-idfact">
                        <span>Billing</span>
                        <b>
                          {live.billing === "past-due" ? (
                            <Badge tone="warn">{billingLabel[live.billing]}</Badge>
                          ) : live.billing === "cancelled" ? (
                            <Badge tone="bad">{billingLabel[live.billing]}</Badge>
                          ) : (
                            billingLabel[live.billing]
                          )}
                        </b>
                      </div>
                    </div>
                  ) : null}
                  {/* The two verification facts are one row when the viewer
                      has ID, and the second one stands alone when they do not
                      — a moderator's role carries no ID scope, and a lone half
                      of a pair would sit in a column with nothing beside it. */}
                  {seeId ? (
                    <div className="gm-idpair">
                      <div className="gm-idfact">
                        <span>Verification</span>
                        <b>
                          {live.verification === "id-verified" ? (
                            <Badge tone="ok">{verificationLabel[live.verification]}</Badge>
                          ) : (
                            <Badge tone="warn">{verificationLabel[live.verification]}</Badge>
                          )}
                        </b>
                      </div>
                      {verifiedSellerFact}
                    </div>
                  ) : (
                    verifiedSellerFact
                  )}
                </div>

                {/* Pinned to the floor of the panel, the way the sidebar pins
                    its theme switch. The panel is as tall as the window now,
                    and a column with content only at the top is a column with
                    a hole under it — two figures at the foot give it weight at
                    both ends and put the slack in the middle, where it reads
                    as spacing rather than as something missing. Neither figure
                    is repeated in Trading beside it. */}
                <div className="gm-idfoot">
                  <span>
                    <i>Lifetime volume</i>
                    <b>{money(live.volume)}</b>
                  </span>
                  <span>
                    <i>Sales · purchases</i>
                    <b>
                      {live.sales} · {live.purchases}
                    </b>
                  </span>
                </div>
              </div>
            </Card>
          </aside>

          {/* -------------------------------- what the account has done */}
          <div className="gm-rec-main">
        {/* Account went to the panel — see the note there. What is left on
            this side is what the account has DONE, which is the other half of
            the split this page is built on. No wrapper: `.gm-rec-main` is
            already the column with the gap. */}
          <Card>
            <CardHead title="Trading" sub="What this account has actually done" />
            <CardBody>
              <DL
                rows={[
                  /* Lifetime volume and the sale counts are on the panel's
                     foot, so they are not restated here. */
                  [
                    "Listings published",
                    live.listed === 0 ? <Badge tone="warn">Never listed</Badge> : live.listed,
                  ],
                  ["Live right now", live.liveListings],
                  ["Rating", <Rating value={live.rating} />],
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
                style={{ flex: "1 1 auto", minWidth: 0 }}
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
                Internal only · stamped {me?.name ?? "you"}
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
                Trades already agreed are between the two members. No money passed through us, so
                there is nothing here to unwind. Both sides are told the account is closed.
              </li>
              <li>The member is emailed the reason recorded at the time.</li>
            </ul>
          </CardBody>
        </Card>
          </div>
        </div>

        {/* --------------------------------------------------- the levers

            Still full width and still the last thing on the page, rather than
            a set of buttons inside the panel. The bar is sticky and the panel
            has a ceiling: a lever pinned inside a box that can scroll is a
            lever that can be scrolled out of reach, which is the one thing an
            action bar must never do. */}
        <ActionBar
          note={
            canAct ? "Every action here is written to the audit log" : undefined
          }
        >
          {/* Reading a record and changing someone's standing are different
              permissions. A moderator gets the first and not the second. */}
          {!canAct ? (
            <span className="gm-sm gm-muted">
              Read only. Changing standing, plan or verification is Trust and safety.
            </span>
          ) : live.status === "revoked" ? (
            <>
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                onClick={() => startAction("reinstate")}
              >
                <IconCheck />
                Reinstate access
              </button>
              <button type="button" className="gm-btn" onClick={() => setComposing(true)}>
                <IconMail />
                Message
              </button>
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
              <button type="button" className="gm-btn" onClick={() => setComposing(true)}>
                <IconMail />
                Message
              </button>
              <button type="button" className="gm-btn" onClick={() => startAction("change-plan")}>
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
                className="gm-btn gm-btn--danger"
                onClick={() => startAction("revoke")}
              >
                <IconBan />
                Revoke access
              </button>
            </>
          )}
        </ActionBar>
      </div>

      {actionModal}

      {/* ========================================================= comms */}
      <Modal
        open={composing}
        onClose={() => setComposing(false)}
        title={`Write to ${live.handle}`}
        sub="Push and in-app. Nothing here reaches a member who has opted out of that channel."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={sending || !subject.trim() || body.trim().length < 10}
              onClick={sendToMember}
            >
              <IconSend />
              {sending ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--ghost"
              onClick={() => setComposing(false)}
            >
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Logged against this record</span>
          </>
        }
      >
        <Note>
          <b>Where this goes.</b> They get it in the app, and a push as well if they have a device
          registered. Email is not wired: no provider is configured, so nothing here reaches an
          inbox.
        </Note>
        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-one-subject">
            Subject
          </label>
          <input
            id="gm-one-subject"
            className="gm-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What this is about"
          />
        </div>
        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-one-body">
            Message
          </label>
          <textarea
            id="gm-one-body"
            className="gm-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Written to them by name, from the console, under your account."
          />
          <span className="gm-hint">At least 10 characters.</span>
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

/**
 * One route, two records, two different answers.
 *
 * A member record is a moderator's tool. A colleague's account is the list of
 * who can do what, which is an owner's — so the capability is picked from the
 * scope rather than from the path, exactly as the directory does it.
 */
function GatedRecord() {
  const params = useSearchParams();
  const team = params.get("scope") === "team";
  return (
    <Gate need={team ? "team.read" : "members.read"}>
      <MemberRecord />
    </Gate>
  );
}

export default function MemberRecordRoute() {
  return (
    <Suspense fallback={null}>
      <GatedRecord />
    </Suspense>
  );
}
