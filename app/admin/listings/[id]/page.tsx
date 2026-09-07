"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  checksFor,
  flagsFor,
  IN_QUEUE,
  MIN_ANGLES,
  money,
  num,
  shortDate,
  type ListingStatus,
} from "../../lib/data";
import {
  ApiError,
  claimListing,
  decideListing,
  fetchListing,
  setMarketState,
  type AdminListing,
  type Comp,
  type Photo,
} from "../../lib/api";
import {
  ActionBar,
  Badge,
  Card,
  CardBody,
  CardHead,
  CheckList,
  ConfidenceBadge,
  DL,
  GameChip,
  ListingBadge,
  Loading,
  Modal,
  Note,
  PageHead,
  Slab,
  Tier,
  Toast,
} from "../../components/ui";
import {
  IconAlert,
  IconBan,
  IconCheck,
  IconExternal,
  IconMail,
  IconNote,
  IconUsers,
  IconX,
  IconXCircle,
} from "../../components/icons";
import { Gate } from "../../components/Gate";
import { useRole } from "../../components/RoleContext";

/**
 * One listing, as a page.
 *
 * This was a window over the queue, and the decision it exists to take was a
 * second window on top of that one — a dialog inside a dialog, each with its
 * own scrim, its own scroll lock and its own footer of buttons. Two overlays
 * deep is where a console stops being navigable: there is no back, no address
 * for the thing you are looking at, and on a laptop the inner footer was
 * pushed off the bottom of the outer one.
 *
 * So the record is a route. It has a URL that can be sent to a colleague, a
 * way back that is visible before anything is scrolled, and exactly one
 * overlay left: the confirmation that takes the reason for the decision.
 */

type Decision = "approve" | "reject" | "request";

const DECISION_COPY: Record<
  Decision,
  { title: string; sub: string; cta: string; tone: string; status: ListingStatus }
> = {
  approve: {
    title: "Approve and publish",
    sub: "It goes on the market the moment this is confirmed. There is no second step.",
    cta: "Approve and publish",
    tone: "gm-btn--primary",
    status: "live",
  },
  reject: {
    title: "Reject this listing",
    sub: "The seller is told why, word for word, and the reason is filed on their record.",
    cta: "Reject and notify",
    tone: "gm-btn--danger",
    status: "rejected",
  },
  request: {
    title: "Ask the seller for more",
    sub: "The listing pauses and the review clock stops until they reply.",
    cta: "Send the request",
    tone: "gm-btn--gold",
    status: "info-requested",
  },
};

/** One line of the seller's listing history, as the API returns it. */
type HistoryEntry = {
  id: string;
  card: string;
  setName: string | null;
  status: string;
  price: number;
  reason: string | null;
  by: string | null;
  at: string;
};

type OpenRecord = {
  listing: AdminListing;
  comps: Comp[];
  photos: Photo[];
  history: HistoryEntry[];
};

/**
 * One angle's photograph, or the honest word for why it isn't there.
 *
 * A browser's own broken-image icon does not say which of two very
 * different things happened: a seller who never sent this angle, or a
 * seller who sent it and our storage lost it. Those are opposite findings
 * — one is filed against the seller, one against us — and drawn the same
 * way next to the dashed "missing" tiles, a failed fetch reads as a gap
 * the seller left. This renders the real photo until the browser reports
 * it could not load, then swaps to a tile that says so in words, so the
 * two cases can never be mistaken for each other.
 */
function Angle({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="gm-photo-failed">
        <IconAlert />
        Would not load
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={label}
      loading="lazy"
      style={{
        width: "100%",
        aspectRatio: "3 / 4",
        objectFit: "cover",
        borderRadius: "var(--r-sm)",
        background: "var(--surface-2)",
        boxShadow: "var(--sh-1)",
        display: "block",
      }}
      onError={() => setFailed(true)}
    />
  );
}

/** The store's own status words, in the console's vocabulary. Only the
 *  history feed needs this — everything else arrives already translated. */
