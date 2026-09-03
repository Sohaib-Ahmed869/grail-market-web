"use client";

import { useMemo, useState } from "react";
import {
  auditActors,
  auditLog,
  shortDate,
  type AuditArea,
  type AuditEntry,
} from "../lib/data";
import {
  Badge,
  Card,
  CardHead,
  Empty,
  FilterField,
  Note,
  PageHead,
  Select,
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

function AuditPage() {
  const [area, setArea] = useState("all");
  const [actor, setActor] = useState("all");
  const [weight, setWeight] = useState("all");
  const [query, setQuery] = useState("");

  /* Read on every render rather than memoised on a counter: a decision taken
     in another tab of this console lands in the same module-level list, and
     the log is the one screen where showing a stale view is the actual bug. */
  const all: AuditEntry[] = auditLog();
  const actors = auditActors();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((e) => {
      if (area !== "all" && e.area !== area) return false;
      if (actor !== "all" && e.actor !== actor) return false;
      if (weight === "high" && e.weight !== "high") return false;
      if (!q) return true;
      return (
        e.action.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        (e.detail ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, area, actor, weight, query]);

  const heavy = all.filter((e) => e.weight === "high").length;

  return (
    <>
      <PageHead
        title="Audit log"
        sub="Who approved, rejected, restricted, comped or escalated, and when. Nothing here can be edited or deleted by anyone."
        right={
          <button type="button" className="gm-btn">
            <IconDownload />
            Export
          </button>
        }
      />

      <div className="gm-stack">
        <div className="gm-filterbar">
          <FilterField label="Area" htmlFor="au-area">
            <Select
              id="au-area"
              variant="bare"
              value={area}
              onChange={setArea}
              ariaLabel="Filter the log by area"
              options={[
                { value: "all", label: "Everything" },
                ...(Object.keys(AREA_LABEL) as AuditArea[]).map((k) => ({
                  value: k,
                  label: AREA_LABEL[k],
                })),
              ]}
            />
          </FilterField>
          <FilterField label="Operator" htmlFor="au-actor">
            <Select
              id="au-actor"
              variant="bare"
              value={actor}
              onChange={setActor}
              ariaLabel="Filter the log by operator"
              options={[{ value: "all", label: "Anyone" }, ...actors]}
            />
          </FilterField>
          <FilterField label="Weight" htmlFor="au-weight">
            <Select
              id="au-weight"
              variant="bare"
              value={weight}
              onChange={setWeight}
              ariaLabel="Filter the log by weight"
              options={[
                { value: "all", label: "Everything" },
                { value: "high", label: "Consequential only" },
              ]}
            />
          </FilterField>
          <FilterField label="Search" htmlFor="au-q">
            <input
              id="au-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Handle, listing id, reason…"
            />
          </FilterField>
        </div>

        <Note tone="gold">
          <b>Entries can be added and read here, but not changed.</b> There is no edit and no
          delete. This is the record that gets checked when somebody challenges a decision.
        </Note>

        {rows.length === 0 ? (
          <Card>
            <Empty
              icon={<IconSearch />}
              title="Nothing matches"
              body="Widen a filter or clear the search."
            />
          </Card>
        ) : (
          <Card>
            <CardHead
              title="Entries"
              sub={`${rows.length} of ${all.length}, newest first. ${heavy} changed someone\u2019s standing or money.`}
            />
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
          </Card>
        )}

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
