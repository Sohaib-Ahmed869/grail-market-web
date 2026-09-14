"use client";

import { useEffect, useState } from "react";
import { aud } from "../lib/data";
import {
  ApiError,
  fetchSettings,
  saveSettings,
  type Settings,
} from "../lib/api";
import {
  BlockHead,
  Card,
  CardBody,
  KpiBar,
  Loading,
  Modal,
  Note,
  PageHead,
  StatTile,
  Toast,
  Toggle,
} from "../components/ui";
import { IconAlert, IconBan, IconCard, IconCheck, IconKey, IconRefresh } from "../components/icons";
import { Gate } from "../components/Gate";
import { Button } from "../components/Button";
import { TextField } from "../components/Field";
import "../thresholds.css";

/** What a setting falls back to when nothing is stored and nothing is typed.
 *  Mirrors the API's own defaults — see settings.store.ts. Split out of the
 *  old Settings page: this page only ever reads and writes the review-tier
 *  fields, so it only needs their defaults. */
const DEFAULTS: Pick<
  Settings,
  | "grailFloor"
  | "highValueFloor"
  | "requireCert"
  | "blockLowConfidence"
  | "minPhotos"
  | "allowRaw"
> = {
  grailFloor: 10000,
  highValueFloor: 2000,
  requireCert: true,
  blockLowConfidence: true,
  minPhotos: 4,
  allowRaw: false,
};

type TierKey = "standard" | "high" | "grail";

const TIER_LABEL: Record<TierKey, string> = {
  standard: "Standard tier",
  high: "High-value tier",
  grail: "Grail tier",
};

const TIER_BLURB: Record<TierKey, string> = {
  standard: "Below the high-value floor",
  high: "Between the two floors",
  grail: "At or above the grail floor",
};

/* The three tiers share the hues `.gm-tier`/`.gm-tier--high`/`.gm-tier--std`
   already use for this exact distinction everywhere else in the console — a
   member record, a listing row — so the ladder reads as the same three tiers
   rather than introducing a fourth palette for them. */
const TIER_COLOR: Record<TierKey, string> = {
  standard: "var(--tag-grey)",
  high: "var(--tag-gold)",
  grail: "var(--tag-violet)",
};

/**
 * Continuous, non-overlapping amount ranges drawn on one shared scale, so the
 * three tiers read as adjoining rather than as three unrelated numbers. A
 * plain read of the ladder rather than an interactive one — the rows do not
 * select and there is nothing underneath them to preview, so nothing here
 * invites a click that would not do anything.
 */