function historyStatus(s: string): ListingStatus {
  return s === "in_review"
    ? "awaiting"
    : s === "info_requested"
      ? "info-requested"
      : (["live", "sold", "paused", "rejected"].includes(s) ? s : "withdrawn") as ListingStatus;
}

/** The minimum a reason has to be before it is worth recording. */
const REASON_MIN = 8;

function ListingRecord() {
  const { me } = useRole();
  const id = String(useParams().id ?? "");

  const [record, setRecord] = useState<OpenRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string; tone?: "ok" | "bad" } | null>(
    null,
  );

  const open = record?.listing ?? null;
  const priceComps = record?.comps ?? [];
  const photoSet = record?.photos ?? [];
  const sellerRecord = record?.history ?? [];

  /* Read the record, and take it if it is still waiting on a decision, so a
     second moderator does not work the same card. A claim that fails is not an
     error — somebody else has it, and reading a listing you cannot decide is a
     normal thing to do. */
  useEffect(() => {
    if (!id) return;
    let live = true;
    setError(null);
    fetchListing(id)
      .then(async (r) => {
        if (!live) return;
        const rec = r as OpenRecord;
        setRecord(rec);
        if (!IN_QUEUE.includes(rec.listing.status)) return;
        try {
          await claimListing(id);
          const fresh = (await fetchListing(id)) as OpenRecord;
          if (live) setRecord(fresh);
        } catch (e) {
          if (live && e instanceof ApiError && e.code !== "already-claimed") {
            setToast({ title: "Could not claim it", body: e.message, tone: "bad" });
          }
        }
      })
      .catch((e) => {
        if (live) setError(e instanceof ApiError ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, [id]);

  function startDecision(d: Decision) {
    setReason("");
    setDecision(d);
  }

  /** How far short of the minimum the reason is. An approval needs none. */
  const short =
    decision === null || decision === "approve"
      ? 0
      : Math.max(0, REASON_MIN - reason.trim().length);

  async function commit() {
    if (!open || !decision || busy) return;
    setBusy(true);
    try {
      const { listing, decidedBy } = await decideListing(
        open.id,
        decision,
        reason.trim(),
        decision === "approve" ? reason.trim() : undefined,
      );
      setDecision(null);
      setReason("");
      /* The record stays on screen carrying its new state rather than throwing
         the moderator back at the queue. What changed is the thing they were
         looking at, and the queue is one arrow away. */
      setRecord((r) => (r ? { ...r, listing } : r));
      setToast({
        title:
          decision === "approve"
            ? "Published to the market"
            : decision === "reject"
              ? "Rejected and the seller told"
              : "Request sent",
        body: `${listing.card} · decided by ${decidedBy} · the seller has been notified`,
      });
    } catch (e) {
      /* The API refuses a rejection with no reason, and refuses a transition
         the state machine does not allow. Both arrive here, and both are worth
         reading rather than swallowing — the listing did not move. */
      setToast({
        title: "The decision did not go through",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
    } finally {
      setBusy(false);
    }
  }

  /** Pause, resume, withdraw — the levers on something already on sale. */
  async function setMarketStatus(action: "pause" | "resume" | "withdraw", title: string) {
    if (!open) return;
    try {
      const updated = await setMarketState(open.id, action);
      setRecord((r) => (r ? { ...r, listing: updated } : r));
      setToast({ title, body: `${open.card} · written to the audit log` });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
    }
  }

  const back = { href: "/admin/listings", label: "Listing queue" };

  if (error) {
    return (
      <>
        <PageHead title="Listing" back={back} />
        <Note tone="bad">
          <b>That listing could not be read.</b> {error}
        </Note>
      </>
    );
  }

  if (!open) {
    return (
      <>
        <PageHead title="Opening…" back={back} />
        <Card>
          <Loading label="Reading the listing…" />
        </Card>
      </>
    );
  }

  const waiting = IN_QUEUE.includes(open.status);

  return (
    <>
      <PageHead
        title={open.card}
        sub={`${open.grader} ${open.grade} · ${open.setLine}`}
        back={back}
        right={<ListingBadge status={open.status} />}
      />

      <div className="gm-stack">
        {/* ------------------------------------------------ what it is */}
        <Card pad>
          <div className="gm-record-top">
            <Slab grader={open.grader} grade={open.grade} art={open.art} size="lg" />
            <div className="gm-stack" style={{ gap: 10, minWidth: 0 }}>
              <div className="gm-row" style={{ gap: 7 }}>
                <Tier tier={open.tier} />
                <GameChip game={open.game} />
                <ListingBadge status={open.status} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-0.03em" }}>
                  {money(open.askPrice)}
                </div>
                <div className="gm-sm gm-muted">
                  {/* Where the figure came from, said plainly. A median of our
                      own confirmed sales and a snapshot taken when the seller
                      priced the card are not the same claim, and a moderator
                      deciding whether an ask is fair needs to know which one
                      is on screen. */}
                  {open.marketSource === "comps"
                    ? `Market ${money(open.marketPrice)}, the median of ${open.sampleSize} confirmed ${open.grader} ${open.grade} sale${open.sampleSize === 1 ? "" : "s"}`
                    : open.marketSource === "listing"
                      ? `Market ${money(open.marketPrice)}, quoted to the seller when they listed it. No confirmed ${open.grader} ${open.grade} sale has been recorded since.`
                      : "No market figure. Too few comparable sales to quote one."}
                </div>
              </div>
              <ConfidenceBadge level={open.confidence} sample={open.sampleSize} />
              {/* The queue no longer carries the ask, the market figure or how
                  long this has been waiting — a triage table cannot be read at
                  seven columns wide. They are here, where there is room for
                  the sentence that makes each of them mean something. */}
              <div className="gm-row gm-tiny gm-dim" style={{ gap: 10 }}>
                <span>
                  {num(open.views)} views · {num(open.watchers)} watching
                </span>
                <span>Submitted {shortDate(open.submitted)}</span>
                {waiting ? (
                  open.slaHours < 0 ? (
                    <Badge tone="bad">{Math.abs(open.slaHours)}h over the review target</Badge>
                  ) : (
                    <span>{open.slaHours}h left on the review clock</span>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        {open.note ? (
          <Note>
            <b>Moderator note.</b> {open.note}
          </Note>
        ) : null}

        {/* -------------------------------------------------- the comps

            A sample count and a confidence badge say a figure was worked out;
            they do not say from what. A moderator deciding whether an ask is
            fair needs the sales themselves, and needs to see that every one of
            them is the same grader and grade — this is the only place that rule
            is visible rather than asserted.
        */}
        <Card>
          <CardHead
            title="What the price is built on"
            sub={`Confirmed ${open.grader} ${open.grade} sales only, never converted from another grading company`}
          />
          <CardBody style={{ paddingTop: 8 }}>
            {priceComps.length === 0 ? (
              <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                No confirmed sale on record at this grader and grade. That is what the
                low-confidence badge above is saying. The figure is withheld rather than guessed
                from a neighbouring grade.
              </p>
            ) : (
              <div className="gm-feed">
                {priceComps.map((c) => (
                  <div key={c.id} className="gm-feed-item">
                    <span
                      className={`gm-feed-ico ${
                        c.outlier ? "gm-feed-ico--bad" : "gm-feed-ico--ok"
                      }`}
                    >
                      {c.outlier ? <IconAlert /> : <IconCheck />}
                    </span>
                    <div className="gm-feed-body">
                      <p className="gm-row" style={{ gap: 8 }}>
                        <b style={c.outlier ? { opacity: 0.6 } : undefined}>{money(c.price)}</b>
                        {c.outlier ? <Badge tone="bad">Excluded as an outlier</Badge> : null}
                      </p>
                      {c.outlier && c.why ? <p className="gm-sm gm-muted">{c.why}</p> : null}
                      <div className="gm-feed-time">
                        {c.grader} {c.grade} · sold {shortDate(c.soldAt)} ·{" "}
                        <span className="gm-mono">{c.ref}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Automatic checks"
            sub={`${flagsFor(open).length} of ${checksFor(open).length} raised a flag`}
          />
          <CardBody style={{ paddingTop: 8 }}>
            <CheckList checks={checksFor(open)} />
          </CardBody>
        </Card>

        <div className="gm-grid gm-grid--2">
          <Card>
            <CardHead title="Listing" />
            <CardBody>
              <DL
                rows={[
                  ["Grading company", open.grader],
                  ["Stated grade", `${open.grader} ${open.grade}`],
                  [
                    "Label reads",
                    open.labelGrade && open.labelGrade !== open.grade ? (
                      <Badge tone="bad">
                        {open.grader} {open.labelGrade}
                      </Badge>
                    ) : (
                      <span className="gm-muted">Matches the stated grade</span>
                    ),
                  ],
                  ["Certificate", <span className="gm-mono">{open.cert}</span>],
                  ["Set", open.setLine],
                  ["Ask", money(open.askPrice)],
                  [
                    "Market",
                    open.marketPrice > 0 ? money(open.marketPrice) : "No figure quoted",
                  ],
                  ["Angles supplied", `${open.photos}`],
                  ["Submitted", shortDate(open.submitted)],
                  open.releasedAt
                    ? [
                        "Published",
                        `${shortDate(open.releasedAt)} by ${open.reviewedBy ?? "auto-clear"}`,
                      ]
                    : [
                        "Review clock",
                        open.slaHours < 0 ? (
                          <Badge tone="bad">{Math.abs(open.slaHours)}h over</Badge>
                        ) : (
                          <span>{open.slaHours}h remaining</span>
                        ),
                      ],
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Seller" />
            <CardBody>
              <div className="gm-row" style={{ gap: 11, marginBottom: 12, flexWrap: "nowrap" }}>
                <div className="gm-cell2">
                  <b style={{ fontSize: 14.5 }}>{open.seller.name}</b>
                  <span>{open.seller.handle}</span>
                </div>
                <Link
                  className="gm-btn gm-btn--sm gm-spacer"
                  href={`/admin/members?scope=market&q=${encodeURIComponent(open.seller.handle)}`}
                >
                  <IconExternal />
                  Profile
                </Link>
              </div>
              <DL
                rows={[
                  ["Completed sales", num(open.seller.sales)],
                  ["Rating", `${open.seller.rating.toFixed(1)} / 5.0`],
                  ["Reviews received", num(open.seller.reviews)],
                ]}
              />
            </CardBody>
          </Card>
        </div>

        {/* What this seller has been decided on before. Read from the listings
            themselves rather than from a separate record store, so it cannot
            disagree with the queue. */}
        <Card>
          <CardHead
            title="This seller's other listings"
            sub={`${sellerRecord.length} decided · every decision here is filed against ${open.seller.handle}`}
          />
          <CardBody style={{ paddingTop: 8 }}>
            {sellerRecord.length === 0 ? (
              <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                This is their first listing. The decision you take here starts the record.
              </p>
            ) : (
              <div className="gm-feed">
                {sellerRecord.map((e) => (
                  <div key={e.id} className="gm-feed-item">
                    <span
                      className={`gm-feed-ico${
                        e.status === "live" || e.status === "sold"
                          ? " gm-feed-ico--ok"
                          : e.status === "rejected"
                            ? " gm-feed-ico--bad"
                            : e.status === "info_requested"
                              ? " gm-feed-ico--warn"
                              : " gm-feed-ico--gold"
                      }`}
                    >
                      {e.status === "live" || e.status === "sold" ? (
                        <IconCheck />
                      ) : e.status === "info_requested" ? (
                        <IconMail />
                      ) : e.status === "rejected" ? (
                        <IconXCircle />
                      ) : (
                        <IconNote />
                      )}
                    </span>
                    <div className="gm-feed-body">
                      <p className="gm-row" style={{ gap: 8 }}>
                        <b>{e.card}</b>
                        <ListingBadge status={historyStatus(e.status)} />
                      </p>
                      {e.reason ? <p className="gm-sm gm-muted">{e.reason}</p> : null}
                      <div className="gm-feed-time">
                        {money(e.price)}
                        {e.setName ? ` · ${e.setName}` : ""}
                        {e.by ? ` · ${e.by}` : ""} · {shortDate(e.at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Photo set"
            sub={`${open.photos} of ${MIN_ANGLES} angles: front, back, four slab edges, four corners`}
          />
          <CardBody>
            <div className="gm-photogrid">
              {/* The photographs themselves. The angle is the label, because
                  "photo 7" is not a thing a moderator can check and
                  "back-left corner" is. */}
              {photoSet.map((ph, i) => (
                /* Keyed on the position, not the URL: a seller who shoots four
                   corners against the same background can and does upload the
                   same file twice, and React needs the two to stay two
                   things. */
                <figure key={`${i}-${ph.angle ?? ""}`} style={{ margin: 0 }}>
                  <Angle url={ph.url} label={ph.angle ?? `Angle ${i + 1}`} />
                  <figcaption
                    className="gm-tiny gm-dim"
                    style={{ marginTop: 4, textAlign: "center" }}
                  >
                    {ph.angle ?? i + 1}
                  </figcaption>
                </figure>
              ))}
              {/* the gaps, drawn as gaps: an angle that was not supplied is the
                  finding, and an absence is invisible without a slot */}
              {Array.from({ length: Math.max(0, MIN_ANGLES - photoSet.length) }).map((_, i) => (
                <div key={`missing-${i}`} className="gm-photo-missing">
                  missing
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* -------------------------------------------------- the actions */}
        <ActionBar
          note={
            waiting
              ? "Every decision is written to the audit log"
              : open.status === "live" || open.status === "paused"
                ? "Written to the audit log"
                : undefined
          }
        >
          {waiting ? (
            <>
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                onClick={() => startDecision("approve")}
              >
                <IconCheck />
                Approve and publish
              </button>
              <button
                type="button"
                className="gm-btn gm-btn--gold"
                onClick={() => startDecision("request")}
              >
                <IconMail />
                Ask for more
              </button>
              <button
                type="button"
                className="gm-btn gm-btn--danger"
                onClick={() => startDecision("reject")}
              >
                <IconX />
                Reject
              </button>
            </>
          ) : open.status === "live" ? (
            <>
              <button
                type="button"
                className="gm-btn gm-btn--gold"
                onClick={() => setMarketStatus("pause", "Paused")}
              >
                Pause
              </button>
              <button
                type="button"
                className="gm-btn gm-btn--danger"
                onClick={() => setMarketStatus("withdraw", "Withdrawn")}
              >
                <IconBan />
                Withdraw
              </button>
            </>
          ) : open.status === "paused" ? (
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              onClick={() => setMarketStatus("resume", "Back on the market")}
            >
              <IconCheck />
              Put it back on the market
            </button>
          ) : (
            <span className="gm-sm gm-muted">
              This listing is closed. Reopening it is an audit-log action.
            </span>
          )}
        </ActionBar>
      </div>

      {/* ============================================================= modal

          The one overlay left on this route, and the only one that earns it:
          a decision that cannot be taken without a reason typed first.
      */}
      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision ? DECISION_COPY[decision].title : ""}
        sub={decision ? DECISION_COPY[decision].sub : ""}
        footer={
          <>
            <button
              type="button"
              className={`gm-btn ${decision ? DECISION_COPY[decision].tone : ""}`}
              disabled={short > 0 || busy}
              onClick={commit}
            >
              {decision === "approve" ? (
                <IconCheck />
              ) : decision === "reject" ? (
                <IconXCircle />
              ) : (
                <IconMail />
              )}
              {busy ? "Sending…" : decision ? DECISION_COPY[decision].cta : ""}
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setDecision(null)}>
              Cancel
            </button>
            {/* Why the button is off, beside the button. It used to sit greyed
                with the requirement in a hint under the textarea, which is the
                wrong place: the thing you are looking at when nothing happens
                is the button. */}
            <span className="gm-spacer gm-tiny gm-dim">
              {short > 0
                ? `${short} more character${short === 1 ? "" : "s"} needed`
                : "Written to the audit log"}
            </span>
          </>
        }
      >
        {decision ? (
          <>
            <Card pad>
              <div className="gm-row" style={{ gap: 11, flexWrap: "nowrap" }}>
                <Slab grader={open.grader} grade={open.grade} art={open.art} />
                <div className="gm-cell2">
                  <b>{open.card}</b>
                  <span>
                    {open.grader} {open.grade} · {money(open.askPrice)} · {open.seller.handle}
                  </span>
                </div>
              </div>
            </Card>

            {decision === "approve" ? (
              flagsFor(open).length > 0 ? (
                <Note tone="warn">
                  <b>
                    {flagsFor(open).length} flag{flagsFor(open).length > 1 ? "s are" : " is"} still
                    open on this listing.
                  </b>{" "}
                  Approving publishes it anyway, and the flags stay on the record against your
                  name.
                </Note>
              ) : (
                <Note tone="gold">
                  Every check passed. It goes on the market immediately, and the photo set and cert
                  as reviewed are frozen against the listing, so a later swap is detectable.
                </Note>
              )
            ) : decision === "reject" ? (
              <Note tone="bad">
                The seller sees the reason below, word for word. Three rejections inside 30 days
                triggers an automatic member review.
              </Note>
            ) : (
              <Note>
                The review clock stops until the seller replies. They get one reminder at 48 hours,
                then the listing expires at seven days.
              </Note>
            )}

            <div className="gm-field">
              <label className="gm-label" htmlFor="gm-listing-reason">
                {decision === "approve"
                  ? "Note for the record (optional)"
                  : decision === "reject"
                    ? "Reason shown to the seller"
                    : "What do you need from the seller?"}
              </label>
              <textarea
                id="gm-listing-reason"
                className="gm-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  decision === "approve"
                    ? "Cert matched the register, photos consistent with the label."
                    : decision === "reject"
                      ? "Be specific. The seller acts on this."
                      : "A straight-on photo of the subgrade block, and the original invoice."
                }
              />
              {decision !== "approve" ? (
                <span className="gm-hint">
                  At least {REASON_MIN} characters. This is what the seller is told.
                </span>
              ) : null}
            </div>

            {/* No ambiguity about where this lands — the entry is shown before
                it is filed, not summarised afterwards in a toast. */}
            <Card pad>
              <div className="gm-row" style={{ gap: 8, marginBottom: 7 }}>
                <IconUsers style={{ width: 14, height: 14, color: "var(--ink-4)" }} />
                <b className="gm-sm">Filed on {open.seller.handle}&rsquo;s record as</b>
              </div>
              <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                <b className="gm-strong">
                  {decision === "approve"
                    ? "Listing approved"
                    : decision === "reject"
                      ? "Listing rejected"
                      : "More information requested"}{" "}
                  · {open.card}
                </b>
                {reason.trim() ? <> · &ldquo;{reason.trim()}&rdquo;</> : null} · {me?.name ?? "you"}
              </p>
            </Card>
          </>
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

/* Access is decided before the page renders, not inside it — see the warning
   in RoleContext about what this gate is and is not. */
export default function GatedListingRecord() {
  return (
    <Gate need="listings.review">
      <ListingRecord />
    </Gate>
  );
}
