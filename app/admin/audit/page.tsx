"use client";

import { useEffect, useRef, useState } from "react";
import { shortDate } from "../lib/data";
import {
  ApiError,
  AUDIT_AREAS,
  fetchAudit,
  type AuditArea,
  type AuditEntry,
} from "../lib/api";
import {
  Badge,
  Card,
  CardHead,
  Empty,
  FilterMenu,
  Note,
  PageHead,
} from "../components/ui";
import {
  IconDownload,
  IconKey,
  IconListing,
  IconLock,
  IconReport,
  IconScale,
  IconSearch,
  IconSettings,
  IconSupport,
  IconTag,
  IconUsers,
} from "../components/icons";
import { Gate } from "../components/Gate";
import { exportCsv } from "../lib/csv";

const AREA_LABEL: Record<AuditArea, string> = {
  listing: "Listings",
  member: "Members",
  conduct: "Reports & conduct",
  support: "Support",
  billing: "Billing",
  pricing: "Price engine",
  settings: "Settings",
  staff: "Staff",
};

function AreaIcon({ area }: { area: AuditArea }) {
  switch (area) {
    case "listing":
      return <IconListing />;
    case "member":
      return <IconUsers />;
    case "conduct":
      return <IconScale />;
    case "support":
      return <IconSupport />;
    case "billing":
      return <IconTag />;
    case "pricing":
      return <IconReport />;
    case "staff":
      return <IconKey />;
    default:
      return <IconSettings />;
  }
}

/** Hold the search box still for a moment before asking the database. Same
 *  debounce the listing queue uses, for the same reason. */
function useDebounced(value: string, ms: number) {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return held;
}

