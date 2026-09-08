"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  fetchReports,
  REPORT_PERIODS,
  type ReportSeries,
  type ReportsPayload,
} from "../lib/api";
import { aud, num } from "../lib/data";
import {
  BarList,
  Card,
  CardBody,
  CardHead,
  ColumnChart,
  Empty,
  Gauge,
  Loading,
  Note,
  PageHead,
  Select,
  Spark,
  TrendChart,
} from "../components/ui";
import {
  IconCheckCircle,
  IconClock,
  IconDollar,
  IconDownload,
  IconRefresh,
  IconScale,
  IconShield,
  IconTrend,
  IconUsers,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { exportCsv } from "../lib/csv";

/**
 * Reports — the owner's page, not the moderator's.
 *
 * It has been three things. A catalogue down the left with one report visible
 * at a time, so reading the marketplace meant clicking nine times and holding
 * the first eight in your head. Then everything on one screen, which was
 * better but ended in a nine-row table of report metadata — the name of each
 * report, a two-line description of what it counts, its category and a
 * sparkline — printed underneath the reports it had just drawn.
 *
 * The question that fixed it was who opens this page and what they came for.
 * The answer is not "a moderator": a moderator works the listing queue and the
 * conduct board, and both of those pages already tell them how they are doing.
 * It is whoever owns the business, and their questions are short —
 *
 *   what am I earning, and is it growing
 *   how many people are paying me, and how fast is that number moving
 *   how much is being traded here
 *   how many of these accounts are real people
 *   how much is going wrong, and is the desk keeping up
 *
 * So the page is seven panels, one per question, and nothing else. What went:
 * the four moderation KPI tiles at the top (cleared, median time, rejection
 * rate, conflict rate — the figures a moderator is measured on, restated above
 * the charts that already contain them), the report catalogue, and the six
 * small figure cards that replaced it, which were the catalogue again with the
 * prose taken out. Where a figure from those was worth keeping it now sits
 * inside the panel it belongs to rather than on a shelf of its own.
 */

/** A series is only worth drawing if the API could build it and it has more
 *  than one point. One point is a dot, not a trend. */
const drawable = (r?: ReportSeries) => Boolean(r?.available && r.trend.length > 1);

/** Axis and readout formatting, from what the report actually counts. */
function formatterFor(unit: ReportSeries["unit"]) {
  if (unit === "k") return (n: number) => `$${n}k`;
  if (unit === "%") return (n: number) => `${n}%`;
  return (n: number) => n.toLocaleString("en-AU");
}

/**
 * The big number a panel is built around, with what it is and what it means
 * underneath it.
 *
 * The inspiration for this page puts one figure at the top of each card at a
 * size nothing else competes with, and everything else on the card explains
 * it. That is the right shape here: a panel answers one question, so it should
 * open with the answer.
 */
function Figure({
  value,
  label,
  foot,
  icon,
}: {
  value: string;
  label: string;
  foot?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="gm-figure">
      <span className="gm-figure-top">
        {icon ? <span className="gm-figure-ico">{icon}</span> : null}
        {label}
      </span>
      <span className="gm-figure-value">{value}</span>
      {foot ? <span className="gm-figure-foot">{foot}</span> : null}
    </div>
  );
}

/**
 * A movement, in the words of the thing that moved.
 *
 * Quiet at zero: "+0 this period" on four panels at once is four ways of
 * saying nothing happened, and the point of colouring a delta is that it is
 * worth looking at.
 *
 * The plural is passed in rather than built by adding an "s", which is how
 * this first read "+8 news last 30 days".
 */
function Delta({
  n,
  one,
  many,
  period,
}: {
  n: number;
  one: string;
  many: string;
  period: string;
}) {
  if (n <= 0) return <span className="gm-dim">none {period.toLowerCase()}</span>;
  return (
    <span style={{ color: "var(--ok)", fontWeight: 600 }}>
      +{num(n)} {n === 1 ? one : many} {period.toLowerCase()}
    </span>
  );
}

function ReportsPage() {
  const [period, setPeriod] = useState("30d");
  /* The same switch the listing queue carries, and the same default: the
     figures as a list first, the panels behind the second button.

     A table of reports has been here before and was removed for good reason —
     it sat UNDERNEATH the charts it described, restating their names and a
     two-line explanation of what each one counts below the drawn version of
     the same thing. This is the other arrangement: one or the other, never
     both, and it carries only what a row can be read on — the name, what it
     counts, the current figure and its shape. */

  const [data, setData] = useState<ReportsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const seq = ++latest.current;
    setLoading(true);
    fetchReports(period)
      .then((r) => {
        /* Changing the period twice quickly must not let the first answer
           land last. Same guard the listing queue's search box needs. */
        if (seq !== latest.current) return;
        setData(r);
        setError(null);
      })
      .catch((e) => {
        if (seq !== latest.current) return;
        setError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (seq === latest.current) setLoading(false);
      });
  }, [period, tick]);

  const reports = data?.reports ?? [];
  const byId = (id: string) => reports.find((r) => r.id === id);

  /* The two series drawn in full: what came in, and who joined. */
  const gmv = byId("RP-01");
  const growth = byId("RP-05");

  const o = data?.owner;
  const sla = data?.throughput;
  const decisionSplit = data?.decisionSplit ?? [];
  const conflictOutcomes = data?.conflictOutcomes ?? [];
  const label = data?.period.label ?? "the period";

  /** Verified accounts as a share of members. A percentage of nothing is not
   *  zero per cent — it is no answer, and a gauge at the bottom of its arc
   *  would say every account on the marketplace is unverified. */
  const verifiedPct = o && o.members > 0 ? Math.round((o.verified / o.members) * 100) : null;

  /** Every series on screen, as one spreadsheet. The period applies. */
  function exportAll() {
    if (!data) return;
    const rows = reports.flatMap((r) =>
      r.trend.map((value, i) => ({
        report: r.name,
        category: r.category,
        bucket: r.labels[i] ?? `#${i + 1}`,
        value,
      })),
    );
    exportCsv(`grailmarket-reports-${period}`, rows, [
      { header: "Report", value: (r) => r.report },
      { header: "Category", value: (r) => r.category },
      { header: "Period", value: () => data.period.label },
      { header: "Bucket", value: (r) => r.bucket },
      { header: "Value", value: (r) => r.value },
    ]);
  }

  /** One series, as a spreadsheet. The row's own action — the page-wide
   *  Export writes all nine, and a row you are reading is rarely all nine. */
  function exportSeries(r: ReportSeries) {
    exportCsv(
      `grailmarket-${r.id.toLowerCase()}-${period}`,
      r.trend.map((value, i) => ({ bucket: r.labels[i] ?? `#${i + 1}`, value })),
      [
        { header: "Report", value: () => r.name },
        { header: "Period", value: () => label },
        { header: "Bucket", value: (x) => x.bucket },
        { header: "Value", value: (x) => x.value },
      ],
    );
  }

  return (
    <>
      <PageHead
        title="Reports"
        sub={
          data
            ? `Every figure computed over ${label.toLowerCase()}, from the marketplace itself.`
            : "The numbers behind the marketplace."
        }
        right={
          <>
            <Select
              width={168}
              value={period}
              onChange={setPeriod}
              ariaLabel="Reporting period"
              options={REPORT_PERIODS.map((p) => ({ value: p.key, label: p.label }))}
            />
            <button
              type="button"
              className="gm-btn"
              onClick={() => setTick((n) => n + 1)}
              disabled={loading}
            >
              <IconRefresh />
              {loading ? "Reading…" : "Refresh"}
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              onClick={exportAll}
              disabled={!data || reports.every((r) => !r.available)}
            >
              <IconDownload />
              Export
            </button>
          </>
        }
      />

      <div className="gm-stack">
        {error ? (
          <Note tone="bad">
            <b>The figures could not be read.</b> {error}
          </Note>
        ) : null}

        {loading ? (
          <Card>
            <Loading label="Reading the figures…" />
          </Card>
        ) : (
          <div className="gm-bento">
            {/* ------------------------------------------------------ money

                Top left, because it is the first question. Recurring revenue
                is what is true now rather than over the period — there is no
                such thing as MRR for the last seven days — and the card says
                so rather than letting the period control imply otherwise. */}
            <Card>
              <CardHead title="Recurring revenue" sub="Subscriptions, as they stand today" />
              <CardBody>
                <Figure
                  value={aud(o?.mrr ?? 0)}
                  label="Every month"
                  icon={<IconDollar />}
                  foot={
                    <>
                      {num(o?.subscribers ?? 0)} subscriber
                      {(o?.subscribers ?? 0) === 1 ? "" : "s"} ·{" "}
                      <Delta
                        n={o?.newSubscribers ?? 0}
                        one="signed up"
                        many="signed up"
                        period={label}
                      />
                    </>
                  }
                />

                {o && o.plans.length > 0 ? (
                  <div className="gm-figure-rows">
                    {o.plans.map((p) => (
                      <div key={p.name} className="gm-figure-row">
                        <span className="gm-nowrap-ellipsis">{p.name}</span>
                        <span className="gm-dim">{aud(p.price)}</span>
                        <b>{num(p.subscribers)}</b>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Collected is not MRR, and the gap between them is a real
                    queue of work: cards that bounced and nobody has chased. */}
                <div className="gm-factstrip">
                  <span>
                    <i>Collected</i>
                    <b>{aud(o?.collected ?? 0)}</b>
                  </span>
                  <span>
                    <i>Failed</i>
                    <b style={(o?.failed ?? 0) > 0 ? { color: "var(--bad)" } : undefined}>
                      {(o?.failed ?? 0) > 0
                        ? `${aud(o!.failed)} · ${o!.failedAccounts} account${o!.failedAccounts === 1 ? "" : "s"}`
                        : "None"}
                    </b>
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* ------------------------------------------ what is being traded */}
            <Card className="gm-bento-wide">
              <CardHead
                title={gmv?.name ?? "Marketplace volume"}
                sub={
                  gmv
                    ? `${gmv.headline} · ${gmv.headlineLabel}`
                    : "Confirmed sales across the period"
                }
              />
              <CardBody>
                {/* Bars, not a line.

                    GMV is money that arrived in a bucket, and a bucket is a
                    countable thing with edges — a column says "this much, in
                    that week" where a line says the figure was travelling
                    continuously between the two, which is not what a sum over
                    a week is. It also stops a period with one busy bucket
                    reading as a curve sweeping upward off the top of the
                    chart. */}
                {drawable(gmv) ? (
                  <ColumnChart
                    data={gmv!.labels.map((l, i) => ({ label: l, value: gmv!.trend[i] ?? 0 }))}
                    height={228}
                    color="var(--grad-gold)"
                    format={formatterFor(gmv!.unit)}
                  />
                ) : (
                  <Empty
                    icon={<IconTrend />}
                    title="No completed sales"
                    body={gmv?.unavailable ?? "Nothing sold in this period."}
                  />
                )}
              </CardBody>
            </Card>

            {/* ----------------------------------------------- who is real */}
            <Card>
              <CardHead title="Verified accounts" sub="Approved by the identity provider" />
              <CardBody>
                {verifiedPct === null ? (
                  <Empty
                    icon={<IconShield />}
                    title="No members yet"
                    body="Nothing to verify."
                  />
                ) : (
                  <>
                    <div className="gm-panel-figure">
                      <Gauge
                        value={verifiedPct}
                        label={`${verifiedPct}%`}
                        caption="verified"
                        gradient={{ from: "var(--gold-lift)", to: "var(--gold-sink)" }}
                        size={128}
                        thickness={12}
                      />
                    </div>
                    <div className="gm-factstrip">
                      <span>
                        <i>Verified</i>
                        <b>
                          {num(o!.verified)} of {num(o!.members)}
                        </b>
                      </span>
                      <span>
                        <i>{label}</i>
                        <b>
                          <Delta n={o!.newVerified} one="account" many="accounts" period="" />
                        </b>
                      </span>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            {/* -------------------------------------- is the desk keeping up */}
            <Card>
              <CardHead title="Review queue" sub="Decided inside the 24-hour target" />
              <CardBody>
                {/* A percentage of nothing is not zero per cent — it is no
                    answer, and a gauge at the bottom of its arc says the desk
                    missed every one of them. */}
                {!sla || sla.onTime === null ? (
                  <Empty
                    icon={<IconClock />}
                    title="Nothing to measure"
                    body="No listing was decided in this period."
                  />
                ) : (
                  <>
                    <div className="gm-panel-figure">
                      <Gauge
                        value={sla.onTime}
                        label={`${sla.onTime}%`}
                        caption="on time"
                        gradient={{ from: "var(--gold-lift)", to: "var(--gold-sink)" }}
                        size={128}
                        thickness={12}
                      />
                    </div>
                    <div className="gm-factstrip">
                      <span>
                        <i>Median</i>
                        <b>{sla.medianLabel}</b>
                      </span>
                      <span>
                        <i>Breached</i>
                        <b style={sla.breached > 0 ? { color: "var(--bad)" } : undefined}>
                          {sla.breached}
                        </b>
                      </span>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            {/* --------------------------------------- how much is going wrong */}
            <Card>
              <CardHead title="Conflicts" sub="Raised by members against each other" />
              <CardBody>
                <Figure
                  value={num(o?.casesOpened ?? 0)}
                  label={`Raised ${label.toLowerCase()}`}
                  icon={<IconScale />}
                  foot={
                    (o?.casesResolved ?? 0) > 0
                      ? `${num(o!.casesResolved)} closed in the same window`
                      : "None closed in the same window"
                  }
                />
                {conflictOutcomes.some((c) => c.value > 0) ? (
                  <div style={{ marginTop: 4 }}>
                    <div className="gm-label" style={{ marginBottom: 8 }}>
                      Where they landed
                    </div>
                    <BarList rows={conflictOutcomes} fill />
                  </div>
                ) : (
                  <p className="gm-sm gm-muted" style={{ margin: "10px 0 0" }}>
                    No case has been closed in this period, so there is nothing to say about
                    outcomes yet.
                  </p>
                )}
              </CardBody>
            </Card>

            {/* ---------------------------------------------- who is joining

                The full width, now that "Volume by game" has gone from beside
                it. That panel split the period's sales by trading card game,
                which is a fact about the catalogue rather than about the
                business — nobody decides anything differently for knowing it,
                and on a marketplace whose listings are almost all one game it
                was a single bar at 100%. */}
            <Card className="gm-bento-wide">
              <CardHead
                title="Members"
                sub={
                  o
                    ? `${num(o.members)} in total · ${o.newMembers > 0 ? `${num(o.newMembers)} joined` : "none joined"} ${label.toLowerCase()}`
                    : "Sign-ups across the period"
                }
              />
              <CardBody>
                {drawable(growth) ? (
                  <TrendChart
                    labels={growth!.labels}
                    values={growth!.trend}
                    height={186}
                    format={formatterFor(growth!.unit)}
                    seriesLabel={growth!.headlineLabel}
                  />
                ) : (
                  <Empty
                    icon={<IconUsers />}
                    title="No sign-ups"
                    body={growth?.unavailable ?? "Nobody joined in this period."}
                  />
                )}
              </CardBody>
            </Card>

            {/* ------------------------------------- what happened to submissions

                This lived inside "Review queue", under the dial and the two
                figures, and it was the reason that card ran 250px taller than
                the two beside it — a row of three panels where one was half
                again the height of its neighbours, and the short pair carried
                the difference as white space.

                It is a fair panel on its own: the dial says how FAST the desk
                answered and this says WHAT it answered, which are two
                questions. Beside the members chart it is also the right
                height, which is the other half of why the row now reads as a
                row. */}
            <Card>
              <CardHead
                title="Listing decisions"
                sub={`What was decided ${label.toLowerCase()}`}
              />
              <CardBody>
                {decisionSplit.some((d) => d.value > 0) ? (
                  <BarList rows={decisionSplit} fill />
                ) : (
                  <Empty
                    icon={<IconCheckCircle />}
                    title="Nothing decided"
                    body="No listing was approved, rejected or sent back in this period."
                  />
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedReportsPage() {
  return (
    <Gate need="reports.read">
      <ReportsPage />
    </Gate>
  );
}
