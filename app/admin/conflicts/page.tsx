"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { conflictKindLabel, money, type Conflict, type ConflictStatus } from "../lib/data";
import {
  Badge,
  BlockHead,
  Card,
  ConflictBadge,
  Empty,
  Loading,
  MetaBox,
  Note,
  FilterMenu,
  PageHead,
  Slab,
} from "../components/ui";
import {
  IconClock,
  IconDownload,
  IconEye,
  IconScale,
  IconShield,
  IconTag,
} from "../components/icons";
import { ApiError, fetchCases } from "../lib/api";
import { toConflict } from "../lib/cases";
import { exportCsv } from "../lib/csv";
import { Gate } from "../components/Gate";

/** What the case says, from whoever raised it.
 *
 *  The card used to print the buyer's claim whatever the case was, which on a
 *  case a seller raised showed the buyer's silence instead of the report. */
const reportOf = (c: Conflict) => (c.against === "seller" ? c.buyerClaim : c.sellerClaim);

type Filter = "all" | ConflictStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All cases" },
  { key: "escalated", label: "Escalated" },
  { key: "open", label: "Open" },
  { key: "awaiting-evidence", label: "Awaiting evidence" },
  { key: "resolved", label: "Resolved" },
];

/* The sidebar links straight to a view — `?status=escalated` and the like. */
const STATUSES = FILTERS.map((f) => f.key as string);

