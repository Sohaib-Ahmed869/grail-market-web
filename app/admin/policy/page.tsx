"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  fetchSettings,
  saveSettings,
  type Settings,
} from "../lib/api";
import {
  Badge,
  BlockHead,
  Card,
  KpiBar,
  Loading,
  Modal,
  Note,
  PageHead,
  StatTile,
  Toast,
  Toggle,
} from "../components/ui";
import {
  IconAlert,
  IconBan,
  IconCheck,
  IconClock,
  IconFlag,
  IconInfo,
  IconLock,
  IconRefresh,
} from "../components/icons";
import { Gate } from "../components/Gate";
import "../policy.css";

/**
 * "What revoking does", on the member record, in one sentence: a footnote
 * popover beside the action it explains rather than a card of its own that
 * says the same thing on every visit. Grading companies get the same
 * treatment here for the same reason — it is reference copy nobody reads
 * twice, and a full card for five badges and a paragraph left the KPIs above
 * it looking like half a page. See `RevokeInfoButton` in
 * `members/[id]/page.tsx`; this is the same pattern under its own name
 * because `.gm-revokeinfo*` in member-record.css loads only on that page.
 */
function GradingInfoButton() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="gm-policyinfo" ref={wrap}>
      <button
        type="button"
        className="gm-btn gm-btn--ghost gm-btn--icon gm-btn--sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Accepted grading companies"
        aria-label="Accepted grading companies"
      >
        <IconInfo />
      </button>
      {open ? (
        <div className="gm-policyinfo-pop" role="note">
          <p className="gm-sm gm-muted" style={{ marginTop: 0 }}>
            A grade is never converted between companies to reach a price. A BGS 9.5 is not a PSA
            10, CGC has two different 10s, and SGC legacy slabs use a 100-point scale, so each is
            valued from its own sales only.
          </p>
          <div className="gm-row" style={{ gap: 8 }}>
            {["PSA", "BGS", "CGC", "SGC", "TAG"].map((g) => (
              <Badge key={g} tone="navy">
                {g}
              </Badge>
            ))}
            <Badge tone="warn">BCCG · discount tier</Badge>
            <Badge tone="bad">BRCR · priced as raw</Badge>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** What a setting falls back to when nothing is stored and nothing is typed.
 *  Mirrors the API's own defaults — see settings.store.ts. Split out of the
 *  old Settings page: this page only ever reads and writes the reports and
 *  conduct fields, so it only needs their defaults. */
const DEFAULTS: Pick<Settings, "pauseOnReport" | "reportWindowDays" | "autoEscalateHours" | "strikeLimit"> = {
  pauseOnReport: true,
  reportWindowDays: 14,
  autoEscalateHours: 72,
  strikeLimit: 3,
};

function PolicyPage() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [dirty, setDirty] = useState<Partial<Settings>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<{ title: string; body: string } | null>(null);
  const [editingPolicy, setEditingPolicy] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchSettings()
      .then((r) => {
        if (!live) return;
        setSaved(r.settings);
        setCanEdit(r.canEdit);
        setDirty({});
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  function val<K extends keyof typeof DEFAULTS>(k: K): Settings[K] {
    return (dirty[k] ?? saved?.[k] ?? DEFAULTS[k]) as Settings[K];
  }
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setDirty((d) => ({ ...d, [k]: v }));

  const changes = Object.keys(dirty).length;

  async function save() {
    if (!changes || saving) return;
    setSaving(true);
    try {
      const r = await saveSettings(dirty);
      setSaved(r.settings);
      setDirty({});
      setSaveToast({
        title: r.changed.length ? `${r.changed.length} setting${r.changed.length === 1 ? "" : "s"} saved` : "Nothing changed",
        body: r.changed.length
          ? r.changed.join(", ")
          : "Every value already matched what is stored.",
      });
    } catch (e) {
      setSaveToast({
        title: "Nothing was saved",
        body: e instanceof ApiError ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  const numField = (k: keyof typeof DEFAULTS) =>
    [String(val(k)), (v: string) => set(k, (Number(v) || 0) as never)] as const;

  const [pauseOnReport, setPauseOnReport] = [
    Boolean(val("pauseOnReport")),
    (v: boolean) => set("pauseOnReport", v as never),
  ] as const;
  const [reportWindow, setReportWindow] = numField("reportWindowDays");
  const [autoEscalate, setAutoEscalate] = numField("autoEscalateHours");
  const [strikeLimit, setStrikeLimit] = numField("strikeLimit");

  return (
    <>
      <PageHead
        title="Marketplace policy"
        sub="What happens on its own when one member reports another. No money passes through the platform, so every lever here acts on standing."
        right={
          <>
            <button
              type="button"
              className="gm-btn"
              disabled={!changes || saving}
              onClick={() => setDirty({})}
            >
              <IconRefresh />
              Discard {changes > 0 ? changes : ""}
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={!changes || saving || !canEdit}
              onClick={save}
              title={canEdit ? undefined : "Your role cannot change settings."}
            >
              <IconCheck />
              {saving ? "Saving…" : changes > 0 ? `Save ${changes}` : "Save changes"}
            </button>
          </>
        }
      />

      <div className="gm-stack">
        {loadError ? (
          <Note tone="bad">
            <b>Settings could not be read.</b> {loadError} Everything below is the fallback the
            API uses when nothing is set, not what is stored.
          </Note>
        ) : null}

        {!loading && !canEdit ? (
          <Note>
            <b>You can read these but not change them.</b> Editing settings needs an owner.
          </Note>
        ) : null}

        {loading ? (
          <Card>
            <Loading label="Reading policy…" />
          </Card>
        ) : (
          <>
            <BlockHead
              title="Reports and conduct"
              sub="What happens on its own when one member reports another"
              right={
                <>
                  {canEdit ? (
                    <button
                      type="button"
                      className="gm-btn gm-btn--primary gm-btn--sm"
                      onClick={() => setEditingPolicy(true)}
                    >
                      Edit policy
                    </button>
                  ) : null}
                  <GradingInfoButton />
                </>
              }
            />

            <KpiBar>
              <StatTile
                tone="blue"
                label="On a report"
                value={pauseOnReport ? "Paused" : "Untouched"}
                icon={pauseOnReport ? <IconLock /> : <IconBan />}
                foot="The reported member's listings"
              />
              <StatTile
                tone="orange"
                label="Reporting window"
                value={`${reportWindow} day${Number(reportWindow) === 1 ? "" : "s"}`}
                icon={<IconClock />}
                foot="After a trade, before it closes"
              />
              <StatTile
                tone="green"
                label="Auto-escalate after"
                value={`${autoEscalate} hour${Number(autoEscalate) === 1 ? "" : "s"}`}
                icon={<IconFlag />}
                foot="To Trust and safety, with no finding"
              />
              <StatTile
                tone="violet"
                label="Strike limit"
                value={`${strikeLimit} strike${Number(strikeLimit) === 1 ? "" : "s"}`}
                icon={<IconAlert />}
                foot="Opens a member review"
              />
            </KpiBar>
          </>
        )}
      </div>

      <Modal
        open={editingPolicy}
        onClose={() => setEditingPolicy(false)}
        title="Edit policy"
        sub="Changes here join the rest of the page's unsaved changes — Save still commits them."
        footer={
          <button type="button" className="gm-btn gm-btn--primary" onClick={() => setEditingPolicy(false)}>
            <IconCheck />
            Done
          </button>
        }
      >
        <div className="gm-field">
          <span className="gm-label">Pause the reported member's listings when a case opens</span>
          <Toggle checked={pauseOnReport} onChange={setPauseOnReport} label="Pause listings on report" />
          <span className="gm-hint">
            Their live listings come off the market until the case closes. Buying and browsing are
            untouched. Turning this off leaves an account trading while it is under review.
          </span>
        </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="pl-window">
            Reporting window
          </label>
          <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input
              id="pl-window"
              className="gm-input gm-mono"
              style={{ width: 84, textAlign: "right" }}
              value={reportWindow}
              onChange={(e) => setReportWindow(e.target.value)}
              inputMode="numeric"
              aria-label="Reporting window in days"
            />
            <span className="gm-muted">days</span>
          </div>
          <span className="gm-hint">How long after a trade one member can still report the other's conduct.</span>
        </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="pl-escalate">
            Auto-escalate after
          </label>
          <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input
              id="pl-escalate"
              className="gm-input gm-mono"
              style={{ width: 84, textAlign: "right" }}
              value={autoEscalate}
              onChange={(e) => setAutoEscalate(e.target.value)}
              inputMode="numeric"
              aria-label="Auto escalate after hours"
            />
            <span className="gm-muted">hours</span>
          </div>
          <span className="gm-hint">
            An open case with no finding is escalated to Trust and safety at this age. Threats skip
            the clock and escalate on arrival.
          </span>
        </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="pl-strikes">
            Strikes before automatic member review
          </label>
          <input
            id="pl-strikes"
            className="gm-input gm-mono"
            style={{ width: 84, textAlign: "right" }}
            value={strikeLimit}
            onChange={(e) => setStrikeLimit(e.target.value)}
            inputMode="numeric"
            aria-label="Strike limit"
          />
          <span className="gm-hint">
            Authenticity rejections and upheld conduct cases both count. Reaching the limit opens a
            member review, but does not close the account on its own.
          </span>
        </div>
      </Modal>

      {saveToast ? (
        <Toast title={saveToast.title} body={saveToast.body} onDone={() => setSaveToast(null)} />
      ) : null}
    </>
  );
}

export default function GatedPolicyPage() {
  return (
    <Gate need="settings.write">
      <PolicyPage />
    </Gate>
  );
}
