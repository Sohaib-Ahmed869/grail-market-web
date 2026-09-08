"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import "./dashboard.css";
import { aud, money } from "./lib/data";
import {
  ApiError,
  decideListing,
  fetchDashboard,
  fetchMemberFaces,
  useListings,
  type AdminListing,
  type Dashboard,
  type MemberFace,
} from "./lib/api";
import {
  Avatar,
  Card,
  CardHead,
  Empty,
  LinkStat,
  Loading,
  Modal,
  Note,
  RowMenu,
  Slab,
  StackBar,
  ListingBadge,
  Tier,
  Toast,
  VolumeChart,
} from "./components/ui";
import {
  IconArrowRight,
  IconCheck,
  IconEye,
  IconInbox,
  IconUsers,
  IconXCircle,
} from "./components/icons";
import { Gate } from "./components/Gate";
import { useRole } from "./components/RoleContext";

/* Three columns, six boxes, and all of it inside one window.

   The page used to be a tall left column — greeting, queue, money, funnel,
   chart — with a rail beside it, and everything below the first screen was
   read by scrolling to it. A dashboard that scrolls is a report; what makes
   this one a dashboard is that the whole state of the marketplace is in view
   at once, so the grid is given the height of the window and the columns and
   rows share it out rather than each card sizing to whatever is in it.

   The greeting panel that opened the page is gone from here — it is kept
   verbatim in components/GreetingHero.tsx, and the verification dial and the
   support desk extract in components/DashboardOffcuts.tsx. Nothing imports
   any of them. What came back above the grid is a date and one line of
   greeting: the panel cost a third of the window and this costs forty
   pixels, which is what a dashboard that promises to fit in the window can
   afford to spend on saying good morning. */

/* How many rows of the queue the extract carries before the rest are behind
   "All N".

   Four, and the number is measured rather than chosen. It was six, and the
   card it sits in has never been six rows tall at any window this console is
   used at — the extra two scrolled inside their own box, which is the one
   thing a dashboard card must not do. Four is what fits the shortest of the
   three desktop sizes with the rows at the height below; if the row grows a
   line again, this comes down with it. */
const SLA_ROWS = 2;

/* How many faces the members panel draws before the rest become "+N". Three,
   asked for: the row reads as a sample with a count after it rather than as a
   list that happens to stop. Five fitted the column, but on a marketplace this
   size it drew every member and the "+N" disc — the part that says there are
   more — never appeared at all. */
const FACES = 3;

/* The plan colours, here rather than on the API: which colour a plan is drawn
   in is a rendering decision and Stripe has no opinion about it. Indexed by
   position, so a fourth plan gets one without anybody adding it. */
const PLAN_COLOUR = ["var(--gold)", "var(--navy-500)", "var(--ink-4)", "var(--ok)"];

/* `DECIDABLE` is awaiting + in-review — the rows waiting on us. A listing in
   `info-requested` is waiting on the seller with its clock stopped, so a
   decision on the row would be a decision taken without the thing you asked
   for. Those still count towards the queue depth in the rail, which is a
   different question. */