function ConflictsPage() {
  const params = useSearchParams();
  const wanted = params.get("status");
  const fromUrl = (STATUSES.includes(wanted ?? "") ? wanted : "all") as Filter;

  const [filter, setFilter] = useState<Filter>(fromUrl);
  useEffect(() => setFilter(fromUrl), [fromUrl]);
  /* Members or staff. A report about a moderator is not the same job as a
     report about a seller, and whoever works the second should not be the one
     working the first — so they are separate piles, not one list. */
  const [party, setParty] = useState<"all" | "members" | "staff">("all");
  /* The board, from the API. Filtering is the database's job — the tab is a
     query parameter, not a predicate run over rows already in the browser. */
  const [rows, setRows] = useState<Conflict[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchCases(filter, party)
      .then((r) => {
        if (!live) return;
        setRows(r.cases.map((c) => toConflict(c)));
        setCounts(r.counts);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [filter, party]);

  const list = rows;

  return (
    <>
      <PageHead
        title="Reports & conduct"
        sub="No money passes through Grail Market, so a case closes on conduct: a warning, a restriction, a closed account, or a referral to police."
        right={
          /* "Claim oldest" is gone. A case is claimed by opening it, which is
             what a moderator does anyway, and a second button that does the
             same thing one row earlier was never worth the width. */
          <button
            type="button"
            className="gm-btn"
            onClick={() =>
              exportCsv(`grailmarket-cases-${filter}`, list, [
                { header: "Case", value: (c) => c.id },
                { header: "Kind", value: (c) => conflictKindLabel[c.kind] },
                { header: "State", value: (c) => c.status },
                { header: "Opened", value: (c) => c.opened },
                { header: "Hours open", value: (c) => c.ageHours },
                { header: "Trade value", value: (c) => c.amount },
                { header: "Against", value: (c) => c.against },
                { header: "Buyer", value: (c) => c.buyer.handle },
                { header: "Seller", value: (c) => c.seller.handle },
                { header: "Listing", value: (c) => c.listing.id },
                { header: "Card", value: (c) => c.listing.card },
                { header: "Report", value: (c) => reportOf(c) },
              ])
            }
          >
            <IconDownload />
            Export
          </button>
        }
      />

      <div className="gm-stack">
        {/* The filter sits beside the heading it changes rather than as a row
            of five pills above it. The heading names the state being shown,
            so nothing is hidden by moving the control. */}
        <BlockHead
          title={filter === "all" ? "Needs a decision" : FILTERS.find((f) => f.key === filter)!.label}
          sub={`${list.length} case${list.length === 1 ? "" : "s"}${
            party === "all" ? "" : party === "staff" ? " · staff involved" : " · members only"
          }`}
          right={
            <FilterMenu
              applied={(filter === "all" ? 0 : 1) + (party === "all" ? 0 : 1)}
              onClear={() => {
                setFilter("all");
                setParty("all");
              }}
              groups={[
                {
                  key: "party",
                  label: "Who is involved",
                  value: party,
                  onChange: (v) => setParty(v as typeof party),
                  options: [
                    { value: "all", label: "Everyone", count: counts.all ?? 0 },
                    { value: "members", label: "Members only", count: counts.members ?? 0 },
                    { value: "staff", label: "Staff involved", count: counts.staff ?? 0 },
                  ],
                },
                {
                  key: "status",
                  label: "Case state",
                  value: filter,
                  onChange: (v) => setFilter(v as Filter),
                  options: FILTERS.map((f) => ({
                    value: f.key,
                    label: f.label,
                    count: counts[f.key] ?? 0,
                  })),
                },
              ]}
            />
          }
        />

        {loadError ? (
          <Note tone="bad">
            <b>The board could not be read.</b> {loadError}
          </Note>
        ) : loading && list.length === 0 ? (
          <Card>
            <Loading label="Reading the board…" />
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <Empty
              icon={<IconScale />}
              title="Nothing here"
              body="No case currently has that status."
            />
          </Card>
        ) : (
          <div className="gm-caseboard">
            {list.map((c) => {
              const priors = c[c.against].disputes;
              const reporter = c[c.against === "seller" ? "buyer" : "seller"];
              return (
                <article key={c.id} className="gm-case">
                  {/* What the complaint is and who it is against — the two
                      facts a moderator picks the next case on. The store's own
                      id used to sit under the heading; it is gone, because
                      nobody reads a case board looking for "dp_7c8af086". It
                      is still searchable and still in the export. */}
                  {/* The heading gets the whole width. The state badge used
                      to sit on this line, and at four cards across the ~55px
                      it took were exactly the ~55px the handle needed — so
                      every card said "against @sohaib_ahme…", losing the one
                      thing the heading is for. It has moved to the line below,
                      where there was already room for it. */}
                  <div className="gm-case-top">
                    <div className="gm-case-who">
                      <Slab
                        grader={c.listing.grader}
                        grade={c.listing.grade}
                        art={c.listing.art}
                        size="sm"
                      />
                      <span className="gm-cell2" style={{ minWidth: 0 }}>
                        <b>{conflictKindLabel[c.kind]}</b>
                        <span className="gm-nowrap-ellipsis">
                          against {c[c.against].handle}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Two boxes, not four.

                      The grid used to hold Opened, Running, Trade value and
                      Prior cases. "Opened 06 Sept" and "running 20 hours" are
                      the same fact said twice, and "None before this" — which
                      is what nine cards in ten said — is an absence taking the
                      space of a finding.

                      These two are what a moderator picks the next case on:
                      how long somebody has been waiting for an answer, which
                      is the order the board should be worked in, and what the
                      trade was worth, which is how much is riding on getting
                      it right. A prior-case count still appears, but only on
                      the cards that have one. */}
                  <div className="gm-metagrid">
                    <MetaBox
                      label="Waiting"
                      value={`${Math.round(c.ageHours)} hours`}
                      icon={<IconClock />}
                    />
                    <MetaBox label="Trade value" value={money(c.amount)} icon={<IconTag />} />
                  </div>

                  <div className="gm-case-facts">
                    <span className="gm-nowrap-ellipsis">
                      {c.listing.card} · {c.listing.grader} {c.listing.grade}
                    </span>
                    <span className="gm-case-facts-row">
                      <span className="gm-nowrap-ellipsis">raised by {reporter.handle}</span>
                      <ConflictBadge status={c.status} />
                    </span>
                  </div>

                  {/* A pattern is worth a chip. "None before this" on nine
                      cards out of ten is not — an absence of prior cases is
                      the normal state, and saying so on every card is how the
                      one card that matters stopped standing out. */}
                  {priors > 0 ? (
                    <div className="gm-row" style={{ gap: 6 }}>
                      <Badge tone={priors >= 4 ? "bad" : "warn"}>
                        {priors} prior case{priors === 1 ? "" : "s"} against them
                      </Badge>
                    </div>
                  ) : null}

                  {/* One button, not two.

                      "View details" and "Decide" opened the same record and
                      differed by a boolean that scrolled it to the outcome
                      section — so the board offered a choice between reading a
                      case and reading the same case slightly further down. It
                      is the state of the case that decides which of the two
                      words is true: an open case is there to be decided, and a
                      closed one is there to be read.

                      A link, not a button that opens a window over the board:
                      the case is a page with an address of its own now, so it
                      can be handed to the moderator who should be working it. */}
                  <div className="gm-case-actions">
                    {c.status === "resolved" ? (
                      <Link className="gm-btn gm-btn--sm" href={`/admin/conflicts/${c.id}`}>
                        <IconEye />
                        View details
                      </Link>
                    ) : (
                      <Link
                        className="gm-btn gm-btn--sm gm-btn--primary"
                        href={`/admin/conflicts/${c.id}`}
                      >
                        <IconShield />
                        Decide
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

    </>
  );
}

/* `useSearchParams` opts its subtree out of the static shell, so it gets a
   boundary of its own rather than the whole route being client-rendered. */
function ConflictsRoute() {
  return (
    <Suspense fallback={null}>
      <ConflictsPage />
    </Suspense>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedConflictsRoute() {
  return (
    <Gate need="conduct.decide">
      <ConflictsRoute />
    </Gate>
  );
}