function TierLadder({ highFloor, grailFloor }: { highFloor: number; grailFloor: number }) {
  /* A visual scale only — never stored, never sent anywhere. Wide enough that
     the grail tier's tail reads as "and beyond" rather than as most of the
     bar. */
  const scaleMax = Math.max(grailFloor * 1.35, highFloor + 1, 1);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scaleMax) * 100));

  const rows: { key: TierKey; from: number; to: number | null }[] = [
    { key: "standard", from: 0, to: highFloor },
    { key: "high", from: highFloor, to: grailFloor },
    { key: "grail", from: grailFloor, to: null },
  ];

  return (
    <div className="gm-ladder">
      <div className="gm-ladder-ruler" aria-hidden="true">
        <span />
        <span className="gm-ladder-ruler-track">
          <span style={{ left: `${pct(0)}%` }}>$0</span>
          <span style={{ left: `${pct(highFloor)}%` }}>{aud(highFloor)}</span>
          <span style={{ left: `${pct(grailFloor)}%` }}>{aud(grailFloor)}+</span>
        </span>
        <span />
      </div>

      <div className="gm-ladder-rows">
        {rows.map((r) => {
          const start = pct(r.from);
          const end = r.to == null ? 100 : pct(r.to);
          return (
            <div
              key={r.key}
              className="gm-ladder-row"
              style={{ "--tier-color": TIER_COLOR[r.key] } as React.CSSProperties}
            >
              <span className="gm-ladder-row-id">
                <i className="gm-ladder-dot" />
                <span>
                  <b>{TIER_LABEL[r.key]}</b>
                  <i>{TIER_BLURB[r.key]}</i>
                </span>
              </span>
              <span className="gm-ladder-track">
                <span
                  className="gm-ladder-seg"
                  style={{ left: `${start}%`, width: `${Math.max(end - start, 1.5)}%` }}
                />
              </span>
              <span className="gm-ladder-range">
                <b>{aud(r.from)}</b>
                <b>{r.to == null ? "Unlimited" : aud(r.to)}</b>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThresholdsPage() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [dirty, setDirty] = useState<Partial<Settings>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<{ title: string; body: string } | null>(null);
  const [editingTiers, setEditingTiers] = useState(false);
  const [editingCarry, setEditingCarry] = useState(false);

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
  const boolField = (k: keyof typeof DEFAULTS) =>
    [Boolean(val(k)), (v: boolean) => set(k, v as never)] as const;

  const [grailFloor, setGrailFloor] = numField("grailFloor");
  const [highFloor, setHighFloor] = numField("highValueFloor");
  const [requireCert, setRequireCert] = boolField("requireCert");
  const [blockLowConfidence, setBlockLowConfidence] = boolField("blockLowConfidence");
  const [minPhotos, setMinPhotos] = numField("minPhotos");
  const [allowRaw, setAllowRaw] = boolField("allowRaw");

  return (
    <>
      <PageHead
        title="Review thresholds"
        sub="Where a submission goes the moment a seller files it, and what it must carry to get there."
        right={
          <>
            <Button disabled={!changes || saving} onClick={() => setDirty({})}>
              <IconRefresh />
              Discard {changes > 0 ? changes : ""}
            </Button>
            <Button
              variant="primary"
              disabled={!changes || saving || !canEdit}
              onClick={save}
              title={canEdit ? undefined : "Your role cannot change settings."}
            >
              <IconCheck />
              {saving ? "Saving…" : changes > 0 ? `Save ${changes}` : "Save changes"}
            </Button>
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
            <Loading label="Reading the thresholds…" />
          </Card>
        ) : (
          <>
            <BlockHead
              title="What a submission must carry"
              sub="Enforced before it reaches the queue"
              right={
                canEdit ? (
                  <Button variant="primary" size="sm" onClick={() => setEditingCarry(true)}>
                    Edit requirements
                  </Button>
                ) : null
              }
            />

            <KpiBar>
              <StatTile
                tone="blue"
                label="Certificate number"
                value={requireCert ? "Required" : "Not required"}
                icon={requireCert ? <IconKey /> : <IconBan />}
                foot="For slabbed cards"
              />
              <StatTile
                tone="orange"
                label="Low-confidence pricing"
                value={blockLowConfidence ? "Blocked" : "Allowed"}
                icon={blockLowConfidence ? <IconAlert /> : <IconCheck />}
                foot="Too few comparable sales"
              />
              <StatTile
                tone="green"
                label="Minimum photos"
                value={`${minPhotos} photo${Number(minPhotos) === 1 ? "" : "s"}`}
                icon={<IconCard />}
                foot="Grail tier always needs all four edges"
              />
              <StatTile
                tone="violet"
                label="Raw cards above the floor"
                value={allowRaw ? "Allowed" : "Not accepted"}
                icon={allowRaw ? <IconCheck /> : <IconBan />}
                foot="Hardest thing to authenticate from photos"
              />
            </KpiBar>

            <BlockHead
              title="Tier ladder"
              sub="Continuous, non-overlapping amount ranges."
              right={
                canEdit ? (
                  <Button variant="primary" size="sm" onClick={() => setEditingTiers(true)}>
                    Edit thresholds
                  </Button>
                ) : null
              }
            />

            <Card>
              <CardBody>
                <TierLadder
                  highFloor={Number(val("highValueFloor")) || 0}
                  grailFloor={Number(val("grailFloor")) || 0}
                />
              </CardBody>
            </Card>
          </>
        )}
      </div>

      <Modal
        open={editingTiers}
        onClose={() => setEditingTiers(false)}
        title="Edit thresholds"
        sub="Changes here join the rest of the page's unsaved changes — Save still commits them."
        footer={
          <Button variant="primary" onClick={() => setEditingTiers(false)}>
            <IconCheck />
            Done
          </Button>
        }
      >
        <div className="gm-field">
          <label className="gm-label" htmlFor="th-grail-floor">
            Grail tier floor
          </label>
          <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <span className="gm-muted">$</span>
            <TextField
              id="th-grail-floor"
              className="gm-mono"
              style={{ width: 140, textAlign: "right" }}
              value={grailFloor}
              onChange={(e) => setGrailFloor(e.target.value)}
              inputMode="numeric"
              aria-label="Grail tier floor"
            />
          </div>
          <span className="gm-hint">
            At or above this ask price, a card is held for full manual verification: cert lookup,
            every photo, and provenance where the price data is thin.
          </span>
        </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="th-high-floor">
            High-value floor
          </label>
          <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <span className="gm-muted">$</span>
            <TextField
              id="th-high-floor"
              className="gm-mono"
              style={{ width: 140, textAlign: "right" }}
              value={highFloor}
              onChange={(e) => setHighFloor(e.target.value)}
              inputMode="numeric"
              aria-label="High value floor"
            />
          </div>
          <span className="gm-hint">
            Between this and the grail floor, a submission gets a lighter review: cert lookup and a
            photo pass.
          </span>
        </div>
      </Modal>

      <Modal
        open={editingCarry}
        onClose={() => setEditingCarry(false)}
        title="Edit requirements"
        sub="Changes here join the rest of the page's unsaved changes — Save still commits them."
        footer={
          <Button variant="primary" onClick={() => setEditingCarry(false)}>
            <IconCheck />
            Done
          </Button>
        }
      >
        <div className="gm-field">
          <span className="gm-label">Require a certificate number for slabbed cards</span>
          <Toggle checked={requireCert} onChange={setRequireCert} label="Require certificate" />
          <span className="gm-hint">
            Checked against the grading company&rsquo;s register. A grade always belongs to a
            company, so there is no grade-only lookup.
          </span>
        </div>

        <div className="gm-field">
          <span className="gm-label">Block release on a low-confidence valuation</span>
          <Toggle
            checked={blockLowConfidence}
            onChange={setBlockLowConfidence}
            label="Block low-confidence release"
          />
          <span className="gm-hint">
            If there are too few comparable sales for this exact grader and grade, the card cannot
            be released without a moderator overriding it in writing.
          </span>
        </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="th-min-photos">
            Minimum photos
          </label>
          <TextField
            id="th-min-photos"
            className="gm-mono"
            style={{ width: 84, textAlign: "right" }}
            value={minPhotos}
            onChange={(e) => setMinPhotos(e.target.value)}
            inputMode="numeric"
            aria-label="Minimum photos"
          />
          <span className="gm-hint">
            Front, back and the slab label at minimum. Grail tier always requires all four edges
            regardless of this number.
          </span>
        </div>

        <div className="gm-field">
          <span className="gm-label">Allow raw (ungraded) cards above the high-value floor</span>
          <Toggle checked={allowRaw} onChange={setAllowRaw} label="Allow expensive raw cards" />
          <span className="gm-hint">
            Off by default. An expensive raw card is the hardest thing on the platform to
            authenticate from photographs.
          </span>
        </div>
      </Modal>

      {saveToast ? (
        <Toast title={saveToast.title} body={saveToast.body} onDone={() => setSaveToast(null)} />
      ) : null}
    </>
  );
}

export default function GatedThresholdsPage() {
  return (
    <Gate need="settings.write">
      <ThresholdsPage />
    </Gate>
  );
}
