"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  fetchReports,
  REPORT_PERIODS,
  type ReportSeries,
  type ReportsPayload,
} from "../lib/api";
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
  RingChart,
  Select,
  Spark,
  StatTile,
  TrendChart,
} from "../components/ui";
import {
  IconCheckCircle,
  IconClock,
  IconDownload,
  IconRefresh,
  IconReport,
  IconScale,
  IconTrend,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { exportCsv } from "../lib/csv";

/**
 * Reports — one screen, no clicking through.
 *
 * This was a catalogue down the left and a panel on the right that changed
 * when you picked a row: nine reports, one visible at a time, and the eight
 * you were not looking at reduced to a name and a sparkline. Reading the
 * marketplace meant clicking nine times and holding the first eight in your
 * head.
 *
 * So the page shows the figures instead of a way to reach them. What is on
 * screen is what somebody opening this page came for — the four headline
 * numbers, where the money came from, whether the queue is keeping up, and
 * where conflicts landed — with the rest of the catalogue as one compact
 * table at the foot rather than as a navigation column.
 *
 * Nothing here is behind an interaction except the period, which changes
 * everything at once.
 */

const KPI_ICONS: Record<string, React.ReactNode> = {
  r1: <IconCheckCircle />,
  r2: <IconClock />,
  r3: <IconScale />,
  r4: <IconTrend />,
};

/** Colour a report's spark by what it measures, not by its position. */
const CHART_TONE: Record<ReportSeries["chart"], string> = {
  "Area chart": "var(--gold)",
  "Line chart": "var(--gold)",
  "Column chart": "var(--navy-500)",
  Table: "var(--ink-3)",
};

/** Axis and readout formatting, from what the report actually counts. */
function formatterFor(unit: ReportSeries["unit"]) {
  if (unit === "k") return (n: number) => `$${n}k`;
  if (unit === "%") return (n: number) => `${n}%`;
  return (n: number) => n.toLocaleString("en-AU");
}

/** A series is only worth drawing if the API could build it and it has more
 *  than one point. One point is a dot, not a trend. */
const drawable = (r?: ReportSeries) => Boolean(r?.available && r.trend.length > 1);

function ReportsPage() {
  const [period, setPeriod] = useState("30d");

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

  /* The three drawn in full. They are the three questions this page is opened
     with: what came in, whether we kept up, and who is joining. */
  const gmv = byId("RP-01");
  const throughput = byId("RP-02");
  const growth = byId("RP-05");

  const decisionSplit = data?.decisionSplit ?? [];
  const totalDecisions = decisionSplit.reduce((s, d) => s + d.value, 0);
  const gameSplit = data?.gameSplit ?? [];
  const conflictOutcomes = data?.conflictOutcomes ?? [];
  const sla = data?.throughput;

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

  return (
    <>
      <PageHead
        title="Reports"
        sub={
          data
            ? `Every figure computed over ${data.period.label.toLowerCase()}, from the marketplace itself.`
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
          <>
            {/* ------------------------------------------ the period, in four

                At the top rather than the foot. They are the summary the page
                is opened for; underneath the charts they were the thing you
                scrolled past twice. */}
            {data && data.kpis.length > 0 ? (
              <div className="gm-grid gm-grid--4">
                {data.kpis.map((k) => (
                  <StatTile
                    key={k.key}
                    label={k.label}
                    value={k.value}
                    delta={k.delta ?? undefined}
                    foot={k.foot}
                    tone={k.tone}
                    icon={KPI_ICONS[k.key]}
                  />
                ))}
              </div>
            ) : null}

            {/* ------------------------------------------ money, and decisions */}
            <div className="gm-grid gm-grid--2a">
              <Card>
                <CardHead
                  title={gmv?.name ?? "GMV"}
                  sub={gmv ? `${gmv.headline} · ${gmv.headlineLabel}` : ""}
                />
                <CardBody>
                  {drawable(gmv) ? (
                    <TrendChart
                      labels={gmv!.labels}
                      values={gmv!.trend}
                      height={210}
                      fill
                      format={formatterFor(gmv!.unit)}
                      seriesLabel={gmv!.headlineLabel}
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

              <Card>
                <CardHead
                  title="Decisions"
                  sub={`${totalDecisions.toLocaleString("en-AU")} decided`}
                />
                <CardBody>
                  {totalDecisions === 0 ? (
                    <Empty icon={<IconCheckCircle />} title="Nothing decided" />
                  ) : (
                    <RingChart rings={decisionSplit} />
                  )}
                </CardBody>
              </Card>
            </div>

            {/* --------------------------------------------- the three panels */}
            <div className="gm-grid gm-grid--3 gm-panels">
              <Card>
                <CardHead title="GMV by game" sub="Share of the period, largest first" />
                <CardBody>
                  {gameSplit.length === 0 ? (
                    <Empty icon={<IconTrend />} title="No completed sales" />
                  ) : (
                    <ColumnChart
                      data={gameSplit.map((g) => ({ label: g.label, value: g.value }))}
                      height={196}
                      color="var(--gold)"
                      format={(n) => `${n}%`}
                    />
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Inside the target" sub="Decided within 24h" />
                <CardBody>
                  {/* A percentage of nothing is not zero per cent — it is no
                      answer, and a gauge at the bottom of its arc says the
                      desk missed every one of them. */}
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
                          <b>{sla.breached}</b>
                        </span>
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Conflict outcomes" sub="Where cases landed" />
                <CardBody>
                  {conflictOutcomes.every((o) => o.value === 0) ? (
                    <Empty icon={<IconScale />} title="No case closed" />
                  ) : (
                    <BarList rows={conflictOutcomes} fill />
                  )}
                </CardBody>
              </Card>
            </div>

            {/* ---------------------------------------- throughput and growth */}
            <div className="gm-grid gm-grid--2">
              {[throughput, growth].map((r, i) =>
                r ? (
                  <Card key={r.id}>
                    <CardHead title={r.name} sub={`${r.headline} · ${r.headlineLabel}`} />
                    <CardBody>
                      {drawable(r) ? (
                        <TrendChart
                          labels={r.labels}
                          values={r.trend}
                          height={180}
                          format={formatterFor(r.unit)}
                          seriesLabel={r.headlineLabel}
                        />
                      ) : (
                        <Empty
                          icon={<IconReport />}
                          title="No figures"
                          body={r.unavailable ?? "Nothing recorded in this period."}
                        />
                      )}
                    </CardBody>
                  </Card>
                ) : (
                  <Card key={i}>
                    <Empty icon={<IconReport />} title="Not available" />
                  </Card>
                ),
              )}
            </div>

            {/* --------------------------------------------- everything else

                The catalogue, as a table rather than a column you click
                through. Every report, its headline for the period and its
                shape, all readable at once — which is exactly what the
                nine-row sidebar was standing in the way of. */}
            <Card>
              <CardHead
                title="Every report"
                sub={`${reports.length} computed over ${
                  data?.period.label.toLowerCase() ?? "the period"
                }`}
              />
              <div className="gm-tablewrap">
                <table className="gm-table" style={{ minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Category</th>
                      <th>Measures</th>
                      <th className="gm-num">Headline</th>
                      <th className="gm-rowend">Shape</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="gm-cell2">
                            <b>{r.name}</b>
                            <span>{r.detail}</span>
                          </div>
                        </td>
                        <td className="gm-sm gm-muted gm-nowrap">{r.category}</td>
                        <td className="gm-sm gm-muted">{r.headlineLabel || "Nothing measured"}</td>
                        <td className="gm-num gm-strong gm-nowrap">
                          {r.available ? r.headline : <span className="gm-dim">Unavailable</span>}
                        </td>
                        <td className="gm-rowend">
                          {/* No sparkline on a report with nothing behind it:
                              a flat line at the baseline reads as a real,
                              quiet series rather than as an absent one. */}
                          {drawable(r) ? (
                            <Spark
                              points={r.trend}
                              width={92}
                              height={26}
                              color={CHART_TONE[r.chart]}
                            />
                          ) : (
                            <span className="gm-tiny gm-dim">{r.unavailable ?? "No data"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
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
