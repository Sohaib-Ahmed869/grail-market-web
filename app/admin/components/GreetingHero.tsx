"use client";

import Link from "next/link";
import { Slab } from "./ui";
import { IconShield } from "./icons";
import { useRole } from "./RoleContext";

/**
 * The dashboard's old opening panel, lifted off the page on request.
 *
 * It is kept here verbatim rather than deleted because it is the only piece
 * of the console that greets the person using it by name, and because the
 * fanned trail of real card art behind it took a script and a set of assets
 * to build. Nothing imports this today — it is reference, not dead code
 * somebody forgot to remove — and it is deliberately self-contained so that
 * putting it back is one import and one tag rather than an archaeology
 * exercise across the page it came off.
 */

/* The fan behind the greeting. Real card art, pulled once into public/cards/
   by `scripts/fetch-card-art.mjs`. Fixed values rather than random so the
   server and the client render the same markup. */
const TRAIL: { grader: string; grade: string; art: string; fan: string }[] = [
  { grader: "PSA", grade: "9", art: "yugioh-blue-eyes", fan: "-13deg" },
  { grader: "BGS", grade: "9.5", art: "magic-mox-sapphire", fan: "-6deg" },
  { grader: "PSA", grade: "10", art: "pokemon-charizard", fan: "1deg" },
  { grader: "CGC", grade: "8.5", art: "magic-black-lotus", fan: "8deg" },
  { grader: "PSA", grade: "10", art: "pokemon-umbreon", fan: "15deg" },
];

export function GreetingHero({
  waiting,
  breached,
}: {
  /** How many listings are sitting in the review queue right now. */
  waiting: number;
  /** How many of those are already past the 24-hour target. */
  breached: number;
}) {
  /* Whoever is signed in, from the session. There is no fixture operator
     here and the greeting is never addressed to an invented person. */
  const { me } = useRole();
  const firstName = (me?.name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <section className="gm-hero">
      <div className="gm-hero-copy">
        {/* The date, and the greeting, from the clock rather than
            written into the markup — it said "Sunday · 1 September" on
            every day of the year. */}
        <div className="gm-hero-eyebrow">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <h2>
          {greeting}, {firstName}. <em>{waiting} card{waiting === 1 ? "" : "s"}</em>{" "}
          {waiting === 1 ? "is" : "are"} waiting on you.
        </h2>
        <p>
          {breached > 0
            ? `${breached} already past the 24-hour target.`
            : "All inside the 24-hour target."}{" "}
          Nothing here clears itself.
        </p>
        <div className="gm-hero-actions">
          <Link href="/admin/listings" className="gm-btn gm-btn--primary">
            <IconShield />
            Open the queue
          </Link>
          {/* No Export here. The queue page owns the queue and exports
              it with the filters applied; a second button on the greeting
              exporting the same rows unfiltered is a second answer to the
              same question. */}
        </div>
      </div>

      <div className="gm-hero-trail">
        {TRAIL.map((c, i) => (
          <span key={i} style={{ "--fan": c.fan } as React.CSSProperties}>
            <Slab grader={c.grader} grade={c.grade} art={c.art} size="lg" />
          </span>
        ))}
      </div>
    </section>
  );
}
