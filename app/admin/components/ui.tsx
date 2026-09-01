"use client";

/**
 * The pieces every admin page is built from. Presentation only — no page here
 * knows where its data came from, which is what keeps the swap from sample
 * data to a real endpoint a one-line change in the page above it.
 */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders overlays at the end of <body> instead of wherever the page happens
 * to mount them.
 *
 * `position: fixed` resolves against the nearest ancestor that establishes a
 * containing block, not always the viewport — and a transform, a filter, or a
 * `backdrop-filter` on any ancestor is enough to become one. `.gm-content`
 * animates `transform` with `animation-fill-mode: both`, so it stays a
 * containing block permanently even though the computed value ends at `none`.
 * A drawer mounted inside it therefore anchored to the scrolled <main>: open
 * one halfway down the page and it started halfway down the screen.
 *
 * The host is `#gm-overlays`, rendered by the admin layout as a child of `.gm`
 * and a sibling of the shell. It has to sit INSIDE `.gm` — every colour token
 * and the font variable are declared there, so portalling to <body> would put
 * the overlay outside its own design system. It is outside `.gm-content`,
 * which is the part that carries the transform.
 *
 * If the host is missing the overlay renders in place rather than vanishing:
 * mispositioned beats invisible.
 */
function OverlayPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById("gm-overlays"));
  }, []);

  if (!host) return <>{children}</>;
  return createPortal(children, host);
}

/**
 * Holds the page still while an overlay is open. Reference-counted, because
 * a Modal can open on top of a Drawer and the inner one closing must not
 * unlock the page underneath the outer one.
 */
let scrollLocks = 0;

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const body = document.body;
    if (scrollLocks === 0) {
      /* the scrollbar vanishes with overflow:hidden — pad by its width so the
         layout underneath does not jump sideways */
      const gap = window.innerWidth - document.documentElement.clientWidth;
      body.dataset.gmPrevOverflow = body.style.overflow;
      body.dataset.gmPrevPadding = body.style.paddingRight;
      body.style.overflow = "hidden";
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    }
    scrollLocks += 1;

    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        body.style.overflow = body.dataset.gmPrevOverflow ?? "";
        body.style.paddingRight = body.dataset.gmPrevPadding ?? "";
        delete body.dataset.gmPrevOverflow;
        delete body.dataset.gmPrevPadding;
      }
    };
  }, [active]);
}
import {
  IconAlert,
  IconArrowDown,
  IconArrowRight,
  IconArrowUp,
  IconCheck,
  IconCheckCircle,
  IconFlag,
  IconGrid,
  IconInfo,
  IconRows,
  IconStar,
  IconX,
} from "./icons";

/* ==========================================================================
   Card
   ========================================================================== */

export function Card({
  children,
  pad,
  lift,
  className = "",
  style,
}: {
  children: ReactNode;
  pad?: boolean;
  lift?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={`gm-card${pad ? " gm-card--pad" : ""}${lift ? " gm-card--lift" : ""} ${className}`}
      style={style}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  sub,
  right,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="gm-card-head">
      <div style={{ minWidth: 0 }}>
        <h3>{title}</h3>
        {sub ? <p>{sub}</p> : null}
      </div>
      {right ? <div className="gm-spacer">{right}</div> : null}
    </header>
  );
}

export function CardBody({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="gm-card-body" style={style}>
      {children}
    </div>
  );
}

/* ==========================================================================
   Page header
   ========================================================================== */

