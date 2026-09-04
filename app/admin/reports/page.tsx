"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  IconSearch,
  IconTrend,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { exportCsv } from "../lib/csv";

/* The catalogue drives the page: pick a report on the left and the panels on
   the right belong to it. The four headline figures sit at the foot rather
   than the head — they are the summary you check on the way out, and putting
   them first pushed the charts, which are the reason to open this page, below
   the fold.

   Every figure now comes from GET /admin/reports, computed over the selected
   period. Nothing on this page is a constant any more, which is why the period
   dropdown had to start doing something: it used to change a caption while the
   numbers underneath it stayed exactly where they were. */

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

/**
 * The selected report, drawn the way its catalogue caption says it draws.
 *
 * A report the API could not build is not drawn at all. An empty chart and a
 * chart of zeroes look identical, and one of them means "nothing happened"
 * while the other means "we could not find out".
 */
function ReportPanel({ report }: { report: ReportSeries }) {
  const fmt = formatterFor(report.unit);

  if (!report.available || report.trend.length === 0) {
    return (
      <Empty
        icon={<IconReport />}
        title="No figures for this one"
        body={report.unavailable ?? "Nothing was recorded in this period."}
      />
    );
  }

  if (report.chart === "Table") {
    const rows = report.trend
      .map((v, i) => ({ bucket: report.labels[i] ?? `#${i + 1}`, value: v }))
      .reverse();
    return (
      <div className="gm-tablewrap gm-tablewrap--panel" style={{ height: 244 }}>
        <table className="gm-table gm-table--compact">
          <thead>
            <tr>
              <th>Period</th>
              <th className="gm-num">{report.headlineLabel}</th>
              <th className="gm-num">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const prev = rows[i + 1]?.value;
              const change = prev === undefined ? null : r.value - prev;
              return (
                <tr key={r.bucket}>
                  <td className="gm-strong">{r.bucket}</td>
                  <td className="gm-num gm-strong">{fmt(r.value)}</td>
                  <td className="gm-num">
                    {change === null ? (
                      <span className="gm-dim">None</span>
                    ) : (
                      <span className={`gm-delta gm-delta--${change >= 0 ? "up" : "down"}`}>
                        {change >= 0 ? "+" : ""}
                        {change.toLocaleString("en-AU")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (report.chart === "Column chart") {
    return (
      <ColumnChart
        data={report.trend.map((v, i) => ({ label: report.labels[i] ?? "", value: v }))}
        height={216}
        color="var(--grad-navy)"
        format={fmt}
      />
    );
  }

  return (
    <TrendChart
      labels={report.labels}
      values={report.trend}
      height={216}
      fill={report.chart === "Area chart"}
      format={fmt}
      seriesLabel={report.headlineLabel}
    />
  );
}

function ReportsPage() {
  const [period, setPeriod] = useState("30d");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

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

  const catalogue = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q),
    );
  }, [query, reports]);

  /* The selection survives a period change — the same report over a different
     span is the whole reason to change the span. It only falls back when the
     report itself is gone from the catalogue. */
  const active = reports.find((r) => r.id === selected) ?? reports[0] ?? null;

  const decisionSplit = data?.decisionSplit ?? [];
  const totalDecisions = decisionSplit.reduce((s, d) => s + d.value, 0);
  const gameSplit = data?.gameSplit ?? [];
  const conflictOutcomes = data?.conflictOutcomes ?? [];
  const throughput = data?.throughput;

  /** The selected report's series, as a spreadsheet. What is on screen, not
   *  the whole catalogue — exporting everything is a different, unasked-for
   *  answer, the same rule the listing queue's export follows. */
  function exportActive() {
    if (!active) return;
    exportCsv(
      `grailmarket-${active.id.toLowerCase()}-${period}`,
      active.trend.map((value, i) => ({ bucket: active.labels[i] ?? `#${i + 1}`, value })),
      [
        { header: "Report", value: () => active.name },
        { header: "Period", value: () => data?.period.label ?? "" },
        { header: "Bucket", value: (r) => r.bucket },
        { header: active.headlineLabel || "Value", value: (r) => r.value },
      ],
    );
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
              onClick={exportActive}
              disabled={!active?.available}
            >
              <IconDownload />
              Export
            </button>
          </>
        }
      />

      <div className="gm-stack">
        {/* A console that cannot reach its API must say so. An empty report
            and a broken connection look identical otherwise. */}
        {error ? (
          <Note tone="bad">
            <b>The figures could not be read.</b> {error}
          </Note>
        ) : null}

        <div className="gm-reports">
          {/* ------------------------------------------------- the catalogue */}
          <aside className="gm-catalogue">
            <div className="gm-catalogue-head">
              <div>
                <b>Report catalogue</b>
                <span>
                  {reports.length} report{reports.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="gm-catalogue-search">
              <IconSearch />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports"
                aria-label="Search the report catalogue"
              />
            </div>

            {loading && reports.length === 0 ? (
              <Empty icon={<IconReport />} title="Reading the figures…" />
            ) : catalogue.length === 0 ? (
              <Empty icon={<IconReport />} title="Nothing matches that" />
            ) : (
              <div className="gm-catalogue-list" role="list">
                {catalogue.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="listitem"
                    className={`gm-catalogue-row${r.id === active?.id ? " is-active" : ""}`}
                    onClick={() => setSelected(r.id)}
                    aria-current={r.id === active?.id ? "true" : undefined}
                  >
                    <span className="gm-catalogue-copy">
                      <b>{r.name}</b>
                      <span>{r.available ? r.headline : "No figures"}</span>
                    </span>
                    {/* No sparkline on a report with nothing behind it. A flat
                        line at the baseline reads as a real, quiet series. */}
                    {r.available && r.trend.length > 1 ? (
                      <Spark points={r.trend} width={54} height={24} color={CHART_TONE[r.chart]} />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* ------------------------------------------------------ the panels */}
          <div className="gm-reports-main">
            <div className="gm-grid gm-grid--2a">
              <Card>
                <CardHead
                  title={active?.name ?? "Reports"}
                  sub={active ? `${active.category} · ${active.headlineLabel}` : ""}
                />
                <CardBody>
                  {active ? (
                    <ReportPanel report={active} />
                  ) : (
                    <Empty icon={<IconReport />} title="Reading the figures…" />
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHead title="GMV by game" sub="Share of the period, largest first" />
                <CardBody>
                  {gameSplit.length === 0 ? (
                    <Empty
                      icon={<IconTrend />}
                      title="No completed sales"
                      body="Nothing sold in this period, so there is no value to split."
                    />
                  ) : (
                    <ColumnChart
                      data={gameSplit.map((g) => ({ label: g.label, value: g.value }))}
                      height={216}
                      color="var(--gold)"
                      format={(n) => `${n}%`}
                    />
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Four panels of the same height, each filling it. `gm-panels`
                spreads the contents rather than letting the shortest card
                trail a block of white under its last line. */}
            <div className="gm-grid gm-grid--4 gm-panels">
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

              <Card>
                <CardHead title="Inside the target" sub="Decided within 24h" />
                <CardBody>
                  {/* A percentage of nothing is not zero per cent — it is no
                      answer, and a gauge sitting at the bottom of its arc
                      says the desk missed every one of them. */}
                  {!throughput || throughput.onTime === null ? (
                    <Empty
                      icon={<IconClock />}
                      title="Nothing to measure"
                      body="No listing was decided in this period."
                    />
                  ) : (
                    <>
                      <div className="gm-panel-figure">
                        <Gauge
                          value={throughput.onTime}
                          label={`${throughput.onTime}%`}
                          caption="on time"
                          size={138}
                          thickness={12}
                        />
                      </div>

                      <div className="gm-factstrip">
                        <span>
                          <i>Median</i>
                          <b>{throughput.medianLabel}</b>
                        </span>
                        <span>
                          <i>Breached</i>
                          <b>{throughput.breached}</b>
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
                    <Empty
                      icon={<IconScale />}
                      title="No case closed"
                      body="Nothing was decided on the conduct board in this period."
                    />
                  ) : (
                    <BarList rows={conflictOutcomes} fill />
                  )}
                </CardBody>
              </Card>

              {/* the selected report's paperwork, beside the chart above */}
              <Card>
                <CardHead
                  title="Report detail"
                  sub={active ? `${active.id} · ${active.category}` : ""}
                />
                <CardBody>
                  {active ? (
                    <>
                      <div className="gm-report-headline">
                        <b>{active.headline}</b>
                        <span>{active.headlineLabel}</span>
                        {active.available && active.trend.length > 1 ? (
                          <Spark
                            points={active.trend}
                            width={140}
                            height={38}
                            color={CHART_TONE[active.chart]}
                          />
                        ) : null}
                      </div>

                      <div className="gm-report-facts">
                        <span>
                          <i>Period</i>
                          {data?.period.label ?? "—"}
                        </span>
                        <span>
                          <i>Source</i>
                          {active.available ? (
                            <b className="gm-badge gm-badge--ok">Live</b>
                          ) : (
                            <b className="gm-badge gm-badge--bad">Unavailable</b>
                          )}
                        </span>
                        <span>
                          <i>Formats</i>
                          {active.format}
                        </span>
                      </div>

                      <p className="gm-sm gm-muted" style={{ margin: "10px 0 0" }}>
                        {active.detail}
                      </p>
                    </>
                  ) : null}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>

        {/* --------------------------------------------- the period in figures */}
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