function AuditPage() {
  const [area, setArea] = useState("all");
  const [actor, setActor] = useState("all");
  const [weight, setWeight] = useState("all");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 220);

  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [totals, setTotals] = useState({ all: 0, high: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  /* Filtering, searching and counting are the database's job. The page used
     to hold the whole log in the bundle and cut it down here, which is fine
     at thirteen rows and not at the seven years it promises below. */
  useEffect(() => {
    const seq = ++latest.current;
    setLoading(true);
    fetchAudit({ area, actor, weight, search: debounced })
      .then((r) => {
        if (seq !== latest.current) return;
        setRows(r.entries);
        setActors(r.actors);
        setTotals(r.totals);
        setError(null);
      })
      .catch((e) => {
        if (seq !== latest.current) return;
        setError(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => {
        if (seq === latest.current) setLoading(false);
      });
  }, [area, actor, weight, debounced]);

  const applied =
    (area === "all" ? 0 : 1) + (actor === "all" ? 0 : 1) + (weight === "all" ? 0 : 1);

  /** What is on screen, as a spreadsheet. The filters and the search apply —
   *  exporting the unfiltered log would be a different, unasked-for answer. */
  function exportRows() {
    exportCsv(`grailmarket-audit-${area}`, rows, [
      { header: "Entry", value: (e) => e.id },
      { header: "When", value: (e) => e.at },
      { header: "Operator", value: (e) => e.actor },
      { header: "Area", value: (e) => AREA_LABEL[e.area] },
      { header: "Action", value: (e) => e.action },
      { header: "Target", value: (e) => e.target },
      { header: "Reason recorded", value: (e) => e.detail ?? "" },
      { header: "Weight", value: (e) => e.weight },
    ]);
  }

  return (
    <>
      <PageHead
        title="Audit log"
        sub="Who approved, rejected, restricted, comped or escalated, and when. Nothing here can be edited or deleted by anyone."
        right={
          <button type="button" className="gm-btn" onClick={exportRows} disabled={rows.length === 0}>
            <IconDownload />
            Export
          </button>
        }
      />

      <div className="gm-stack">
        {/* A console that cannot reach its API must say so. An empty log and a
            broken connection look identical otherwise, and one of them means
            nobody has done anything while the other means we cannot tell. */}
        {error ? (
          <Note tone="bad">
            <b>The log could not be read.</b> {error}
          </Note>
        ) : null}

        <Note tone="gold">
          <b>Entries can be added and read here, but not changed.</b> There is no edit and no
          delete — not on this page and not on the API behind it. This is the record that gets
          checked when somebody challenges a decision.
        </Note>

        <Card>
          {/* One filter language, the same as the listing queue and the case
              board: the heading names what is shown, its subtitle spells out
              what is applied, and the control sits beside it. This page used
              to carry a bar of four bare dropdowns of its own. */}
          <CardHead
            title="Entries"
            sub={
              loading && rows.length === 0
                ? "Reading the log…"
                : `${rows.length} of ${totals.all}, newest first · ${totals.high} changed someone’s standing or money`
            }
            right={
              <div className="gm-row" style={{ gap: 8 }}>
                <div className="gm-search" style={{ width: 224 }}>
                  <IconSearch />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Handle, listing id, reason…"
                    aria-label="Search the log"
                  />
                </div>
                <FilterMenu
                  applied={applied}
                  onClear={() => {
                    setArea("all");
                    setActor("all");
                    setWeight("all");
                  }}
                  groups={[
                    {
                      key: "area",
                      label: "Area",
                      value: area,
                      onChange: setArea,
                      options: [
                        { value: "all", label: "Everything" },
                        ...AUDIT_AREAS.map((k) => ({ value: k, label: AREA_LABEL[k] })),
                      ],
                    },
                    {
                      key: "actor",
                      label: "Operator",
                      value: actor,
                      onChange: setActor,
                      options: [
                        { value: "all", label: "Anyone" },
                        ...actors.map((a) => ({ value: a, label: a })),
                      ],
                    },
                    {
                      key: "weight",
                      label: "Weight",
                      value: weight,
                      onChange: setWeight,
                      options: [
                        { value: "all", label: "Everything" },
                        { value: "high", label: "Consequential only" },
                      ],
                    },
                  ]}
                />
              </div>
            }
          />

          {/* Loading and empty are different answers and must not share a
              screen: "Nothing matches" while the request is still in flight
              tells an auditor their filter is wrong when it is not. */}
          {loading && rows.length === 0 ? (
            <Empty icon={<IconSearch />} title="Reading the log…" />
          ) : rows.length === 0 ? (
            <Empty
              icon={<IconSearch />}
              title={applied > 0 || query ? "Nothing matches" : "Nothing logged yet"}
              body={
                applied > 0 || query
                  ? "Widen a filter or clear the search."
                  : "The log fills as decisions are taken in the console."
              }
            />
          ) : (
            <div className="gm-feed" style={{ padding: "4px 16px 16px" }}>
              {rows.map((e) => (
                <div key={e.id} className="gm-feed-item">
                  <span
                    className={`gm-feed-ico ${
                      e.weight === "high" ? "gm-feed-ico--bad" : "gm-feed-ico--gold"
                    }`}
                  >
                    <AreaIcon area={e.area} />
                  </span>
                  <div className="gm-feed-body">
                    <p className="gm-row" style={{ gap: 8 }}>
                      <b>{e.action}</b>
                      <span className="gm-mono gm-sm gm-dim">{e.target}</span>
                      {e.weight === "high" ? <Badge tone="bad">Consequential</Badge> : null}
                    </p>
                    {e.detail ? <p className="gm-sm gm-muted">{e.detail}</p> : null}
                    <div className="gm-feed-time">
                      <span className="gm-scope" style={{ marginRight: 6 }}>
                        {AREA_LABEL[e.area]}
                      </span>
                      {e.actor} · {shortDate(e.at)} · <span className="gm-mono">{e.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="gm-row gm-tiny gm-dim" style={{ gap: 7, margin: 0 }}>
          <IconLock style={{ width: 12, height: 12 }} />
          Retained for seven years. Released outside Grail Market only on a lawful request.
        </p>
      </div>
    </>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedAuditPage() {
  return (
    <Gate need="audit.read">
      <AuditPage />
    </Gate>
  );
}
