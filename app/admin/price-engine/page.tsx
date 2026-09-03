"use client";

import { useEffect, useState } from "react";
import { shortDate } from "../lib/data";
import {
  ApiError,
  fetchComps,
  fetchPriceEngine,
  ruleOnComp,
  type EngineComp,
  type FeedHealth,
  type GradeSet,
} from "../lib/api";
import {
  Badge,
  BlockHead,
  Card,
  CardBody,
  CardHead,
  DL,
  Empty,
  Modal,
  Note,
  PageHead,
  PillTabs,
  Slab,
  Toast,
} from "../components/ui";
import { IconAlert, IconCheck, IconRefresh, IconX } from "../components/icons";
import { Gate } from "../components/Gate";

type Tab = "feeds" | "grades" | "outliers";

const FEED_TONE: Record<FeedHealth["status"], "ok" | "warn" | "bad"> = {
  healthy: "ok",
  degraded: "warn",
  stale: "warn",
  down: "bad",
};

const CONFIDENCE_TONE: Record<string, "ok" | "warn" | "bad"> = {
  high: "ok",
  medium: "warn",
  low: "bad",
};

/** A figure with the currency it is actually in.
 *
 *  The graded providers answer in US dollars and our own ledger is in
 *  Australian ones. Printing a bare `$` across both is a fifty-per-cent error
 *  with nothing on screen to see, so nothing here is formatted without its
 *  currency beside it. */
const price = (n: number | null | undefined, currency: string) =>
  n == null ? "No figure" : `${currency} ${Math.round(n).toLocaleString("en-US")}`;

const keyOf = (g: { catalogId: string; grader: string; grade: string }) =>
  `${g.catalogId}|${g.grader}|${g.grade}`;

