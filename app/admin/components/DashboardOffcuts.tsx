"use client";

import Link from "next/link";
import { Badge, Gauge, Note } from "./ui";
import { IconArrowRight } from "./icons";
import type { Dashboard } from "../lib/api";

/**
 * Two panels that came off the dashboard when it was rebuilt to the
 * three-column reference layout, kept here rather than deleted.
 *
 * The new grid has six slots and they are all spoken for, so the verification
 * dial and the support desk extract had nowhere to sit. Neither is wrong and
 * neither was replaced by anything that says the same thing — the support
 * queue survives on the new dashboard only as a figure in "Where things
 * stand" — so both are parked here with their reasoning intact. Nothing
 * imports this file. It exists so that putting either panel back is a
 * decision rather than a rewrite.
 */

/* ==========================================================================
   Verification — new accounts over the last 30 days
   ========================================================================== */

/**
 * A dial and three figures, not a funnel.
 *
 * `Funnel` draws a bar per stage with the drop-off written under each one,
 * and it earns that when there are four or five steps to lose people between.
 * There are two — an account is created and the provider either approves it
 * or has not yet — so it was three quarters of a panel of chrome around one
 * number, and the two full-width bars at the same length said "nothing has
 * gone wrong" in the loudest way available.
 *
 * The dial IS that number, the rows beside it are the counts it came from,
 * and the layout runs across rather than down so the panel fills its half of
 * the row instead of leaving the bottom third empty.
 */
export function VerificationPanel({ funnel }: { funnel: Dashboard["funnel"] }) {
  /** Everyone the provider has not answered on yet. */
  const waiting =
    funnel.length > 1 ? Math.max(0, funnel[0].value - funnel[funnel.length - 1].value) : 0;

  /* How much of the intake came out the far end. Null rather than 0% when
     nobody signed up in the period: no cohort is not a cohort that failed. */
  const funnelEnd =
    funnel.length > 1 && funnel[0].value > 0
      ? Math.round((funnel[funnel.length - 1].value / funnel[0].value) * 100)
      : null;

  return (
    <section>
      <div className="gm-blockhead">
        <h3>Verification</h3>
        <p>New accounts, last 30 days</p>
      </div>

      <div className="gm-well gm-verif-box">
        <div className="gm-verif">
          {funnel.length === 0 ? (
            <p className="gm-sm gm-muted" style={{ margin: 0 }}>
              Nobody has signed up in the last 30 days.
            </p>
          ) : (
            <>
              <div className="gm-verif-dial">
                <Gauge
                  value={funnelEnd ?? 0}
                  label={`${funnelEnd ?? 0}%`}
                  caption="verified"
                  gradient={{ from: "var(--gold-lift)", to: "var(--gold-sink)" }}
                  size={124}
                  thickness={12}
                />
              </div>
              <div className="gm-verif-rows">
                {funnel.map((stage) => (
                  <div key={stage.key} className="gm-verif-row">
                    <span>{stage.label}</span>
                    <b>{stage.value.toLocaleString("en-AU")}</b>
                  </div>
                ))}
                {/* The gap between the two, named. It is the only number
                    here anybody can act on — everyone still sitting with
                    the provider — and it was previously something you had
                    to work out by subtracting one bar from another. */}
                <div className="gm-verif-row gm-verif-row--wait">
                  <span>Waiting on the provider</span>
                  <b>{waiting.toLocaleString("en-AU")}</b>
                </div>
              </div>
            </>
          )}
        </div>
        {/* Inside the box and pinned to its foot. It sat underneath as
            loose text, which left the panel ending in two places — the
            well at one height and the sentence at another — beside a
            revenue panel that ended cleanly at its border. */}
        <p className="gm-verif-note">
          The decision is the provider&rsquo;s, against the DVS. We hold the outcome only. No
          documents reach this database.
        </p>
      </div>
    </section>
  );
}

/* ==========================================================================
   The support desk — the one queue with a clock on it
   ========================================================================== */

/**
 * This was "Latest activity", and before that "Review mix" — a ring splitting
 * the review queue by tier, which the dashboard's own table already lists in
 * full.
 *
 * Support is the gap those two were standing in. The console has a whole
 * section for it with a first-reply target attached, and the dashboard — a
 * page whose entire job is telling you what is waiting — had no idea it
 * existed. The listing queue gets a headline, a count, a table and a chart;
 * the one queue with a clock on it got nothing.
 *
 * The three numbers are the states an agent picks work from, the warning only
 * appears when something has actually gone past its target, and the ticket
 * named at the foot is the one to open next. It rides in the same single
 * dashboard read for the reason the store's own header gives.
 */
export function SupportDeskPanel({ support }: { support: Dashboard["support"] }) {
  return (
    <section>
      <div className="gm-blockhead">
        <h3>Support desk</h3>
        <p>{support.live === 0 ? "Nothing open" : `${support.live} open`}</p>
        <Link href="/admin/support" className="gm-spacer gm-btn gm-btn--sm">
          Open queue
          <IconArrowRight />
        </Link>
      </div>

      <div className="gm-well gm-support">
        <div className="gm-support-nums">
          <div className="gm-support-num">
            <b>{support.fresh}</b>
            <span>Unanswered</span>
          </div>
          <div className="gm-support-num">
            <b>{support.waiting}</b>
            <span>With the member</span>
          </div>
        </div>

        {/* Only when it is true. A green "0 past target" on a desk that is
            keeping up is a line nobody needs to read every morning, and it
            takes the room the warning would want. */}
        {support.breaching > 0 ? (
          <Note tone="bad">
            <b>{support.breaching} past the first-reply target.</b> Answer{" "}
            {support.breaching === 1 ? "it" : "those"} before anything newer.
          </Note>
        ) : null}

        {support.oldest ? (
          <Link href={`/admin/support/${support.oldest.id}`} className="gm-support-next">
            <span className="gm-support-next-label">Oldest unanswered</span>
            <span className="gm-support-next-subject">{support.oldest.subject}</span>
            <span className="gm-support-next-sla">
              {support.oldest.slaHours < 0 ? (
                <Badge tone="bad">{Math.abs(support.oldest.slaHours)}h over</Badge>
              ) : (
                <Badge tone="ok">{support.oldest.slaHours}h left</Badge>
              )}
            </span>
          </Link>
        ) : (
          <p className="gm-sm gm-muted" style={{ margin: 0 }}>
            {support.live === 0
              ? "Nobody has written in."
              : "Every ticket has had a first reply."}
          </p>
        )}
      </div>
    </section>
  );
}
