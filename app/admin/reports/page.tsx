"use client";

import { useMemo, useState } from "react";
import {
  conflictOutcomes,
  decisionSplit,
  gameSplit,
  reportKpis,
  reports,
  type Report,
} from "../lib/data";
import {
  BarList,
  Card,
  CardBody,
  CardHead,
  ColumnChart,
  Empty,
  Gauge,
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
  IconExternal,
  IconRefresh,
  IconReport,
  IconScale,
  IconSearch,
  IconTrend,
} from "../components/icons";

/* The catalogue drives the page: pick a report on the left and the panels on
   the right belong to it. The four headline figures sit at the foot rather
   than the head — they are the summary you check on the way out, and putting
   them first pushed the charts, which are the reason to open this page, below
   the fold. */

const PERIODS = ["Last 7 days", "Last 30 days", "This quarter", "Year to date"];

const KPI_ICONS: Record<string, React.ReactNode> = {
  r1: <IconCheckCircle />,
  r2: <IconClock />,
  r3: <IconScale />,
  r4: <IconTrend />,
};

/** Colour a report's spark by what it measures, not by its position. */
const CHART_TONE: Record<Report["chart"], string> = {
  "Area chart": "var(--gold)",
  "Line chart": "var(--gold)",
  "Column chart": "var(--navy-500)",
  Table: "var(--ink-3)",
};

/* Twelve weeks, the span every report's trend covers. */
const WEEKS = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);

/** Axis and readout formatting, from what the report actually counts. */
function formatterFor(unit: Report["unit"]) {
  if (unit === "k") return (n: number) => `$${n}k`;
  if (unit === "%") return (n: number) => `${n}%`;
  return (n: number) => n.toLocaleString("en-US");
}

/**
 * The selected report, drawn the way its catalogue caption says it draws.
 *
 * This is what makes the catalogue worth clicking: before, picking a report
 * changed one small panel in the corner and the big chart beside it stayed on
 * the same figures regardless, so the list read as decoration.
 */