export function PageHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="gm-page-head">
      <div style={{ minWidth: 0 }}>
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </div>
      {right ? (
        <div className="gm-spacer gm-row" style={{ gap: 8 }}>
          {right}
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Stat tile
   ========================================================================== */

export function StatTile({
  label,
  value,
  icon,
  tone = "plain",
  delta,
  foot,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "navy" | "gold" | "plain";
  delta?: { dir: "up" | "down" | "flat"; text: string };
  foot?: string;
}) {
  return (
    <div className="gm-stat">
      <div className="gm-stat-top">
        {icon ? (
          <span
            className={`gm-stat-ico${tone === "navy" ? " gm-stat-ico--navy" : tone === "gold" ? " gm-stat-ico--gold" : ""}`}
          >
            {icon}
          </span>
        ) : null}
        <span className="gm-stat-label">{label}</span>
      </div>
      <div className="gm-stat-value">{value}</div>
      <div className="gm-stat-foot">
        {delta ? (
          <span className={`gm-delta gm-delta--${delta.dir}`}>
            {delta.dir === "up" ? <IconArrowUp /> : delta.dir === "down" ? <IconArrowDown /> : null}
            {delta.text}
          </span>
        ) : null}
        {foot ? <span>{foot}</span> : null}
      </div>
    </div>
  );
}

/* ==========================================================================
   Badge / tier chip
   ========================================================================== */

type BadgeTone = "ok" | "warn" | "bad" | "info" | "gold" | "navy" | "idle";

export function Badge({
  tone = "idle",
  children,
  noDot,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  noDot?: boolean;
}) {
  const cls = tone === "idle" ? "" : ` gm-badge--${tone}`;
  return <span className={`gm-badge${cls}${noDot ? " gm-badge--nodot" : ""}`}>{children}</span>;
}

export function Tier({ tier }: { tier: "grail" | "high-value" | "standard" }) {
  if (tier === "grail") return <span className="gm-tier gm-tier--high">Grail</span>;
  if (tier === "high-value") return <span className="gm-tier">High value</span>;
  return <span className="gm-tier gm-tier--std">Standard</span>;
}

/* ==========================================================================
   Avatar
   ========================================================================== */

export function Avatar({
  initials,
  gold,
  size = "md",
}: {
  initials: string;
  gold?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const s = size === "sm" ? " gm-av--sm" : size === "lg" ? " gm-av--lg" : "";
  return <span className={`gm-av${gold ? " gm-av--gold" : ""}${s}`}>{initials}</span>;
}

/* ==========================================================================
   The card
   ========================================================================== */

/** Game → the CSS modifier that carries its colour and its slab art. */
const GAME_KEY: Record<string, string> = {
  "Pokémon": "pokemon",
  Magic: "magic",
  "Yu-Gi-Oh!": "yugioh",
  "One Piece": "onepiece",
  Sports: "sports",
};

export function gameKey(game?: string) {
  return (game && GAME_KEY[game]) || "pokemon";
}

/**
 * A graded slab: the grading company's label across the top, the card behind
 * a window below it. Raw cards drop the label and get a corner tag instead.
 *
 * `holo` puts a slow sheen across the window — reserved for the chase cards
 * (a 10, or anything at grail tier), so it means something rather than being
 * sprinkled everywhere. Stands in for the real photo until image storage
 * exists; the shape and proportions are already right for it.
 */
export function Slab({
  grader,
  grade,
  game,
  size = "md",
  holo,
  art,
}: {
  grader: string;
  grade?: string;
  game?: string;
  size?: "sm" | "md" | "lg";
  holo?: boolean;
  /** Slug under `public/cards/`, from `scripts/fetch-card-art.mjs`. */
  art?: string;
}) {
  const raw = grader === "Raw" || !grade || grade === "—";
  const shine = holo ?? (grade === "10" || grade === "9.5");

  return (
    <span
      className={`gm-slab gm-slab--${size} gm-slab--${gameKey(game)}${raw ? " gm-slab--raw" : ""}${
        art ? " gm-slab--art" : ""
      }`}
      aria-hidden="true"
    >
      {raw ? (
        <span className="gm-slab-raw-tag">RAW</span>
      ) : (
        <span className="gm-slab-label">
          <b>{grader}</b>
          <i>{grade}</i>
        </span>
      )}
      <span className="gm-slab-window">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {art ? <img className="gm-slab-art" src={`/cards/${art}.png`} alt="" loading="lazy" /> : null}
        {shine ? <span className="gm-slab-holo" /> : null}
      </span>
    </span>
  );
}

/** Which game a card belongs to, at a glance. */
export function GameChip({ game }: { game: string }) {
  return <span className={`gm-game gm-game--${gameKey(game)}`}>{game}</span>;
}

/**
 * A card-first tile for the gallery view. `media` is the slab, everything
 * else is the listing around it.
 */
export function CardTile({
  slab,
  title,
  sub,
  price,
  topLeft,
  topRight,
  meta,
  footer,
}: {
  slab: ReactNode;
  title: string;
  sub: string;
  price?: string;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article className="gm-ctile">
      <div className="gm-ctile-media">
        {topLeft ? <span className="gm-ctile-tag">{topLeft}</span> : null}
        {topRight ? <span className="gm-ctile-tag gm-ctile-tag--right">{topRight}</span> : null}
        {slab}
      </div>
      <div className="gm-ctile-body">
        <div className="gm-ctile-title" title={title}>
          {title}
        </div>
        <div className="gm-ctile-sub" title={sub}>
          {sub}
        </div>
        {price ? <div className="gm-ctile-price">{price}</div> : null}
        {meta ? (
          <div className="gm-row" style={{ gap: 6 }}>
            {meta}
          </div>
        ) : null}
      </div>
      {footer ? <footer className="gm-ctile-foot">{footer}</footer> : null}
    </article>
  );
}

/** Table or gallery. Two icons, no labels — it is obvious from the shapes. */
export function ViewToggle({
  value,
  onChange,
}: {
  value: "table" | "gallery";
  onChange: (v: "table" | "gallery") => void;
}) {
  return (
    <div className="gm-viewtoggle" role="group" aria-label="View">
      <button
        type="button"
        className={value === "table" ? "is-active" : ""}
        onClick={() => onChange("table")}
        aria-label="Table view"
        aria-pressed={value === "table"}
        title="Table view"
      >
        <IconRows />
      </button>
      <button
        type="button"
        className={value === "gallery" ? "is-active" : ""}
        onClick={() => onChange("gallery")}
        aria-label="Gallery view"
        aria-pressed={value === "gallery"}
        title="Gallery view"
      >
        <IconGrid />
      </button>
    </div>
  );
}

/**
 * The drifting card silhouettes behind the console. Positions are fixed
 * rather than random so the layer is identical on server and client — a
 * random one would hydrate mismatched.
 */
const DRIFT = [
  { top: "6%", left: "12%", w: 132, h: 184, rot: "-14deg", dur: "19s", delay: "0s" },
  { top: "58%", left: "4%", w: 96, h: 134, rot: "9deg", dur: "24s", delay: "-6s" },
  { top: "14%", left: "68%", w: 168, h: 234, rot: "11deg", dur: "27s", delay: "-3s" },
  { top: "70%", left: "78%", w: 120, h: 168, rot: "-7deg", dur: "22s", delay: "-11s" },
  { top: "38%", left: "44%", w: 88, h: 122, rot: "17deg", dur: "30s", delay: "-8s" },
  { top: "84%", left: "36%", w: 104, h: 146, rot: "-5deg", dur: "25s", delay: "-15s" },
];

export function DriftLayer() {
  return (
    <div className="gm-drift" aria-hidden="true">
      {DRIFT.map((d, i) => (
        <span
          key={i}
          style={
            {
              top: d.top,
              left: d.left,
              width: d.w,
              height: d.h,
              "--rot": d.rot,
              animationDuration: d.dur,
              animationDelay: d.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ==========================================================================
   Tabs / segmented filter
   ========================================================================== */

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string; count?: number }[];
}) {
  return (
    <div className="gm-tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`gm-tab${value === o.key ? " is-active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          <span className="gm-tab-t">{o.label}</span>
          {typeof o.count === "number" ? <span className="gm-tab-n">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ==========================================================================
   Toggle
   ========================================================================== */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="gm-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="gm-toggle-track" />
      {label ? <span className="gm-sm">{label}</span> : null}
    </label>
  );
}

export function SettingRow({
  title,
  hint,
  control,
}: {
  title: string;
  hint?: string;
  control: ReactNode;
}) {
  return (
    <div className="gm-setrow">
      <div className="gm-setrow-main">
        <b>{title}</b>
        {hint ? <span>{hint}</span> : null}
      </div>
      <div className="gm-setrow-ctl">{control}</div>
    </div>
  );
}

/* ==========================================================================
   Meter
   ========================================================================== */

export function Meter({
  value,
  tone = "navy",
  large,
}: {
  value: number;
  tone?: "navy" | "gold" | "ok" | "warn" | "bad";
  large?: boolean;
}) {
  const cls = tone === "navy" ? "" : ` gm-meter--${tone}`;
  return (
    <div className={`gm-meter${cls}${large ? " gm-meter--lg" : ""}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ==========================================================================
   Note / callout
   ========================================================================== */

export function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "bad" | "gold";
  children: ReactNode;
}) {
  const cls = tone === "info" ? "" : ` gm-note--${tone}`;
  const Icon = tone === "info" ? IconInfo : tone === "gold" ? IconCheckCircle : IconAlert;
  return (
    <div className={`gm-note${cls}`}>
      <Icon />
      <div>{children}</div>
    </div>
  );
}

/* ==========================================================================
   Empty state
   ========================================================================== */

export function Empty({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
}) {
  return (
    <div className="gm-empty">
      <span className="gm-empty-ico">{icon}</span>
      <b>{title}</b>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

/* ==========================================================================
   Drawer — the detail surface behind every row
   ========================================================================== */

export function Drawer({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* Opening a second record while the drawer is already open reuses the same
     scroll container, so without this it would keep the previous position. */
  useEffect(() => {
    if (open) body.current?.scrollTo({ top: 0 });
  }, [open, title]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="gm-scrim" onClick={onClose} />
      <aside
        className="gm-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Details"}
      >
        <header className="gm-drawer-head">
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <h3>{title}</h3>
            {sub ? <p>{sub}</p> : null}
          </div>
          <button
            type="button"
            className="gm-btn gm-btn--ghost gm-btn--icon gm-btn--sm"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX />
          </button>
        </header>
        <div className="gm-drawer-body" ref={body}>
          {children}
        </div>
        {footer ? <footer className="gm-drawer-foot">{footer}</footer> : null}
      </aside>
    </OverlayPortal>
  );
}

/* ==========================================================================
   Modal — for a decision that needs a reason typed before it commits
   ========================================================================== */

export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="gm-scrim" onClick={onClose} />
      <div className="gm-modal" role="dialog" aria-modal="true">
        <header className="gm-drawer-head">
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <h3>{title}</h3>
            {sub ? <p>{sub}</p> : null}
          </div>
          <button
            type="button"
            className="gm-btn gm-btn--ghost gm-btn--icon gm-btn--sm"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX />
          </button>
        </header>
        <div className="gm-drawer-body">{children}</div>
        {footer ? <footer className="gm-drawer-foot">{footer}</footer> : null}
      </div>
    </OverlayPortal>
  );
}

/* ==========================================================================
   Definition list
   ========================================================================== */

export function DL({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="gm-dl">
      {rows.map((r, i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>{r[0]}</dt>
          <dd>{r[1]}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ==========================================================================
   Charts — small, dependency-free SVG
   ========================================================================== */

/** A dual-series area + line chart. Series A fills, series B rides on top. */
export function AreaChart({
  data,
  height = 190,
}: {
  data: { label: string; gmv: number; verified: number }[];
  height?: number;
}) {
  const w = 640;
  const h = height;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 24;
  const maxA = Math.max(...data.map((d) => d.gmv)) * 1.12;
  const maxB = Math.max(...data.map((d) => d.verified)) * 1.35;
  const step = (w - padL - padR) / Math.max(1, data.length - 1);
  const x = (i: number) => padL + i * step;
  const yA = (v: number) => padT + (1 - v / maxA) * (h - padT - padB);
  const yB = (v: number) => padT + (1 - v / maxB) * (h - padT - padB);

  const lineA = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${yA(d.gmv)}`).join(" ");
  const areaA = `${lineA} L${x(data.length - 1)},${h - padB} L${padL},${h - padB} Z`;
  const lineB = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${yB(d.verified)}`).join(" ");

  return (
    <div>
      <svg className="gm-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="GMV and verifications over twelve weeks" style={{ height }}>
        <defs>
          <linearGradient id="gmArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="gmStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--gold-300)" />
            <stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padL}
            x2={w - padR}
            y1={padT + t * (h - padT - padB)}
            y2={padT + t * (h - padT - padB)}
            stroke="var(--line)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={areaA} fill="url(#gmArea)" />
        <path d={lineA} fill="none" stroke="url(#gmStroke)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={lineB} fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

        {data.map((d, i) => (
          <circle key={d.label} cx={x(i)} cy={yA(d.gmv)} r="2.6" fill="var(--gold)" />
        ))}

        {data.map((d, i) =>
          i % 2 === 0 ? (
            <text key={`t${d.label}`} x={x(i)} y={h - 6} fontSize="11" fill="var(--ink-4)" textAnchor="middle">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
      <div className="gm-chart-legend">
        <span className="gm-legend-key">
          <i
            className="gm-legend-swatch"
            style={{ background: "linear-gradient(135deg,var(--gold-300),var(--gold))" }}
          />
          GMV ($k)
        </span>
        <span className="gm-legend-key">
          <i className="gm-legend-swatch" style={{ background: "var(--ink-3)" }} />
          Verifications cleared
        </span>
      </div>
    </div>
  );
}

/** Horizontal bars — good for a ranked list where the labels matter. */
export function BarList({
  rows,
  format = (n) => String(n),
  tone = "navy",
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  tone?: "navy" | "gold";
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="gm-bars">
      {rows.map((r) => (
        <div key={r.label} className="gm-bar-row">
          <span title={r.label}>{r.label}</span>
          <Meter value={(r.value / max) * 100} tone={tone} />
          <b>{r.hint ?? format(r.value)}</b>
        </div>
      ))}
    </div>
  );
}

/** A donut built from stroke-dasharray. No library, no layout thrash. */
export function Donut({
  slices,
  centerValue,
  centerLabel,
}: {
  slices: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="gm-donut-wrap">
      <div className="gm-donut">
        <svg viewBox="0 0 156 156" width="156" height="156" role="img" aria-label={centerLabel}>
          <circle cx="78" cy="78" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="19" />
          {slices.map((s) => {
            const len = (s.value / total) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={s.label}
                cx="78"
                cy="78"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="19"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform="rotate(-90 78 78)"
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="gm-donut-center">
          <b>{centerValue}</b>
          <span>{centerLabel}</span>
        </div>
      </div>
      <div className="gm-donut-keys">
        {slices.map((s) => (
          <div key={s.label} className="gm-donut-key">
            <i className="gm-legend-swatch" style={{ background: s.color }} />
            <span className="gm-muted">{s.label}</span>
            <b>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Twelve columns, the tallest one gold. Used for period comparisons. */
export function ColumnChart({
  data,
  height = 170,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height, padding: "4px 0" }}>
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const top = pct > 92;
        return (
          <div
            key={d.label}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}
            title={`${d.label}: ${d.value}`}
          >
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: `${pct}%`,
                  minHeight: 4,
                  borderRadius: "6px 6px 3px 3px",
                  background: top
                    ? "linear-gradient(180deg,var(--gold-300),var(--gold))"
                    : "var(--grad-navy)",
                  boxShadow: top ? "var(--sh-gold)" : "var(--sh-navy)",
                }}
              />
            </div>
            <span style={{ fontSize: 10.5, color: "var(--ink-4)", whiteSpace: "nowrap" }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Status badge helpers — one place that decides what colour a state is
   ========================================================================== */

export function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    awaiting: { tone: "warn", label: "Awaiting review" },
    "in-review": { tone: "info", label: "In review" },
    "info-requested": { tone: "gold", label: "Info requested" },
    verified: { tone: "ok", label: "Verified" },
    rejected: { tone: "bad", label: "Rejected" },
  };
  const m = map[status] ?? { tone: "idle" as BadgeTone, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function ListingBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    queued: { tone: "info", label: "Queued" },
    live: { tone: "ok", label: "Live" },
    sold: { tone: "navy", label: "Sold" },
    paused: { tone: "warn", label: "Paused" },
    withdrawn: { tone: "bad", label: "Withdrawn" },
  };
  const m = map[status] ?? { tone: "idle" as BadgeTone, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function MemberBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    active: { tone: "ok", label: "Active" },
    restricted: { tone: "warn", label: "Restricted" },
    revoked: { tone: "bad", label: "Revoked" },
    pending: { tone: "info", label: "Pending" },
  };
  const m = map[status] ?? { tone: "idle" as BadgeTone, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function ConflictBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    open: { tone: "info", label: "Open" },
    "awaiting-evidence": { tone: "warn", label: "Awaiting evidence" },
    escalated: { tone: "bad", label: "Escalated" },
    resolved: { tone: "ok", label: "Resolved" },
  };
  const m = map[status] ?? { tone: "idle" as BadgeTone, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function TicketBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    new: { tone: "bad", label: "New" },
    open: { tone: "info", label: "Open" },
    waiting: { tone: "warn", label: "Waiting" },
    resolved: { tone: "ok", label: "Resolved" },
  };
  const m = map[status] ?? { tone: "idle" as BadgeTone, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, BadgeTone> = {
    urgent: "bad",
    high: "warn",
    normal: "info",
    low: "idle",
  };
  return (
    <Badge tone={map[priority] ?? "idle"}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

export function ConfidenceBadge({ level, sample }: { level: string; sample: number }) {
  const map: Record<string, BadgeTone> = { high: "ok", medium: "warn", low: "bad" };
  return (
    <Badge tone={map[level] ?? "idle"}>
      {level} · n={sample}
    </Badge>
  );
}

/* ==========================================================================
   Composed pieces from the reference layouts
   ========================================================================== */

/**
 * A figure that goes somewhere. The dashboard rail is built from these
 * instead of KPI tiles: a number with no destination is a poster, and four
 * of them in a row is the most generic thing an admin panel can do.
 */
export function LinkStat({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link href={href} className="gm-linkstat">
      <span className="gm-linkstat-main">
        <span className="gm-linkstat-label">{label}</span>
        <span className="gm-linkstat-value">{value}</span>
      </span>
      <span className="gm-linkstat-go">
        <IconArrowRight />
      </span>
    </Link>
  );
}

/** The rounded filter row: an outlined icon, a label, and a count. */
export function PillTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string; count?: number; icon?: ReactNode }[];
}) {
  return (
    <div className="gm-pillrow" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`gm-pill${value === o.key ? " is-active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.icon ? <span className="gm-pill-ico">{o.icon}</span> : null}
          <span>{o.label}</span>
          {typeof o.count === "number" ? <span className="gm-pill-n">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** A small labelled fact. Two or four of these sit inside a case card. */
export function MetaBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="gm-metabox">
      <div className="gm-metabox-label">
        {icon}
        {label}
      </div>
      <div className="gm-metabox-value" title={value}>
        {value}
      </div>
    </div>
  );
}

/** Severity as an outlined pill — "High 8/10", the way the reference reads. */
export function Severity({ level, score }: { level: "high" | "med" | "low"; score: number }) {
  const word = level === "high" ? "High" : level === "med" ? "Medium" : "Low";
  return (
    <span className={`gm-sev gm-sev--${level}`}>
      <IconFlag />
      {word} {score}/10
    </span>
  );
}

export function SectionHead({
  title,
  count,
  right,
}: {
  title: string;
  count?: number;
  right?: ReactNode;
}) {
  return (
    <div className="gm-sectionhead">
      <h3>{title}</h3>
      {typeof count === "number" ? <span className="gm-sectionhead-n">{count}</span> : null}
      {right ? <span className="gm-spacer">{right}</span> : null}
    </div>
  );
}

export function BlockHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="gm-blockhead">
      <h3>{title}</h3>
      {sub ? <p>{sub}</p> : null}
      {right ? <span className="gm-spacer">{right}</span> : null}
    </div>
  );
}

/** A rating chip that colours by value rather than always reading green. */
export function Rating({ value }: { value: number }) {
  if (!value) return <span className="gm-scope">No score yet</span>;
  const tone = value >= 4.7 ? "" : value >= 4 ? " gm-rating--mid" : " gm-rating--low";
  return (
    <span className={`gm-rating${tone}`}>
      <IconStar />
      {value.toFixed(1)}
    </span>
  );
}

/** A confirmation that something was resolved, mirroring the reference. */
export function Toast({
  title,
  body,
  onDone,
}: {
  title: string;
  body: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <OverlayPortal>
      <div className="gm-toast" role="status">
        <span className="gm-toast-ico">
          <IconCheck />
        </span>
        <span>
          <b>{title}</b>
          <span>{body}</span>
        </span>
      </div>
    </OverlayPortal>
  );
}