/** One confirmed sale off our own ledger, as a row. */
function CompRow({
  c,
  median,
  onRule,
}: {
  c: EngineComp;
  median: number | null;
  onRule?: () => void;
}) {
  const drift = median && median > 0 ? Math.round(((c.price - median) / median) * 100) : null;

  return (
    <div className="gm-feed-item">
      <span className={`gm-feed-ico ${c.excluded ? "gm-feed-ico--bad" : "gm-feed-ico--ok"}`}>
        {c.excluded ? <IconAlert /> : <IconCheck />}
      </span>
      <div className="gm-feed-body">
        <p className="gm-row" style={{ gap: 8 }}>
          <b style={c.excluded ? { opacity: 0.6 } : undefined}>{price(c.price, c.currency)}</b>
          {drift !== null && drift !== 0 ? (
            <span className="gm-tiny gm-dim">
              {drift > 0 ? "+" : ""}
              {drift}% vs the middle figure
            </span>
          ) : null}
          {c.excluded ? <Badge tone="bad">Left out</Badge> : null}
        </p>
        {c.why ? (
          <p className="gm-sm gm-muted">
            {c.why}
            {c.ruledBy ? <span className="gm-tiny gm-dim"> — {c.ruledBy}</span> : null}
          </p>
        ) : null}
        <div className="gm-feed-time">
          {c.source} · sold {shortDate(c.soldAt)} · <span className="gm-mono">{c.ref}</span>
        </div>
        {onRule ? (
          <div className="gm-row" style={{ gap: 7, marginTop: 8 }}>
            <button
              type="button"
              className={`gm-btn gm-btn--sm${c.excluded ? "" : " gm-btn--primary"}`}
              onClick={onRule}
            >
              {c.excluded ? <IconCheck /> : <IconX />}
              {c.excluded ? "It is a real sale" : "Keep it out"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PriceEnginePage() {
  const [tab, setTab] = useState<Tab>("feeds");

  const [feeds, setFeeds] = useState<FeedHealth[]>([]);
  const [sets, setSets] = useState<GradeSet[]>([]);
  const [excluded, setExcluded] = useState<EngineComp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writes, setWrites] = useState(0);

  /* The sales under one grade set, fetched when it is opened. Five rows for
     sixty sets is a payload nobody reads, so this is per set and cached. */
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [comps, setComps] = useState<Record<string, { comps: EngineComp[]; median: number | null }>>(
    {}
  );

  /* Ruling on a sale needs a reason — it is what the next person reads. */
  const [ruling, setRuling] = useState<EngineComp | null>(null);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchPriceEngine()
      .then((r) => {
        if (!live) return;
        setFeeds(r.feeds);
        setSets(r.sets);
        setExcluded(r.excluded);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [writes]);

  async function toggleSet(g: GradeSet) {
    const k = keyOf(g);
    if (openSet === k) {
      setOpenSet(null);
      return;
    }
    setOpenSet(k);
    if (comps[k]) return;
    try {
      const r = await fetchComps(g.catalogId, g.grader, g.grade);
      setComps((c) => ({ ...c, [k]: r }));
    } catch {
      setComps((c) => ({ ...c, [k]: { comps: [], median: null } }));
    }
  }

  async function commitRuling() {
    if (!ruling) return;
    setBusy(true);
    try {
      await ruleOnComp(ruling.id, !ruling.excluded, why.trim());
      setToast(
        ruling.excluded
          ? "Counted again — the quoted figure will move with it"
          : "Left out of the quoted figure"
      );
      setRuling(null);
      setWhy("");
      setComps({});
      setWrites((n) => n + 1);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const unhealthy = feeds.filter((f) => f.status !== "healthy");
  const thin = sets.filter((s) => s.sampleSize < 3).length;

  return (
    <>
      <PageHead
        title="Price engine"
        sub="Where every figure the app quotes comes from: the sources behind it, the grade set it belongs to, and the confirmed sales underneath it."
        right={
          <button type="button" className="gm-btn" onClick={() => setWrites((n) => n + 1)}>
            <IconRefresh />
            Read again
          </button>
        }
      />

      <div className="gm-stack">
        {loadError ? (
          <Note tone="bad">
            <b>The engine could not be read.</b> {loadError}
          </Note>
        ) : null}

        {unhealthy.length > 0 ? (
          <Note tone="bad">
            <b>
              {unhealthy.length} of {feeds.length} price sources{" "}
              {unhealthy.length === 1 ? "is" : "are"} not healthy.
            </b>{" "}
            Anything leaning on {unhealthy.length === 1 ? "it" : "them"} is quoting from older
            figures than it looks.
          </Note>
        ) : null}

        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { key: "feeds", label: "Feed health", count: feeds.length },
            { key: "grades", label: "Grade sets", count: sets.length },
            { key: "outliers", label: "Outlier review", count: excluded.length },
          ]}
        />

        {/* =================================================== feeds */}
        {tab === "feeds" ? (
          <div className="gm-grid gm-grid--2">
            {loading && feeds.length === 0 ? (
              <Card>
                <Empty icon={<IconRefresh />} title="Reading the sources…" />
              </Card>
            ) : (
              feeds.map((f) => {
                const overdue = f.sinceHours !== null && f.sinceHours > f.staleAfter;
                return (
                  <Card key={f.key}>
                    <CardHead
                      title={f.name}
                      sub={f.covers}
                      right={
                        <Badge tone={FEED_TONE[f.status]}>
                          {f.status[0].toUpperCase() + f.status.slice(1)}
                        </Badge>
                      }
                    />
                    <CardBody>
                      <DL
                        rows={[
                          [
                            "Last delivered",
                            f.sinceHours === null ? (
                              <Badge tone="bad">Never</Badge>
                            ) : (
                              <span className="gm-row" style={{ gap: 7 }}>
                                {f.sinceHours === 0 ? "Under an hour ago" : `${f.sinceHours}h ago`}
                                {overdue ? (
                                  <Badge tone="bad">Past the {f.staleAfter}h threshold</Badge>
                                ) : null}
                              </span>
                            ),
                          ],
                          ["Figures it holds", f.rows.toLocaleString("en-US")],
                          [
                            "Lookups that found nothing",
                            f.rejectRate === 0 ? (
                              "None recorded"
                            ) : f.rejectRate > 8 ? (
                              <Badge tone="warn">{f.rejectRate}%</Badge>
                            ) : (
                              `${f.rejectRate}%`
                            ),
                          ],
                        ]}
                      />
                      {f.note ? (
                        <Note tone={f.status === "down" ? "bad" : "warn"}>{f.note}</Note>
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })
            )}
          </div>
        ) : null}

        {/* ============================================== grade sets */}
        {tab === "grades" ? (
          <>
            <Note tone="gold">
              <b>A grade belongs to a grading company, not to a card.</b> PSA, BGS, CGC, SGC and TAG
              are each priced from their own sales, and a grade is never carried across from one
              company to another. The same card appears once per company below. Averaging them
              would produce a price for a card nobody owns.
            </Note>

            <BlockHead
              title="Every set the engine prices"
              sub={
                thin > 0
                  ? `${sets.length} grade pairs · ${thin} priced off fewer than three sales, shown first`
                  : `${sets.length} grade pairs`
              }
            />

            {loading && sets.length === 0 ? (
              <Card>
                <Empty icon={<IconRefresh />} title="Reading the sets…" />
              </Card>
            ) : sets.length === 0 ? (
              <Card>
                <Empty
                  icon={<IconAlert />}
                  title="No figure held for any grade set"
                  body="Nothing has been priced yet. The refresh job fills this — run it on the API with npm run ingest."
                />
              </Card>
            ) : (
              <div className="gm-stack" style={{ gap: 12 }}>
                {sets.map((g) => {
                  const k = keyOf(g);
                  const on = openSet === k;
                  const loaded = comps[k];
                  return (
                    <Card key={k}>
                      <CardHead
                        title={`${g.card} · ${g.grader} ${g.grade}`}
                        sub={g.setLine || "Set unknown"}
                        right={
                          <span className="gm-row" style={{ gap: 7 }}>
                            <b style={{ fontSize: 16 }}>{price(g.price, g.currency)}</b>
                            <Badge tone={CONFIDENCE_TONE[g.confidence] ?? "bad"}>
                              {g.sampleSize} sale{g.sampleSize === 1 ? "" : "s"}
                            </Badge>
                          </span>
                        }
                      />
                      <CardBody style={{ paddingTop: 8 }}>
                        <div
                          className="gm-row"
                          style={{ gap: 12, flexWrap: "nowrap", alignItems: "flex-start" }}
                        >
                          <Slab grader={g.grader} grade={g.grade} size="sm" />
                          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                            <DL
                              rows={[
                                [
                                  "Range it came from",
                                  g.low == null || g.high == null
                                    ? "No range"
                                    : `${price(g.low, g.currency)} – ${price(g.high, g.currency)}`,
                                ],
                                [
                                  "How sure",
                                  <Badge tone={CONFIDENCE_TONE[g.confidence] ?? "bad"}>
                                    {g.confidence}
                                  </Badge>,
                                ],
                                ["Where from", g.source],
                                [
                                  "Refreshed",
                                  g.fetchedAt ? shortDate(g.fetchedAt) : "Never",
                                ],
                                [
                                  "On our own ledger",
                                  g.ledgerSales === 0
                                    ? "No confirmed trade of ours"
                                    : `${g.ledgerSales} confirmed trade${g.ledgerSales === 1 ? "" : "s"}`,
                                ],
                              ]}
                            />

                            <button
                              type="button"
                              className="gm-btn gm-btn--sm"
                              style={{ marginTop: 11 }}
                              onClick={() => toggleSet(g)}
                            >
                              {on ? "Hide the sales" : "Show the sales underneath"}
                            </button>

                            {on ? (
                              <div style={{ marginTop: 11 }}>
                                {!loaded ? (
                                  <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                                    Reading the ledger…
                                  </p>
                                ) : loaded.comps.length === 0 ? (
                                  <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                                    No trade of ours has settled on this exact pair. The figure
                                    above comes from {g.source}, not from our own ledger.
                                  </p>
                                ) : (
                                  <div className="gm-feed">
                                    {loaded.comps.map((c) => (
                                      <CompRow
                                        key={c.id}
                                        c={c}
                                        median={loaded.median}
                                        onRule={() => {
                                          setRuling(c);
                                          setWhy("");
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {/* =============================================== outliers */}
        {tab === "outliers" ? (
          <>
            <Note tone="gold">
              <b>One bad sale must not be able to move a quoted price.</b> We take the middle sale
              rather than the average, which handles most of it. This queue exists for the case
              that trick does not cover: where there are only two or three sales, the middle lands
              halfway between the truth and the rubbish, and a bad sale left in makes the price look
              better backed than it is. Anything here is already left out. Put one back only when
              you can say what it actually was.
            </Note>

            {excluded.length === 0 ? (
              <Card>
                <Empty
                  icon={<IconCheck />}
                  title="Nothing is being left out"
                  body="Every sale on the ledger is currently counted. A sale is added here from the Grade sets tab, or by the engine when it flags one."
                />
              </Card>
            ) : (
              <div className="gm-stack" style={{ gap: 12 }}>
                {excluded.map((c) => (
                  <Card key={c.id}>
                    <CardHead
                      title={`${c.card} · ${c.grader ?? "Raw"} ${c.grade ?? ""}`}
                      sub={`${c.setLine || "Set unknown"} · from ${c.source}`}
                      right={<Badge tone="bad">Left out</Badge>}
                    />
                    <CardBody style={{ paddingTop: 8 }}>
                      <DL
                        rows={[
                          ["The sale", price(c.price, c.currency)],
                          ["Sold", shortDate(c.soldAt)],
                          ["Listed as", c.rawTitle ?? "No title recorded"],
                          ["Where it came from", <span className="gm-mono">{c.ref}</span>],
                          ["Left out by", c.ruledBy ?? "the engine"],
                        ]}
                      />
                      {c.why ? <Note tone="warn">{c.why}</Note> : null}
                      <div className="gm-feed" style={{ marginTop: 10 }}>
                        <CompRow
                          c={c}
                          median={null}
                          onRule={() => {
                            setRuling(c);
                            setWhy("");
                          }}
                        />
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* ================================================== rule on a sale */}
      <Modal
        open={!!ruling}
        onClose={() => setRuling(null)}
        title={ruling?.excluded ? "Count this sale again" : "Keep this sale out"}
        sub="The sale itself is never edited. What is recorded is the decision, and who took it."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={why.trim().length < 6 || busy}
              onClick={commitRuling}
            >
              <IconCheck />
              {ruling?.excluded ? "Count it" : "Leave it out"}
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setRuling(null)}>
              Cancel
            </button>
          </>
        }
      >
        {ruling ? (
          <>
            <Card pad>
              <DL
                rows={[
                  ["Sale", price(ruling.price, ruling.currency)],
                  ["Card", `${ruling.card} · ${ruling.grader ?? "Raw"} ${ruling.grade ?? ""}`],
                  ["Sold", shortDate(ruling.soldAt)],
                  ["Listed as", ruling.rawTitle ?? "No title recorded"],
                ]}
              />
            </Card>
            <Note tone="warn">
              <b>The ledger is never edited.</b> A sale that was recorded stays recorded — this
              writes a decision beside it, so the price can be explained months later without
              anyone having to guess why a figure moved.
            </Note>
            <div className="gm-field">
              <label className="gm-label" htmlFor="rule-why">
                What the sale actually was
              </label>
              <textarea
                id="rule-why"
                className="gm-textarea"
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="A lot of three sold as one, a proxy card, a price in the wrong currency — whatever makes this the right call."
              />
              <span className="gm-hint">It is what the next person reads. At least 6 characters.</span>
            </div>
          </>
        ) : null}
      </Modal>

      {toast ? <Toast title="Price engine" body={toast} onDone={() => setToast(null)} /> : null}
    </>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedPriceEnginePage() {
  return (
    <Gate need="pricing.read">
      <PriceEnginePage />
    </Gate>
  );
}
