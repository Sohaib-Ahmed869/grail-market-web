"use client";

import Link from "next/link";
import { conflicts, gmvSeries, money, operator, queueMix, submissions } from "./lib/data";
import { AreaChart, Donut, LinkStat, Slab, Tier, VerificationBadge } from "./components/ui";
import { IconArrowRight, IconDownload, IconShield } from "./components/icons";

/* One screen, no scroll. The greeting, the chart and the overdue list stack in
   the left column; the rail runs the full height beside them rather than
   sitting under the chart. That is what lifts the standings, the review mix
   and the overdue table above the fold.

   Anything that is only a number lives in the rail as a link to the page that
   owns it — a tile that states a figure and goes nowhere is a poster, not a
   control. */
const SLA_ROWS = 4;

/* The fan behind the greeting. Real card art, pulled once into public/cards/
   by `scripts/fetch-card-art.mjs`. Fixed values rather than random so the
   server and the client render the same markup. */
const TRAIL: {
  grader: string;
  grade: string;
  game: string;
  art: string;
  fan: string;
  delay: string;
}[] = [
  { grader: "PSA", grade: "9", game: "Yu-Gi-Oh!", art: "yugioh-blue-eyes", fan: "-13deg", delay: "-2.4s" },
  { grader: "BGS", grade: "9.5", game: "Magic", art: "magic-mox-sapphire", fan: "-6deg", delay: "-1.2s" },
  { grader: "PSA", grade: "10", game: "Pokémon", art: "pokemon-charizard", fan: "1deg", delay: "0s" },
  { grader: "CGC", grade: "8.5", game: "Magic", art: "magic-black-lotus", fan: "8deg", delay: "-1.8s" },
  { grader: "PSA", grade: "10", game: "Pokémon", art: "pokemon-umbreon", fan: "15deg", delay: "-3.1s" },
];

export default function DashboardPage() {
  const urgent = submissions
    .filter((s) => s.status === "awaiting" || s.status === "in-review" || s.status === "info-requested")
    .sort((a, b) => a.slaHours - b.slaHours)
    .slice(0, SLA_ROWS);

  const openConflicts = conflicts.filter((c) => c.status !== "resolved");
  const held = openConflicts.reduce((sum, c) => sum + (c.heldFunds ? c.amount : 0), 0);
  const pending = submissions.filter((s) => s.status !== "verified" && s.status !== "rejected");
  const breached = pending.filter((s) => s.slaHours < 0).length;

  return (
    <div className="gm-dash">
      {/* ==================================================== left column */}
      <div className="gm-dash-main">
        <section className="gm-hero">
          <div className="gm-hero-copy">
            <div className="gm-hero-eyebrow">Sunday · 1 September</div>
            <h2>
              Morning, {operator.name.split(" ")[0]}. <em>{pending.length} cards</em> are waiting
              on you.
            </h2>
            <p>
              {breached > 0
                ? `${breached} already past the 24-hour target.`
                : "All inside the 24-hour target."}{" "}
              Nothing here clears itself.
            </p>
            <div className="gm-hero-actions">
              <Link href="/admin/verification" className="gm-btn gm-btn--primary">
                <IconShield />
                Open the queue
              </Link>
              <button type="button" className="gm-btn">
                <IconDownload />
                Export
              </button>
            </div>
          </div>

          <div className="gm-hero-trail">
            {TRAIL.map((c, i) => (
              <span
                key={i}
                style={{ "--fan": c.fan, animationDelay: c.delay } as React.CSSProperties}
              >
                <Slab grader={c.grader} grade={c.grade} game={c.game} art={c.art} size="lg" />
              </span>
            ))}
          </div>
        </section>

        <section>
          <div className="gm-blockhead">
            <h3>Marketplace volume</h3>
            <p>Twelve weeks · GMV against verifications cleared</p>
            <span className="gm-spacer gm-badge gm-badge--gold">+11.4%</span>
          </div>
          <div className="gm-well">
            <AreaChart data={gmvSeries} height={152} />
          </div>
        </section>

        <section>
          <div className="gm-blockhead">
            <h3>Closest to breaching</h3>
            <p>Sorted by time left, not by value</p>
            <Link href="/admin/verification" className="gm-spacer gm-btn gm-btn--sm">
              All {pending.length}
              <IconArrowRight />
            </Link>
          </div>

          <div className="gm-well gm-well--flush">
            <div className="gm-tablewrap">
              <table className="gm-table">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th className="gm-num">Ask</th>
                    <th className="gm-num">Time left</th>
                  </tr>
                </thead>
                <tbody>
                  {urgent.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="gm-cell-user">
                          <Slab grader={s.grader} grade={s.grade} game={s.game} art={s.art} size="sm" />
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
                        <VerificationBadge status={s.status} />
                      </td>
                      <td className="gm-num gm-strong">{money(s.askPrice)}</td>
                      <td className="gm-num">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* =========================================================== rail */}
      <aside className="gm-dash-rail">
        <section>
          <div className="gm-blockhead">
            <h3>Where things stand</h3>
            <p>Each opens the page that owns it</p>
          </div>
          <div className="gm-railbox">
            <LinkStat
              href="/admin/verification"
              label="Awaiting verification"
              value={String(pending.length)}
            />
            <LinkStat
              href="/admin/conflicts"
              label={`Held across ${openConflicts.length} conflicts`}
              value={money(held)}
            />
            <LinkStat href="/admin/listings" label="Live on the market" value="$24,290" />
            <LinkStat href="/admin/members" label="Active members" value="6,412" />
          </div>
        </section>

        <section>
          <div className="gm-blockhead">
            <h3>Review mix</h3>
            <p>By tier, right now</p>
          </div>
          <div className="gm-well">
            <Donut slices={queueMix} centerValue="161" centerLabel="in flight" />
          </div>
        </section>
      </aside>
    </div>
  );
}
