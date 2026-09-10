"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IN_QUEUE, money } from "../lib/data";
import { ApiError, setMarketState, useListings } from "../lib/api";
import {
  Badge,
  Card,
  Empty,
  ListingBadge,
  Loading,
  Note,
  FilterMenu,
  PageHead,
  Pagination,
  Slab,
  Tier,
  GameChip,
  CardTile,
  Toast,
  ViewToggle,
} from "../components/ui";
import {
  IconBan,
  IconCheck,
  IconDownload,
  IconEye,
  IconListing,
  IconSearch,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { exportCsv } from "../lib/csv";

/**
 * The listing queue — the whole life of a listing, on one page.
 *
 * This used to be two routes. `/admin/verification` held the review, with the
 * reasons and the flags and the photo set, and `/admin/listings` held a
 * publish button; a listing had to clear one and then be pushed through the
 * other. The feature set describes a single thing — every new listing is read
 * by a human before it goes live — so there is now a single queue, and
 * approving a listing is what puts it on the market.
 */

/** The tabs, and which statuses each one gathers. */
const VIEWS = [
  { key: "queue", label: "Needs a decision", statuses: ["awaiting", "in-review"] },
  { key: "seller", label: "Waiting on seller", statuses: ["info-requested"] },
  { key: "market", label: "On the market", statuses: ["live", "sold", "reserved", "paused"] },
  { key: "closed", label: "Off the market", statuses: ["withdrawn", "rejected"] },
  { key: "all", label: "All", statuses: [] },
] as const;

type View = (typeof VIEWS)[number]["key"];

/** Rows per page. A queue is read a screenful at a time, not scrolled. */
const PAGE_SIZE = 6;

/** How many rows of cards the gallery pages by. See `useGalleryPageSize`. */
const GALLERY_ROWS = 2;

/**
 * The gallery's page size, in cards that actually fit.
 *
 * Six was a fixed number chosen against no particular width, and `.gm-gallery`
 * is `repeat(auto-fill, minmax(232px, 1fr))` — so on a wide screen six cards
 * is four across and two adrift, with the pagination bar drawn under half a
 * row of empty card. The page size has to be whatever the grid decided, times
 * the number of rows we want to show.
 *
 * The column count is read off the computed `grid-template-columns` rather
 * than divided out of a width by hand: `auto-fill` generates its tracks
 * whether or not there are cards to sit in them, so the track list is the
 * grid's own answer and stays right through every gap, padding and breakpoint
 * change without this having to know about any of them.
 *
 * In an effect, never in render — a layout read during render is exactly the
 * `window` in the render path that fails `next build` during prerender. Zero
 * until the first measurement, and the caller falls back to `PAGE_SIZE` until
 * then, so the first paint is a full page rather than an empty one.
 */
function useGalleryColumns(on: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const read = () => {
      const tracks = getComputedStyle(el).gridTemplateColumns;
      setCols(tracks ? tracks.split(" ").filter(Boolean).length : 0);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [on]);

  return { ref, cols };
}

/** Hold the search box still for a moment before asking the database. */
function useDebounced(value: string, ms: number) {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return held;
}

function ListingsPage() {
  const params = useSearchParams();
  const wanted = params.get("view");
  /* Opens on everything, and you narrow from there. It opened on "Needs a
     decision", which is the right first job but the wrong first screen: on a
     quiet day the page arrived empty and read as broken, and there was no way
     to see the market at all without knowing the tab existed. */
  const fromUrl = (VIEWS.some((v) => v.key === wanted) ? wanted : "all") as View;

  const [view, setView] = useState<View>(fromUrl);
  useEffect(() => setView(fromUrl), [fromUrl]);

  const [tier, setTier] = useState<"all" | "grail" | "high-value" | "standard">("all");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"table" | "gallery">("table");

  /* The queue itself. Filtering, searching and counting are the database's
     job now — doing them a second time in the client is how a console starts
     disagreeing with the thing it is a console for. */
  const debounced = useDebounced(query, 220);
  const { data, error, loading, reload } = useListings({ view, search: debounced, tier });
  const rows = data?.listings ?? [];
  const counts = data?.counts ?? { queue: 0, seller: 0, market: 0, closed: 0, all: 0 };

  const [page, setPage] = useState(1);
  /* Whichever tab, tier or search brought this set of rows into being, page 1
     is where it should be read from — carrying a page index across a change
     of filter lands a moderator on a page that may no longer exist. */
  useEffect(() => setPage(1), [view, tier, debounced]);

  /* The table pages by a fixed six; the gallery pages by what fits. */
  const gallery = useGalleryColumns(layout === "gallery");
  const pageSize =
    layout === "gallery" && gallery.cols > 0 ? gallery.cols * GALLERY_ROWS : PAGE_SIZE;

  /* A window that narrows takes the page count down with it, and the page you
     were on can stop existing — four across at 1440 is two pages of eight, two
     across at 900 is four pages of four, and page 4 of the first is nothing at
     all. Land on the last page that still holds something rather than on a
     card that says the queue is empty when it is not. */
  const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, Math.ceil(rows.length / pageSize))));
  }, [pageSize, rows.length]);
  const safePage = Math.min(page, lastPage);
  const shown = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const [toast, setToast] = useState<{
    title: string;
    body: string;
    tone?: "ok" | "bad";
  } | null>(null);

  const breached = rows.filter((l) => IN_QUEUE.includes(l.status) && l.slaHours < 0).length;

  /** Pause, resume, withdraw — the levers on something already on sale. */
  async function setMarketStatus(
    l: { id: string; card: string },
    action: "pause" | "resume" | "withdraw",
    title: string,
  ) {
    try {
      await setMarketState(l.id, action);
      reload();
      setToast({ title, body: `${l.card} · written to the audit log` });
    } catch (e) {
      setToast({
        title: "That did not go through",
        body: e instanceof ApiError ? e.message : String(e),
        tone: "bad",
      });
    }
  }

  /** What is on screen, as a spreadsheet. The filter and the search apply —
   *  exporting the unfiltered set would be a different, unasked-for answer. */
  function exportRows() {
    exportCsv(`grailmarket-listings-${view}`, rows, [
      { header: "Listing", value: (l) => l.id },
      { header: "Card", value: (l) => l.card },
      { header: "Set", value: (l) => l.setLine },
      { header: "Grader", value: (l) => l.grader },
      { header: "Grade", value: (l) => l.grade },
      { header: "Certificate", value: (l) => l.cert },
      { header: "Tier", value: (l) => l.tier },
      { header: "State", value: (l) => l.status },
      { header: "Ask", value: (l) => l.askPrice },
      { header: "Currency", value: (l) => l.currency },
      { header: "Market", value: (l) => (l.marketPrice > 0 ? l.marketPrice : "") },
      { header: "Market from", value: (l) => l.marketSource },
      { header: "Comparable sales", value: (l) => l.sampleSize },
      { header: "Confidence", value: (l) => l.confidence },
      { header: "Angles supplied", value: (l) => l.photos },
      { header: "Seller", value: (l) => l.seller.handle },
      { header: "Seller name", value: (l) => l.seller.name },
      { header: "Seller sales", value: (l) => l.seller.sales },
      { header: "Submitted", value: (l) => l.submitted },
      { header: "Hours left", value: (l) => (IN_QUEUE.includes(l.status) ? l.slaHours : "") },
      { header: "Decided by", value: (l) => l.reviewedBy ?? "" },
      { header: "Reason", value: (l) => l.rejectReason ?? "" },
    ]);
  }

  return (
    <>
      <PageHead
        title="Verification"
        sub="Approving a listing publishes it straight away."
        right={
          /* "Claim next in queue" is gone. It spent most of its life disabled,
             reading "Queue is clear" — a control that is mostly a status
             message, in the one place on the page reserved for the action you
             came to take. The queue itself claims a row when you open it. */
          <button type="button" className="gm-btn" onClick={exportRows}>
            <IconDownload />
            Export
          </button>
        }
      />

      <div className="gm-stack">
        {/* A console that cannot reach its API must say so. An empty queue and
            a broken connection look identical otherwise, and one of them is a
            quiet day while the other is an outage. */}
        {error ? (
          <Note tone="bad">
            <b>The queue could not be read.</b> {error.message}
          </Note>
        ) : null}

        {breached > 0 ? (
          <Note tone="bad">
            <b>{breached} listings are past the 24-hour review target.</b> They are at the top of
            the queue below.
          </Note>
        ) : null}

        {/* The card now holds only the table; the controls that filter it sit
            above it, here, where they read as belonging to the page rather
            than as part of the data underneath them. */}
        <div className="gm-tablebar">
          <span className="gm-tablebar-count">
            {loading
              ? "Reading the queue…"
              : `${VIEWS.find((v) => v.key === view)!.label} · ${rows.length} of ${counts.all}${
                  tier === "all" ? "" : ` · ${tier === "high-value" ? "high value" : tier} tier`
                }`}
          </span>
          <div className="gm-row" style={{ gap: 8 }}>
            <div className="gm-search" style={{ width: 224 }}>
              <IconSearch />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Card, cert, listing id, seller…"
                aria-label="Search listings"
              />
            </div>
            <FilterMenu
              applied={(view === "all" ? 0 : 1) + (tier === "all" ? 0 : 1)}
              onClear={() => {
                setView("all");
                setTier("all");
              }}
              groups={[
                {
                  key: "view",
                  label: "Where it is",
                  value: view,
                  onChange: (v) => setView(v as View),
                  options: VIEWS.map((v) => ({
                    value: v.key,
                    label: v.label,
                    count: counts[v.key] ?? 0,
                  })),
                },
                {
                  key: "tier",
                  label: "Tier",
                  value: tier,
                  onChange: (v) => setTier(v as typeof tier),
                  options: [
                    { value: "all", label: "All tiers" },
                    { value: "grail", label: "Grail" },
                    { value: "high-value", label: "High" },
                    { value: "standard", label: "Standard" },
                  ],
                },
              ]}
            />
            <ViewToggle value={layout} onChange={setLayout} />
          </div>
        </div>

        {/* The card is the TABLE's frame, not the queue's. A table needs
            something to be ruled inside; a gallery does not, and a second
            white rectangle behind a grid of white tiles only draws a box
            around a box. The conduct board has always put its cards on the
            page's own paper — this is the same split, and the support desk
            carries it too.

            Loading and empty are different answers and must not share a
            screen: "No listing matches that tab" while the request is still
            in flight tells a moderator their filter is wrong when it is not.
            Both of those keep a card, because both are one message in the
            middle of a frame rather than a grid. */}
        {loading ? (
          <Card>
            <Loading label="Reading the queue…" />
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <Empty
              icon={<IconListing />}
              title="Nothing here"
              body="No listing matches that tab, tier or search."
            />
          </Card>
        ) : layout === "gallery" ? (
            <div className="gm-gallery" ref={gallery.ref}>
              {shown.map((l) => (
                  <CardTile
                    key={l.id}
                    slab={<Slab grader={l.grader} grade={l.grade} art={l.art} size="lg" />}
                    topLeft={<Tier tier={l.tier} />}
                    topRight={<ListingBadge status={l.status} />}
                    title={l.card}
                    sub={`${l.grader} ${l.grade} · ${l.setLine}`}
                    price={money(l.askPrice)}
                    meta={
                      <>
                        <GameChip game={l.game} />
                        {l.slaHours < 0 ? (
                          <Badge tone="bad">{Math.abs(l.slaHours)}h over</Badge>
                        ) : ["awaiting", "in-review"].includes(l.status) && l.slaHours <= 4 ? (
                          <Badge tone="warn">{l.slaHours}h left</Badge>
                        ) : null}
                      </>
                    }
                    footer={
                      <>
                        <span className="gm-tiny gm-muted">
                          {l.seller.handle} · {l.seller.reviews} reviews
                        </span>
                        <Link
                          className="gm-btn gm-btn--sm gm-spacer"
                          href={`/admin/listings/${l.id}`}
                        >
                          <IconEye />
                          Open
                        </Link>
                      </>
                    }
                  />
              ))}
            </div>
          ) : (
          <Card>
            <div className="gm-tablewrap">
              {/* Five columns, not seven, and not the nine it started with.

                  Every row opens a record that carries the ask against the
                  market, the comps behind that figure, the certificate, the
                  seller's history, the photo set and the review clock. Putting
                  all of it back on the row did not make the queue faster to
                  read — it made it wider than the panel, so the buttons at the
                  end of each row were the first thing to go off the edge, and
                  a moderator scanning for the next job had six numbers to step
                  over before reaching it.

                  What is left is what triage is actually done on: what the
                  card is, who is selling it, how much it matters, and where it
                  is. The ask, the market comparison and the activity counts
                  moved to the record. The only number still here is the review
                  clock, and only once it has been missed — that is not data
                  about the listing, it is the reason to open this one next. */}
              <table className="gm-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Seller</th>
                    <th className="gm-chipcol"><span>Tier</span></th>
                    <th className="gm-chipcol gm-chipcol--wide">
                      <span>State</span>
                    </th>
                    <th className="gm-rowend">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => {
                    const waiting = IN_QUEUE.includes(l.status);
                    return (
                      <tr key={l.id}>
                        <td>
                          <div className="gm-cell-user">
                            {/* The small slab, not the medium one. It is the
                                tallest thing in a row and so it is what sets
                                the row height — at 62px it made the row twice
                                the height of the two lines of text beside it,
                                and a queue is a table so that ten of them can
                                be read at once. */}
                            <Slab grader={l.grader} grade={l.grade} art={l.art} size="sm" />
                            <div className="gm-cell2">
                              <b>{l.card}</b>
                              <span>
                                {l.grader} {l.grade} · {l.setLine}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="gm-nowrap">
                          {/* No avatar. Every seller here has initials on a
                              grey circle drawn from a name the console does
                              not otherwise show — it identified nobody and
                              took a column's worth of width to do it. */}
                          {/* The handle alone, at the row's own weight. The
                              sale count and the rating were a second line
                              under it and neither is a thing a decision turns
                              on — they are on the record page, where the
                              seller is the subject rather than a column.

                              And with that second line gone the bold went
                              with it. `.gm-cell2 b` is the heavier half of a
                              "name over a muted line" pair, which is what
                              gives it something to stand off; a lone bolded
                              handle in every row of a queue is just a column
                              of weight to read past. The conduct board's
                              Against column has printed it plain all along. */}
                          {l.seller.handle}
                        </td>
                        {/* A column each. They read together — a grail
                            awaiting review is a different job from a standard
                            one — but sharing a cell meant neither could be
                            scanned down on its own, which is what a column is
                            for. */}
                        <td className="gm-chipcol">
                          <Tier tier={l.tier} />
                        </td>
                        {/* One line, so the state chip sits level with the
                            tier chip beside it. The submitted date and the
                            name of whoever cleared it used to hang underneath
                            in small print, which pushed every state badge in
                            the column half a line up and made two columns that
                            should read across as one row read as two. Both
                            facts are on the record, where there is room to say
                            what they are. */}
                        {/* The state, and nothing beside it. An "Nh over"
                            marker used to ride along on the late rows, which
                            put a second chip in a column that is read by
                            scanning one — and now that the column is centred,
                            a row with two chips is the one row whose state
                            does not sit where every other state sits. The
                            queue is still ordered by that clock and the record
                            still carries the number. */}
                        <td className="gm-chipcol gm-chipcol--wide">
                          <ListingBadge status={l.status} />
                        </td>
                        {/* Two buttons at most, and usually one.

                            This was a three-dot menu for a while. A menu earns
                            its place when a row has four or five things you
                            could do to it; here the whole set is "open it",
                            plus one market action on the rows that are on the
                            market. Putting one item behind a menu costs a
                            click and hides the only word — Review — that says
                            what the row is for. */}
                        <td className="gm-rowend">
                          <div className="gm-rowact">
                            {l.status === "live" ? (
                              <button
                                type="button"
                                className="gm-btn gm-btn--sm gm-btn--icon gm-btn--danger gm-btn--withdraw"
                                onClick={() => setMarketStatus(l, "withdraw", "Withdrawn")}
                                title="Withdraw"
                                aria-label="Withdraw"
                              >
                                <IconBan />
                              </button>
                            ) : l.status === "paused" ? (
                              <button
                                type="button"
                                className="gm-btn gm-btn--sm gm-btn--icon gm-btn--gold"
                                onClick={() => setMarketStatus(l, "resume", "Back on the market")}
                                title="Back on the market"
                                aria-label="Back on the market"
                              >
                                <IconCheck />
                              </button>
                            ) : null}
                            {/* A link, not a button that opens a window over
                                this table. The record is a page with an address
                                of its own, so it can be sent to somebody, opened
                                in a second tab, and left with the browser's own
                                back. Pausing a live listing lives there too —
                                it is the third action, and the row holds two. */}
                            {/* Icons only, asked for. The word each one carried
                                moves to `title` and `aria-label` rather than
                                being dropped: a bare glyph is unreadable to a
                                screen reader and ambiguous on a first visit,
                                and "Withdraw" and "Review" are not actions to
                                guess at. */}
                            <Link
                              className="gm-btn gm-btn--sm gm-btn--icon"
                              href={`/admin/listings/${l.id}`}
                              title={waiting ? "Review" : "Open"}
                              aria-label={waiting ? "Review" : "Open"}
                            >
                              <IconEye />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* A queue that grows past a screenful becomes a scroll with no sense
            of how much is left; the count above answers that. Outside the
            card, because in gallery view there is no card for it to sit in
            and it must not move between the two views. */}
        <Pagination
          page={safePage}
          pageSize={pageSize}
          total={rows.length}
          onPage={setPage}
          bare
        />
      </div>

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
function ListingsRoute() {
  return (
    <Suspense fallback={null}>
      <ListingsPage />
    </Suspense>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedListingsRoute() {
  return (
    <Gate need="listings.review">
      <ListingsRoute />
    </Gate>
  );
}