function DashboardPage() {
  /* Whoever is signed in, from the session. There is no fixture operator on
     this console and the greeting is never addressed to an invented person;
     until the session answers, the line is addressed to nobody rather than
     to a placeholder name that would then change under the reader. */
  const { me } = useRole();

  const [rejecting, setRejecting] = useState<AdminListing | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  /* Everything on this page, from the API.

     It was the last one drawing sample money, and the figure it invented was
     one another page already knew: it printed ~4,900 subscribers while
     /admin/pricing read the real number off the database. Two pages of one
     console disagreeing about the same number is worse than either being
     wrong on its own. */
  const [data, setData] = useState<Dashboard | null>(null);
  const [faces, setFaces] = useState<MemberFace[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* The queue is the listing queue, read through the same hook the queue page
     uses — the rows are worked here, so they must be the same rows. */
  const { data: queueData, loading: queueLoading, reload } = useListings({
    view: "queue",
    search: "",
    tier: "all",
  });
  const queue = useMemo(
    () => [...(queueData?.listings ?? [])].sort((a, b) => a.slaHours - b.slaHours),
    [queueData],
  );

  const [writes, setWrites] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    /* Both reads, one await. The faces are part of the same moment as the
       count printed above them, and a second request resolving later would
       have drawn a panel that said four members over three circles.

       A refused members read is not a broken dashboard, though: whoever can
       see this page can see the directory today, but that is a capability
       table rather than a law, so a failure here costs the faces and nothing
       else. */
    Promise.all([fetchDashboard(), fetchMemberFaces(FACES).catch(() => [] as MemberFace[])])
      .then(([r, m]) => {
        if (!live) return;
        setData(r);
        setFaces(m);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [writes]);

  const stats = data?.stats;
  const moneyIn = data?.money;

  const tiers = moneyIn?.tiers ?? [];
  const subscribers = moneyIn?.subscribers ?? 0;
  const members = stats?.members ?? 0;
  /* Everyone the row of faces did not have room for. Counted off the figure
     the database answered, not off the length of the list in this browser. */
  const overflow = Math.max(0, members - faces.length);

  /* Movement, from the series itself rather than from a constant. The header
     used to carry "+11.4%" and "+8.2%" written into the markup — figures that
     were not computed from anything and could not go down. */
  const gmv = data?.gmv ?? [];
  const gmvGrowth = (() => {
    if (gmv.length < 2) return null;
    const last = gmv[gmv.length - 1].gmv;
    const prev = gmv[gmv.length - 2].gmv;
    if (prev <= 0) return null;
    return ((last - prev) / prev) * 100;
  })();

  /* The same arithmetic on the money the marketplace actually banked, over
     the two rolling weeks the API sends for exactly this. It returns null
     rather than a number when the week before took nothing: a change from
     zero is not a percentage, and printing one would be inventing the only
     figure on this page nobody could check. */
  const weekBefore = moneyIn?.weekBefore ?? 0;
  const weekChange = weekBefore > 0 ? (((moneyIn?.week ?? 0) - weekBefore) / weekBefore) * 100 : null;
  /* Past a tripling the decimal is noise on a figure that is already an
     order-of-magnitude statement, and it is two more characters in a pill
     sized for four. */
  const weekChangeText =
    weekChange === null
      ? ""
      : `${weekChange >= 0 ? "+" : ""}${
          Math.abs(weekChange) >= 100 ? Math.round(weekChange) : weekChange.toFixed(1)
        }%`;

  /* Both decisions go through the same endpoint the queue page uses, so a
     decision taken here is a decision — it moves the listing, notifies the
     seller and writes to the audit log. It used to append to an in-memory
     array and show a toast saying the seller had been told. */
  async function approve(l: AdminListing) {
    if (busy) return;
    setBusy(true);
    try {
      const { listing, decidedBy } = await decideListing(l.id, "approve", "");
      reload();
      setWrites((n) => n + 1);
      setToast({
        title: "Published to the market",
        body: `${listing.card} · by ${decidedBy} · the seller has been notified`,
      });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    if (!rejecting || busy) return;
    setBusy(true);
    try {
      const { listing, decidedBy } = await decideListing(rejecting.id, "reject", reason.trim());
      setRejecting(null);
      setReason("");
      reload();
      setWrites((n) => n + 1);
      setToast({
        title: "Rejected and the seller told",
        body: `${listing.card} · by ${decidedBy} · the reason is on ${listing.seller.handle}'s record`,
      });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  /* The whole page waits. Its panels are aggregates of one moment, and
     showing some of them against a spinner in the others would be several
     different moments on one screen. */
  if (loading && !data) {
    return (
      <div className="gm-well">
        <Loading label="Reading the marketplace…" />
      </div>
    );
  }

  return (
    <div className="gm-dashpage">
      {/* A console that cannot reach its API must say so. An empty
          marketplace and a broken connection look identical otherwise. */}
      {loadError ? (
        <Note tone="bad">
          <b>The marketplace could not be read.</b> {loadError}
        </Note>
      ) : null}

      {/* Today, and who is reading. The date comes off the clock rather than
          out of the markup — the panel this replaces shipped once reading
          "Sunday · 1 September" on every day of the year — and the name comes
          off the session. Two weights of one line: the words are the same
          size, and only the ink says which half is the greeting and which is
          the person. */}
      <header className="gm-dash-hello">
        <span className="gm-dash-date">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        {/* No comma when there is nobody to address. A session that has not
            answered yet leaves "Welcome back," hanging on a name that never
            arrives, and a placeholder in its place would be an invented
            person, which this console does not have. */}
        <h2>
          {me ? (
            <>
              Welcome back,<span>{me.name.split(" ")[0]}</span>
            </>
          ) : (
            "Welcome back"
          )}
        </h2>
      </header>

      <div className="gm-dash3">
        {/* ============================================ left · the money in */}
        <Card className="gm-dash-rev">
          <CardHead title="Subscription revenue" sub="Recurring, by plan" />
          {/* No growth badge. It needs last month's MRR, which nothing
              records — the figure it used to show came from a constant beside
              the one above it and could not go down. */}
          <div className="gm-dash-revbody">
            {/* The head count rides on the unit rather than taking a line of
                its own. Two facts, one of which qualifies the other, and this
                card has a bar and a three-line key to fit under them. */}
            <div className="gm-money">
              <span className="gm-money-value">{aud(moneyIn?.mrr ?? 0)}</span>
              <span className="gm-money-unit">
                MRR · {subscribers.toLocaleString("en-AU")} subscriber
                {subscribers === 1 ? "" : "s"}
              </span>
            </div>

            {/* The split sits at the foot of the card rather than floating in
                the middle of it. On a tall window this column has room to
                spare, and three items spread evenly down it read as a panel
                that never finished loading; the headline at the top and the
                breakdown at the bottom read as a card. */}
            <div className="gm-dash-revfoot">
              <StackBar
                parts={tiers.map((t, i) => ({
                  label: t.name,
                  value: t.mrr,
                  color: PLAN_COLOUR[i % PLAN_COLOUR.length],
                }))}
              />

              {/* A key, not the plan table. `.gm-planline` carries the price,
                  the listing quota and the head count as well, and it earns
                  all four across half a page — in a column this narrow it
                  wrapped every row onto three lines. The subscriptions page
                  owns the detail; what this column has room to say is which
                  plan each band of the bar is and what it is worth. */}
              <ul className="gm-planmini">
                {tiers.map((t, i) => (
                  <li key={t.id}>
                    <i style={{ background: PLAN_COLOUR[i % PLAN_COLOUR.length] }} />
                    <span>{t.name}</span>
                    <b>{aud(t.mrr)}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* =================================== left · what actually arrived

            Collected is not MRR, and the difference is the dunning pile —
            saying only one of the two hides a real queue of work. This used
            to be the calendar month, which is a window that resets on the
            first and therefore compares with nothing; it is now the last
            seven days against the seven before them, so the figure arrives
            with the one thing that makes a revenue number readable.

            The only tile on the page with the navy under it, and asked for.
            `--grad-navy` is the console's control fill everywhere else, and
            it is here because this is the figure the page is opened for —
            one dark object among six white ones is a place the eye lands
            without a second colour being invented for it. */}
        <Card className="gm-dash-week">
          {/* No icon tile. It was added for the shape of the reference and
              did not fit: this card is the shortest on the page — one grid row
              of 0.55fr — so a 34px tile pushed the figure and its note past the
              bottom edge, and the tile itself was clipped by the corner it sat
              in. The label, the figure and the line under it are what the card
              is for. */}
          <div className="gm-dash-weekbody">
            <span className="gm-dash-weeklabel">Weekly revenue</span>
            <div className="gm-dash-weekline">
              <span className="gm-dash-weekvalue">{aud(moneyIn?.week ?? 0)}</span>
              {/* No pill at all rather than a "0%" or a dash: an empty week
                  before this one is a fact about the ledger, and the note
                  underneath says it in words. */}
              {weekChange !== null ? (
                <span
                  className={`gm-dash-weekpill${weekChange < 0 ? " gm-dash-weekpill--down" : ""}`}
                >
                  {weekChangeText}
                </span>
              ) : null}
            </div>
            <p className="gm-dash-weeknote">
              {(moneyIn?.failed ?? 0) > 0
                ? `${aud(moneyIn!.failed)} failed this month across ${
                    moneyIn!.failedAccounts
                  } account${moneyIn!.failedAccounts === 1 ? "" : "s"}.`
                : weekBefore > 0
                  ? `Against ${aud(weekBefore)} the week before.`
                  : "Nothing was collected the week before."}
            </p>
          </div>
        </Card>

        {/* ================================================ middle · volume */}
        <Card className="gm-dash-chart">
          <CardHead
            title="Marketplace volume"
            sub="Twelve weeks of GMV. The week you point at is read out beneath."
            right={
              gmvGrowth !== null ? (
                <span
                  className={`gm-badge ${gmvGrowth >= 0 ? "gm-badge--gold" : "gm-badge--bad"}`}
                >
                  {gmvGrowth >= 0 ? "+" : ""}
                  {gmvGrowth.toFixed(1)}% on last week
                </span>
              ) : undefined
            }
          />
          <div className="gm-dash-chartbody">
            {gmv.length === 0 ? (
              <Empty icon={<IconInbox />} title="Nothing has traded yet" />
            ) : (
              <VolumeChart data={gmv} />
            )}
          </div>
        </Card>

        {/* ================================= middle · the queue, worked here */}
        <Card className="gm-dash-queue">
          <CardHead
            title="Awaiting review"
            sub="Sorted by time left rather than by value. Decide on the row."
            right={
              <Link href="/admin/listings" className="gm-btn gm-btn--sm">
                All {queue.length}
                <IconArrowRight />
              </Link>
            }
          />

          <div className="gm-dash-queuebody">
            {queueLoading && queue.length === 0 ? (
              <Loading label="Reading the queue…" small />
            ) : queue.length === 0 ? (
              <Empty icon={<IconInbox />} title="Nothing in review" />
            ) : (
              <div className="gm-tablewrap">
                {/* `--tight` buys back the room this extract does not have:
                    smaller slab, less padding, chips sized to their words.

                    `--left` ranges every column left. These figures are read
                    across the row rather than compared down the column, so
                    right-aligning two of them only opened a gap in each
                    line. */}
                <table className="gm-table gm-table--left gm-table--tight">
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Tier</th>
                      <th>State</th>
                      <th>Ask</th>
                      <th>Time left</th>
                      <th>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.slice(0, SLA_ROWS).map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="gm-cell-user">
                            <Slab grader={s.grader} grade={s.grade} art={s.art} size="sm" />
                            {/* Two lines, not three. The seller's handle and
                                sale count were the third, and they are the
                                one thing here you cannot act on from the row:
                                a decision is taken on the card, and who is
                                selling it is a reason to open the record
                                rather than a reason to approve or reject
                                where you stand. They cost 17px on every row,
                                which at the height this card was given is a
                                whole extra listing in the extract. */}
                            <div className="gm-cell2">
                              <b>{s.card}</b>
                              <span>
                                {s.grader} {s.grade} · {s.setLine}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Tier tier={s.tier} />
                        </td>
                        <td>
                          <ListingBadge status={s.status} />
                        </td>
                        <td className="gm-strong gm-nowrap">{money(s.askPrice)}</td>
                        <td className="gm-nowrap">
                          {s.slaHours < 0 ? (
                            <span className="gm-badge gm-badge--bad">
                              {Math.abs(s.slaHours)}h over
                            </span>
                          ) : s.slaHours <= 4 ? (
                            <span className="gm-badge gm-badge--warn">{s.slaHours}h</span>
                          ) : (
                            <span className="gm-muted gm-mono">{s.slaHours}h</span>
                          )}
                        </td>
                        {/* Here, and only here, the actions go behind a menu.

                            The queues have a page each and name their actions
                            on the row. This is an extract sharing its width
                            with two other columns, and two coloured buttons
                            were what pushed it past that — a dashboard that
                            has to be scrolled sideways to read a number. It
                            also gains the action that would not have fitted as
                            a third button: a way into the record, for any row
                            you are not sure about. */}
                        <td>
                          <RowMenu
                            label={`Actions for ${s.card}`}
                            actions={[
                              {
                                key: "open",
                                label: "Review this listing",
                                icon: <IconEye />,
                                href: `/admin/listings/${s.id}`,
                              },
                              {
                                key: "approve",
                                label: "Approve and publish",
                                icon: <IconCheck />,
                                onClick: () => approve(s),
                              },
                              {
                                key: "reject",
                                label: "Reject it",
                                icon: <IconXCircle />,
                                onClick: () => {
                                  setReason("");
                                  setRejecting(s);
                                },
                                tone: "danger" as const,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* ================================================ right · the depths

            The heading and its line sit inside the card the four figures are
            on rather than floating above it. A title outside a box that has a
            border of its own reads as a label for the region, and next to two
            cards that name themselves on their own top edge it was the odd
            one out. */}
        <Card className="gm-dash-stand">
          <CardHead title="Where things stand" sub="Each opens the page that owns it" />
          <div className="gm-dash-standbody">
            <LinkStat
              href="/admin/members?scope=market"
              label="Active subscribers"
              value={subscribers.toLocaleString("en-AU")}
            />
            <LinkStat
              href="/admin/listings?view=market"
              label="Live listings"
              value={(stats?.liveListings ?? 0).toLocaleString("en-AU")}
            />
            <LinkStat
              href="/admin/listings?view=queue"
              label="In the review queue"
              value={String(stats?.queueDepth ?? 0)}
            />
            {/* Four rows, and the support desk is not one of them. It had a
                line here briefly; four figures in a column this short each
                get a row you can read at a glance, and five turn the panel
                into a list you scan. The desk keeps its own page and its own
                badge in the nav, which is where its clock is watched. */}
            <LinkStat
              href="/admin/conflicts"
              label="Open reports"
              value={String(stats?.openReports ?? 0)}
            />
          </div>
        </Card>

        {/* =============================================== right · the people

            Faces rather than a bar chart of sign-ups: this panel answers how
            many people are here, and the row underneath is a reminder that
            they are people. Whose faces they are is not a ranking — the
            directory decides the order and this takes the first few — so
            nothing is implied by who is at the front. */}
        <Card className="gm-dash-members">
          <CardHead
            title="Members"
            right={
              <Link href="/admin/members" className="gm-btn gm-btn--sm">
                Directory
                <IconArrowRight />
              </Link>
            }
          />
          <div className="gm-dash-membersbody">
            {members === 0 ? (
              <Empty icon={<IconUsers />} title="Nobody has signed up yet" />
            ) : (
              <>
                <span className="gm-dash-memberscount">{members.toLocaleString("en-AU")}</span>
                <span className="gm-dash-memberslabel">
                  {members === 1 ? "account" : "accounts"} on the marketplace
                </span>
                {/* Stacked front-to-back, first circle on top. The overlap has
                    to fall on the LEFT of each face rather than its right: a
                    photograph survives being clipped either way, and a pair of
                    initials centred in a 44px disc does not — with the later
                    circle in front, every name on the row read as its first
                    letter and half of its second. */}
                <div className="gm-faces">
                  {faces.map((f, i) => (
                    <span
                      key={f.id}
                      className="gm-face"
                      title={f.name}
                      style={{ zIndex: faces.length - i }}
                    >
                      <Avatar initials={f.initials} size="lg" />
                    </span>
                  ))}
                  {overflow > 0 ? (
                    <span className="gm-face gm-face--more" aria-label={`${overflow} more`}>
                      +{overflow.toLocaleString("en-AU")}
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ====================================================== reject modal */}
      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this submission"
        sub="The seller sees the reason you write, word for word."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--danger"
              disabled={reason.trim().length < 8}
              onClick={confirmReject}
            >
              <IconXCircle />
              Reject and notify
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setRejecting(null)}>
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Written to the audit log</span>
          </>
        }
      >
        {rejecting ? (
          <>
            <Card pad>
              <div className="gm-row" style={{ gap: 11, flexWrap: "nowrap" }}>
                <Slab
                  grader={rejecting.grader}
                  grade={rejecting.grade}
                  art={rejecting.art}
                />
                <div className="gm-cell2">
                  <b>{rejecting.card}</b>
                  <span>
                    {rejecting.grader} {rejecting.grade} · {money(rejecting.askPrice)} ·{" "}
                    {rejecting.seller.handle}
                  </span>
                </div>
              </div>
            </Card>

            <Note tone="bad">
              Three rejections inside 30 days triggers an automatic member review. The reason is
              written to the member&rsquo;s record either way.
            </Note>

            <div className="gm-field">
              <label className="gm-label" htmlFor="gm-dash-reason">
                Reason shown to the seller
              </label>
              <textarea
                id="gm-dash-reason"
                className="gm-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Be specific. The seller acts on this."
              />
              <span className="gm-hint">
                At least 8 characters. This is what the seller is told.
              </span>
            </div>
          </>
        ) : null}
      </Modal>

      {toast ? (
        <Toast title={toast.title} body={toast.body} onDone={() => setToast(null)} />
      ) : null}
    </div>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedDashboardPage() {
  return (
    <Gate need="dashboard.read">
      <DashboardPage />
    </Gate>
  );
}
