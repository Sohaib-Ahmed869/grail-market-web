"use client";

/**
 * The member record, dated.
 *
 * The brief asks for the whole history in one place — listings, offers,
 * trades, reviews, tickets and conduct — which is a different thing from the
 * facts table beside it. A table says what someone *is*; this says what
 * happened, in order, and it is the only view that answers "has this account
 * done this before" without opening four other pages.
 *
 * It reads what the API assembles from the tables that actually hold those
 * events, rather than from a separate history table that would have to be
 * written to from six places and would be wrong the first time one of them
 * forgot. Three of the six exist today; the rest join as they land.
 */

import { useMemo, useState } from "react";
import { shortDate } from "../lib/data";
import type { TimelineEntry } from "../lib/api";
import { Card, CardBody, CardHead } from "./ui";
import { IconCard, IconCheck, IconStar, IconTag, IconXCircle } from "./icons";

type Kind = TimelineEntry["kind"];

const GROUPS: { key: string; label: string; kinds: Kind[] }[] = [
  { key: "listings", label: "Listings", kinds: ["listing"] },
  { key: "offers", label: "Offers", kinds: ["offer"] },
  { key: "reviews", label: "Reviews", kinds: ["review"] },
];

const KIND_LABEL: Record<Kind, string> = {
  listing: "Listing",
  offer: "Offer",
  review: "Review",
};

/**
 * The tone a row reads as.
 *
 * A listing's tone is its outcome, not its kind — approved and rejected are
 * the two things anybody scans this list for, and giving them the same colour
 * makes the list a wall of identical rows.
 */
function toneOf(e: TimelineEntry): "ok" | "warn" | "bad" | "gold" {
  if (e.kind === "review") return "gold";
  if (e.kind === "offer") return e.detail === "declined" ? "bad" : "gold";
  const status = String(e.detail ?? "");
  if (status === "live" || status === "sold") return "ok";
  if (status === "rejected" || status === "withdrawn") return "bad";
  if (status === "info_requested") return "warn";
  return "gold";
}

function KindIcon({ e }: { e: TimelineEntry }) {
  if (e.kind === "review") return <IconStar />;
  if (e.kind === "offer") return <IconTag />;
  return String(e.detail) === "rejected" ? <IconXCircle /> :
    String(e.detail) === "sold" ? <IconCard /> : <IconCheck />;
}

export function MemberTimeline({
  handle,
  entries,
  /** Rendered under the head — the note composer, on the member record. */
  children,
}: {
  handle: string;
  entries: TimelineEntry[];
  children?: React.ReactNode;
}) {
  const [group, setGroup] = useState("all");

  /* Only offer a filter for a group that has something in it — three dead
     buttons is worse than no buttons. */
  const available = useMemo(
    () => GROUPS.filter((g) => entries.some((e) => g.kinds.includes(e.kind))),
    [entries]
  );

  const shown = useMemo(() => {
    if (group === "all") return entries;
    const g = GROUPS.find((x) => x.key === group);
    return g ? entries.filter((e) => g.kinds.includes(e.kind)) : entries;
  }, [entries, group]);

  return (
    <Card>
      <CardHead
        title="Timeline"
        sub={`${entries.length} entr${entries.length === 1 ? "y" : "ies"} · every listing, offer and review on file against ${handle}`}
      />
      <CardBody style={{ paddingTop: 8 }}>
        {children}

        {available.length > 1 ? (
          <div className="gm-person-tags" style={{ marginBottom: 12 }}>
            {[{ key: "all", label: "Everything" }, ...available].map((g) => {
              const on = group === g.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGroup(g.key)}
                  className="gm-scope"
                  style={{
                    cursor: "pointer",
                    font: "inherit",
                    fontSize: 11,
                    fontWeight: 500,
                    border: `1px solid ${on ? "var(--ink)" : "transparent"}`,
                    color: on ? "var(--ink)" : "var(--ink-3)",
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {shown.length === 0 ? (
          <p className="gm-sm gm-muted" style={{ margin: 0 }}>
            {entries.length === 0
              ? "Nothing on file yet. The first listing, offer or review starts it."
              : "Nothing of that kind on this record."}
          </p>
        ) : (
          <div className="gm-feed">
            {shown.map((e) => (
              <div key={`${e.kind}-${e.ref}`} className="gm-feed-item">
                <span className={`gm-feed-ico gm-feed-ico--${toneOf(e)}`}>
                  <KindIcon e={e} />
                </span>
                <div className="gm-feed-body">
                  <p>
                    <b>{e.title}</b>
                  </p>
                  {e.detail ? <p className="gm-sm gm-muted">{e.detail}</p> : null}
                  <div className="gm-feed-time">
                    {KIND_LABEL[e.kind]}
                    {e.by ? ` · ${e.by}` : ""} · {shortDate(e.at)} ·{" "}
                    <span className="gm-mono">{e.ref}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
