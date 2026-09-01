"use client";

import { useMemo, useState } from "react";
import {
  conflictOutcomes,
  decisionSplit,
  gameSplit,
  gmvSeries,
  reportKpis,
  reports,
  type Report,
} from "../lib/data";
import {
  AreaChart,
  BarList,
  Card,
  CardBody,
  CardHead,
  ColumnChart,
  Donut,
  Empty,
  PageHead,
  StatTile,
  PillTabs,
} from "../components/ui";
import {
  IconCheckCircle,
  IconClock,
  IconDownload,
  IconExternal,
  IconRefresh,
  IconReport,
  IconScale,
  IconTrend,
} from "../components/icons";

type Cat = "All" | Report["category"];

const CATS: Cat[] = ["All", "Marketplace", "Moderation", "Finance", "Members"];
const PERIODS = ["Last 7 days", "Last 30 days", "This quarter", "Year to date"];

const KPI_ICONS: Record<string, React.ReactNode> = {
  r1: <IconCheckCircle />,
  r2: <IconClock />,
  r3: <IconScale />,
  r4: <IconTrend />,
};

export default function ReportsPage() {
  const [cat, setCat] = useState<Cat>("All");
  const [period, setPeriod] = useState(PERIODS[1]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: reports.length };
    for (const r of reports) c[r.category] = (c[r.category] ?? 0) + 1;
    return c;
  }, []);

  const rows = useMemo(
    () => reports.filter((r) => cat === "All" || r.category === cat),
    [cat]
  );

  const totalDecisions = decisionSplit.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <PageHead
        title="Reports"
        sub="The numbers behind the marketplace, and the scheduled exports that carry them out of here."
        right={
          <>
            <select
              className="gm-select"
              style={{ width: 168 }}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Reporting period"
            >
              {PERIODS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
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

        <div className="gm-grid gm-grid--2a">
          <Card>
            <CardHead
              title="Volume and throughput"
              sub={`${period} · GMV against verifications cleared`}
            />
            <CardBody>
              <AreaChart data={gmvSeries} height={210} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Verification decisions" sub={`${totalDecisions} submissions in the period`} />
            <CardBody>
              <Donut
                slices={decisionSplit}
                centerValue={`${Math.round((decisionSplit[0].value / totalDecisions) * 100)}%`}
                centerLabel="verified"
              />
            </CardBody>
          </Card>
        </div>

        <div className="gm-grid gm-grid--2">
          <Card>
            <CardHead title="Conflict outcomes" sub="Where cases landed once decided" />
            <CardBody>
              <BarList rows={conflictOutcomes} />
            </CardBody>
          </Card>

          <Card>
            <CardHead title="GMV by game" sub="Share of the period, largest first" />
            <CardBody>
              <BarList
                rows={gameSplit.map((g) => ({ label: g.label, value: g.value, hint: g.amount }))}
                tone="gold"
              />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHead
            title="Weekly submissions"
            sub="Twelve weeks. The tallest column is the current period."
          />
          <CardBody>
            <ColumnChart data={gmvSeries.map((g) => ({ label: g.label, value: g.verified }))} />
          </CardBody>
        </Card>

        {/* --------------------------------------------------- report catalogue */}
        <Card>
          <CardHead
            title="Scheduled reports"
            sub={`${rows.length} of ${reports.length} shown`}
            right={
              <PillTabs
                value={cat}
                onChange={setCat}
                options={CATS.map((c) => ({ key: c, label: c, count: counts[c] ?? 0 }))}
              />
            }
          />

          {rows.length === 0 ? (
            <Empty icon={<IconReport />} title="No reports in that category" />
          ) : (
            <div className="gm-tablewrap">
              <table className="gm-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Category</th>
                    <th>Schedule</th>
                    <th>Last run</th>
                    <th>Formats</th>
                    <th className="gm-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="gm-cell2">
                          <b>{r.name}</b>
                          <span style={{ maxWidth: "56ch", whiteSpace: "normal", lineHeight: 1.45 }}>
                            {r.detail}
                          </span>
                        </div>
                      </td>
                      <td className="gm-sm gm-muted gm-nowrap">{r.category}</td>
                      <td className="gm-sm gm-muted gm-nowrap">{r.cadence}</td>
                      <td className="gm-sm gm-nowrap">
                        {r.updated === "Live" ? (
                          <span className="gm-badge gm-badge--ok">Live</span>
                        ) : (
                          <span className="gm-muted">{r.updated}</span>
                        )}
                      </td>
                      <td className="gm-sm gm-dim gm-nowrap">{r.format}</td>
                      <td className="gm-actions">
                        <div className="gm-row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <button type="button" className="gm-btn gm-btn--sm">
                            <IconDownload />
                            Download
                          </button>
                          <button
                            type="button"
                            className="gm-btn gm-btn--sm gm-btn--icon"
                            aria-label="Open report"
                          >
                            <IconExternal />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