function ReportPanel({ report }: { report: Report }) {
  const fmt = formatterFor(report.unit);

  if (report.chart === "Table") {
    const rows = report.trend.map((v, i) => ({ week: WEEKS[i], value: v })).reverse();
    return (
      <div className="gm-tablewrap gm-tablewrap--panel" style={{ height: 244 }}>
        <table className="gm-table gm-table--compact">
          <thead>
            <tr>
              <th>Week</th>
              <th className="gm-num">{report.headlineLabel}</th>
              <th className="gm-num">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const prev = rows[i + 1]?.value;
              const delta = prev === undefined ? null : r.value - prev;
              return (
                <tr key={r.week}>
                  <td className="gm-strong">{r.week}</td>
                  <td className="gm-num gm-strong">{fmt(r.value)}</td>
                  <td className="gm-num">
                    {delta === null ? (
                      <span className="gm-dim">—</span>
                    ) : (
                      <span className={`gm-delta gm-delta--${delta >= 0 ? "up" : "down"}`}>
                        {delta >= 0 ? "+" : ""}
                        {delta.toLocaleString("en-US")}
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
        data={report.trend.map((v, i) => ({ label: WEEKS[i], value: v }))}
        height={216}
        color="var(--grad-navy)"
        format={fmt}
      />
    );
  }

  return (
    <TrendChart
      labels={WEEKS}
      values={report.trend}
      height={216}
      fill={report.chart === "Area chart"}
      format={fmt}
      seriesLabel={report.headlineLabel}
    />
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState(PERIODS[1]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(reports[0].id);

  const catalogue = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q)
    );
  }, [query]);

  const active = reports.find((r) => r.id === selected) ?? reports[0];

  const totalDecisions = decisionSplit.reduce((s, d) => s + d.value, 0);

  /* how much of the queue landed inside the 24-hour target */
  const onTime = 91;

  return (
    <>
      <PageHead
        title="Reports"
        sub="The numbers behind the marketplace, and the scheduled exports that carry them out of here."
        right={
          <>
            <Select
              width={168}
              value={period}
              onChange={setPeriod}
              ariaLabel="Reporting period"
              options={[...PERIODS]}
            />
            <button type="button" className="gm-btn">
              <IconRefresh />
              Refresh
            </button>
            <button type="button" className="gm-btn gm-btn--primary">
              <IconDownload />
              Export all
            </button>
          </>
        }
      />

      <div className="gm-stack">
        <div className="gm-reports">
          {/* ------------------------------------------------- the catalogue */}
          <aside className="gm-catalogue">
            <div className="gm-catalogue-head">
              <div>
                <b>Report catalogue</b>
                <span>{reports.length} scheduled exports</span>
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

            {catalogue.length === 0 ? (
              <Empty icon={<IconReport />} title="Nothing matches that" />
            ) : (
              <div className="gm-catalogue-list" role="list">
                {catalogue.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="listitem"
                    className={`gm-catalogue-row${r.id === selected ? " is-active" : ""}`}
                    onClick={() => setSelected(r.id)}
                    aria-current={r.id === selected ? "true" : undefined}
                  >
                    <span className="gm-catalogue-copy">
                      <b>{r.name}</b>
                      <span>{r.chart}</span>
                    </span>
                    <Spark points={r.trend} width={54} height={24} color={CHART_TONE[r.chart]} />
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
                  title={active.name}
                  sub={`${active.category} · ${active.cadence}`}
                  right={
                    <button
                      type="button"
                      className="gm-btn gm-btn--sm gm-btn--icon"
                      aria-label="Open the full report"
                    >
                      <IconExternal />
                    </button>
                  }
                />
                <CardBody>
                  <ReportPanel report={active} />
                </CardBody>
              </Card>

              <Card>
                <CardHead title="GMV by game" sub="Share of the period, largest first" />
                <CardBody>
                  <ColumnChart
                    data={gameSplit.map((g) => ({ label: g.label, value: g.value }))}
                    height={216}
                    color="var(--grad-gold)"
                    format={(n) => `${n}%`}
                  />
                </CardBody>
              </Card>
            </div>

            {/* Four panels of the same height, each filling it. `gm-panels`
                spreads the contents rather than letting the shortest card
                trail a block of white under its last line. */}
            <div className="gm-grid gm-grid--4 gm-panels">
              <Card>
                <CardHead title="Decisions" sub={`${totalDecisions} submissions`} />
                <CardBody>
                  <RingChart rings={decisionSplit} />
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Inside the target" sub="Decided within 24h" />
                <CardBody>
                  <div className="gm-panel-figure">
                    <Gauge value={onTime} label={`${onTime}%`} caption="on time" size={138} thickness={12} />
                  </div>

                  <div className="gm-factstrip">
                    <span>
                      <i>Median</i>
                      <b>5h 12m</b>
                    </span>
                    <span>
                      <i>Breached</i>
                      <b>28</b>
                    </span>
                  </div>

                  <button type="button" className="gm-panel-link">
                    <IconDownload />
                    Throughput report
                  </button>
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Conflict outcomes" sub="Where cases landed" />
                <CardBody>
                  <BarList rows={conflictOutcomes} fill />
                </CardBody>
              </Card>

              {/* the selected report's paperwork, beside the chart above */}
              <Card>
                <CardHead title="Report detail" sub={`${active.name} · ${active.category}`} />
                <CardBody>
                  <div className="gm-report-headline">
                    <b>{active.headline}</b>
                    <span>{active.headlineLabel}</span>
                    <Spark
                      points={active.trend}
                      width={140}
                      height={38}
                      color={CHART_TONE[active.chart]}
                    />
                  </div>

                  <div className="gm-report-facts">
                    <span>
                      <i>Schedule</i>
                      {active.cadence}
                    </span>
                    <span>
                      <i>Last run</i>
                      {active.updated === "Live" ? (
                        <b className="gm-badge gm-badge--ok">Live</b>
                      ) : (
                        active.updated
                      )}
                    </span>
                    <span>
                      <i>Formats</i>
                      {active.format}
                    </span>
                  </div>

                  <button type="button" className="gm-panel-link gm-panel-link--solid">
                    <IconDownload />
                    Download report
                  </button>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>

        {/* --------------------------------------------- the period in figures */}
        <div className="gm-grid gm-grid--4">
          {reportKpis.map((k) => (
            <StatTile
              key={k.key}
              label={k.label}
              value={k.value}
              delta={k.delta}
              foot={k.foot}
              tone={k.tone}
              icon={KPI_ICONS[k.key]}
            />
          ))}
        </div>
      </div>
    </>
  );
}
