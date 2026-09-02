"use client";

/**
 * The pieces every admin page is built from. Presentation only — no page here
 * knows where its data came from, which is what keeps the swap from sample
 * data to a real endpoint a one-line change in the page above it.
 */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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
  IconChevronDown,
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
        <span className="gm-slab-raw-tag">Raw</span>
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
   Select — the console's own dropdown
   ========================================================================== */

export type SelectOption = { value: string; label: string };

/** Narrowest a dropdown list may be, however small its trigger. */
const MIN_W = 176;

/** Accepts `["A","B"]`, `[{value,label}]`, or a `<option>`-ish mix of both. */
function normalise(options: (string | SelectOption)[]): SelectOption[] {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

/**
 * A dropdown that belongs to this design system.
 *
 * A native `<select>` cannot be styled past its closed state: the open list is
 * drawn by the operating system, so it arrives with square corners, the system
 * blue highlight and no idea the console has a dark theme. Every other surface
 * here is a rounded card on a themed token, and the one place the OS took over
 * was the thing you look at most while filtering.
 *
 * So the trigger is a button and the list is ours — same radius, same border,
 * same shadow as the account menu, and it follows the theme. It keeps what the
 * native control was good at: type-to-open, arrow keys to move, Enter to pick,
 * Escape to leave it alone, and a label association through `id`.
 *
 * The list renders into the overlay host with fixed coordinates rather than
 * inside the field, so a card with `overflow: hidden`, a table wrapper that
 * scrolls, or a drawer cannot clip it.
 */
export function Select({
  value,
  onChange,
  options,
  id,
  ariaLabel,
  width,
  placeholder = "Select…",
  variant = "field",
  className = "",
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  options: (string | SelectOption)[];
  id?: string;
  ariaLabel?: string;
  width?: number | string;
  placeholder?: string;
  /** `field` is the bordered control; `bare` is the filter-bar row, which
      draws its own frame around a group of them. */
  variant?: "field" | "bare";
  className?: string;
  style?: React.CSSProperties;
}) {
  const opts = normalise(options);
  const btn = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(
    null
  );

  const index = opts.findIndex((o) => o.value === value);
  const [active, setActive] = useState(index < 0 ? 0 : index);
  const current = index < 0 ? null : opts[index];

  const place = useCallback(() => {
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    /* enough room below for the list, or does it have to open upward? */
    const wanted = Math.min(opts.length * 36 + 12, 300);
    const up = r.bottom + wanted + 12 > window.innerHeight && r.top > wanted + 12;
    /* the list is at least MIN_W wide even when its trigger is narrower, so
       align it to the trigger but pull it back inside the viewport */
    const width = Math.max(r.width, MIN_W);
    setBox({
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 10)),
      top: up ? r.top - 6 : r.bottom + 6,
      width,
      up,
    });
  }, [opts.length]);

  useEffect(() => {
    if (!open) return;
    place();

    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    }
    /* reposition rather than follow: a list pinned to a stale rect after the
       page scrolls is worse than one that closes */
    function onScroll() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) setActive(index < 0 ? 0 : index);
  }, [open, index]);

  function pick(i: number) {
    const o = opts[i];
    if (!o) return;
    onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(opts.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(opts.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key.length === 1) {
      /* type-ahead, the one native behaviour worth keeping by hand */
      const c = e.key.toLowerCase();
      const from = opts.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(c));
      const hit = from >= 0 ? from : opts.findIndex((o) => o.label.toLowerCase().startsWith(c));
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <>
      <button
        type="button"
        id={id}
        ref={btn}
        className={`gm-sel gm-sel--${variant}${open ? " is-open" : ""} ${className}`.trim()}
        style={{ width, ...style }}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="gm-sel-value">{current ? current.label : placeholder}</span>
        <IconChevronDown className="gm-sel-caret" />
      </button>

      {open && box ? (
        <OverlayPortal>
          <div
            ref={list}
            className="gm-menu gm-sel-menu"
            role="listbox"
            aria-activedescendant={`${id ?? "gm-sel"}-o${active}`}
            style={{
              position: "fixed",
              left: box.left,
              top: box.up ? undefined : box.top,
              bottom: box.up ? window.innerHeight - box.top : undefined,
              minWidth: box.width,
            }}
          >
            {opts.map((o, i) => (
              <button
                key={o.value}
                type="button"
                id={`${id ?? "gm-sel"}-o${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`gm-menu-item gm-sel-opt${i === active ? " is-active" : ""}${
                  o.value === value ? " is-picked" : ""
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
              >
                <span>{o.label}</span>
                {o.value === value ? <IconCheck /> : null}
              </button>
            ))}
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}

/**
 * A labelled cell in the filter bar. The label sits on the bar's top edge
 * rather than above the value inside it — same information, one line of
 * height instead of two.
 */
export function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="gm-filterfield">
      <label className="gm-filterfield-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ==========================================================================
   Charts — small, dependency-free SVG
   ========================================================================== */

/**
 * The element's rendered width, in real pixels.
 *
 * Charts used to draw into a fixed viewBox stretched with
 * `preserveAspectRatio="none"`, which scaled the horizontal axis and left
 * every dot an ellipse and every stroke a different weight at each end.
 * Measuring instead means one SVG user unit is one CSS pixel, so circles are
 * round and a 2px line is 2px wide wherever it sits.
 *
 * Returns 0 until the first client measurement — the server cannot know the
 * width, so both renders agree on "not yet" rather than on a guess.
 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.round(el.getBoundingClientRect().width));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, w] as const;
}

/**
 * A monotone cubic through the points — the curve every dashboard chart in
 * the references uses. Straight segments between points read as jagged at
 * this size; a plain cardinal spline smooths them but overshoots, drawing
 * peaks and troughs the data never had. Monotone does neither.
 */
function smoothPath(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n === 0) return "";
  if (n < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    slope[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1);
  }

  /* tangent at each point: zero at a turn, a weighted harmonic mean elsewhere */
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  m[n - 1] = slope[n - 2];

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + m[i] * h} ${pts[i + 1].x - h},${
      pts[i + 1].y - m[i + 1] * h
    } ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/**
 * Two decimal places, for anything that reaches an SVG attribute.
 *
 * `Math.cos` is allowed to differ in its last bit between implementations, and
 * Node and the browser exercise that licence: the server wrote a label at
 * x="25.386362924470575" and the client re-rendered it at 25.386362924470568,
 * which React reports as a hydration mismatch. Two decimals is well past
 * sub-pixel and identical on both sides.
 */
const px = (n: number) => Math.round(n * 100) / 100;

/**
 * The top of the scale, chosen so that its quarters are round numbers.
 *
 * Rounding the maximum alone is not enough: 127 rounds to a tidy 150, and then
 * the gridlines underneath read 112.5, 75 and 37.5. Rounding the *step* and
 * multiplying back up gives 160, and with it 120 / 80 / 40 / 0.
 */
const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceMax(v: number) {
  if (v <= 0) return 1;
  const rough = v / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = NICE.find((c) => rough / mag <= c + 1e-9) ?? 10;
  return step * mag * 4;
}

/**
 * A dual-series area + line chart: GMV fills, the second series rides on top
 * as a line. Hovering anywhere over the plot moves the readout to the nearest
 * period; with no pointer on it the readout parks on the tallest one, so the
 * chart says something at rest rather than waiting to be poked.
 */
export function AreaChart({
  data,
  height = 190,
  formatA = (n: number) => `$${n}k`,
  formatB = (n: number) => String(n),
  labelA = "GMV ($k)",
  labelB = "Verifications cleared",
}: {
  data: { label: string; gmv: number; verified: number }[];
  height?: number;
  formatA?: (n: number) => string;
  formatB?: (n: number) => string;
  labelA?: string;
  labelB?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  /* No left axis, and no gridlines to imply one. The two series are in
     different units — dollars and a count — so a single scale down the side
     would invite the reading that one bar is larger than the other when they
     measure different things. The pill and the legend carry both figures for
     whichever week is under the pointer, which is the honest version. */
  const padL = 16;
  const padR = 16;
  const padT = 30;
  const padB = 26;
  const h = height;

  const peak = data.reduce((best, d, i) => (d.gmv > data[best].gmv ? i : best), 0);
  const active = hover ?? peak;

  const maxA = niceMax(Math.max(...data.map((d) => d.gmv)));
  const maxB = niceMax(Math.max(...data.map((d) => d.verified)));
  const plotW = Math.max(0, w - padL - padR);
  const plotH = h - padT - padB;
  const step = plotW / Math.max(1, data.length - 1);

  const x = (i: number) => padL + i * step;
  const yA = (v: number) => padT + (1 - v / maxA) * plotH;
  /* The second series has its own scale, and left at full height it traced
     almost exactly the same path as the first. Giving it the lower two-thirds
     of the plot keeps its shape readable and stops the two from tangling; the
     axis down the left belongs to the headline series, which is what the
     gridline labels say. */
  const bandTop = plotH * 0.32;
  const yB = (v: number) => padT + bandTop + (1 - v / maxB) * (plotH - bandTop);

  const lineA = smoothPath(data.map((d, i) => ({ x: x(i), y: yA(d.gmv) })));
  const lineB = smoothPath(data.map((d, i) => ({ x: x(i), y: yB(d.verified) })));
  const areaB = w ? `${lineB} L${x(data.length - 1)},${padT + plotH} L${padL},${padT + plotH} Z` : "";

  /* every other tick once the labels would start touching */
  const labelEvery = step < 44 ? 2 : 1;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - box.left - padL) / (step || 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  }

  const tipText = `${data[active].label} · ${formatA(data[active].gmv)}`;
  const tipW = Math.max(76, tipText.length * 6.6 + 22);
  const tipX = Math.min(Math.max(x(active) - tipW / 2, 0), Math.max(0, w - tipW));

  return (
    <div ref={ref}>
      {w > 0 ? (
        <svg
          className="gm-chart"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`${labelA} and ${labelB} over ${data.length} periods`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="gmArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--navy-500)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--navy-500)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* dashed gridlines, with the scale written down the left edge */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const gy = padT + t * plotH;
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={w - padR}
                  y1={gy}
                  y2={gy}
                  stroke="var(--line)"
                  strokeWidth="1"
                  strokeDasharray="4 5"
                />
                <text x={padL - 10} y={gy + 3.5} fontSize="10.5" fill="var(--ink-4)" textAnchor="end">
                  {formatA(Math.round(maxA * (1 - t)))}
                </text>
              </g>
            );
          })}

          {/* the supporting series is a soft band, so the headline line reads
              cleanly over it instead of tangling with a second line */}
          <path d={areaB} fill="url(#gmArea)" />
          <path
            d={lineB}
            fill="none"
            stroke="var(--navy-500)"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path d={lineA} fill="none" stroke="var(--gold)" strokeWidth="2.6" strokeLinecap="round" />

          {/* the readout: a rule down to the axis, a ringed dot, and a pill */}
          <line
            x1={x(active)}
            x2={x(active)}
            y1={padT - 5}
            y2={padT + plotH}
            stroke="var(--line-2)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <circle cx={x(active)} cy={yB(data[active].verified)} r="3.2" fill="var(--navy-500)" />
          <circle
            cx={x(active)}
            cy={yA(data[active].gmv)}
            r="5.5"
            fill="var(--surface)"
            stroke="var(--gold)"
            strokeWidth="2.6"
          />

          <g>
            <rect x={tipX} y={3} width={tipW} height={21} rx="10.5" fill="var(--navy)" opacity="0.95" />
            <text
              x={tipX + tipW / 2}
              y={17.5}
              fontSize="11.5"
              fontWeight="600"
              fill="#f4f6f8"
              textAnchor="middle"
            >
              {tipText}
            </text>
          </g>

          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text
                key={`t${d.label}`}
                x={x(i)}
                y={h - 7}
                fontSize="10.8"
                fill={i === active ? "var(--ink-2)" : "var(--ink-4)"}
                fontWeight={i === active ? 650 : 400}
                textAnchor="middle"
              >
                {d.label}
              </text>
            ) : null
          )}
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      <div className="gm-chart-legend">
        <span className="gm-legend-key">
          <i className="gm-legend-swatch" style={{ background: "var(--gold)" }} />
          {labelA}
          <b className="gm-legend-val">{formatA(data[active].gmv)}</b>
        </span>
        <span className="gm-legend-key">
          <i className="gm-legend-swatch" style={{ background: "var(--navy-500)" }} />
          {labelB}
          <b className="gm-legend-val">{formatB(data[active].verified)}</b>
        </span>
      </div>
    </div>
  );
}

/**
 * Paired columns: two thin rounded bars per period, one for each series.
 *
 * The dashboard and the reports page were both drawing the same smoothed area,
 * which made two different questions look like one answer. A line says "this
 * is continuous, read the slope"; twelve discrete weeks are not continuous, and
 * the thing worth reading is where each week landed and how the two series
 * compare inside it. Side-by-side bars answer both at a glance, and neither
 * series has to sit behind the other.
 *
 * The two have different units, so each is scaled to its own maximum and the
 * legend carries the figures for whichever week is under the pointer.
 */
export function VolumeChart({
  data,
  height = 190,
  formatA = (n: number) => `$${n}k`,
  formatB = (n: number) => String(n),
  labelA = "GMV ($k)",
  labelB = "Verifications cleared",
}: {
  data: { label: string; gmv: number; verified: number }[];
  height?: number;
  formatA?: (n: number) => string;
  formatB?: (n: number) => string;
  labelA?: string;
  labelB?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  /* No left axis, and no gridlines to imply one. The two series are in
     different units — dollars and a count — so a single scale down the side
     would invite the reading that one bar is larger than the other when they
     measure different things. The pill and the legend carry both figures for
     whichever week is under the pointer, which is the honest version. */
  const padL = 16;
  const padR = 16;
  const padT = 30;
  const padB = 26;
  const h = height;

  const peak = data.reduce((best, d, i) => (d.gmv > data[best].gmv ? i : best), 0);
  const active = hover ?? peak;

  const maxA = niceMax(Math.max(...data.map((d) => d.gmv)));
  const maxB = niceMax(Math.max(...data.map((d) => d.verified)));
  const plotW = Math.max(0, w - padL - padR);
  const plotH = h - padT - padB;
  const base = padT + plotH;

  const slot = plotW / Math.max(1, data.length);
  const mid = (i: number) => padL + slot * (i + 0.5);
  /* Thin bars with a hairline between them: the pair has to read as one
     reading of one week, not as two neighbouring weeks. */
  const barW = Math.max(4, Math.min(11, slot * 0.22));
  const pairGap = Math.max(2.5, barW * 0.45);

  const labelEvery = slot < 44 ? 2 : 1;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left - padL) / (slot || 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  }

  const tipText = `${data[active].label} · ${formatA(data[active].gmv)}`;
  const tipW = Math.max(76, tipText.length * 6.6 + 22);
  const tipX = px(Math.min(Math.max(mid(active) - tipW / 2, 0), Math.max(0, w - tipW)));

  /** One rounded column, capped top and bottom the way the reference draws it. */
  function bar(key: string, cx: number, value: number, max: number, fill: string, dim: boolean) {
    const bh = Math.max(barW, (value / max) * plotH);
    return (
      <rect
        key={key}
        x={px(cx - barW / 2)}
        y={px(base - bh)}
        width={px(barW)}
        height={px(bh)}
        rx={px(barW / 2)}
        fill={fill}
        opacity={dim ? 0.55 : 1}
        style={{ transition: "opacity 0.16s ease" }}
      />
    );
  }

  return (
    <div ref={ref}>
      {w > 0 ? (
        <svg
          className="gm-chart"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`${labelA} and ${labelB} over ${data.length} periods`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {data.map((d, i) => {
            const c = mid(i);
            const dim = hover !== null && i !== hover;
            return (
              <g key={d.label}>
                {bar(`a${d.label}`, c - (barW + pairGap) / 2, d.gmv, maxA, "var(--gold)", dim)}
                {bar(
                  `b${d.label}`,
                  c + (barW + pairGap) / 2,
                  d.verified,
                  maxB,
                  "var(--navy-500)",
                  dim
                )}
              </g>
            );
          })}

          <line x1={padL} x2={w - padR} y1={base} y2={base} stroke="var(--line-2)" strokeWidth="1" />

          <g>
            <rect x={tipX} y={3} width={tipW} height={21} rx="10.5" fill="var(--navy)" opacity="0.95" />
            <text
              x={px(tipX + tipW / 2)}
              y={17.5}
              fontSize="11.5"
              fontWeight="600"
              fill="#f4f6f8"
              textAnchor="middle"
            >
              {tipText}
            </text>
          </g>

          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text
                key={`t${d.label}`}
                x={px(mid(i))}
                y={h - 7}
                fontSize="10.8"
                fill={i === active ? "var(--ink-2)" : "var(--ink-4)"}
                fontWeight={i === active ? 650 : 400}
                textAnchor="middle"
              >
                {d.label}
              </text>
            ) : null
          )}
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      <div className="gm-chart-legend gm-chart-legend--dots">
        <span className="gm-legend-key">
          <i className="gm-legend-dot" style={{ background: "var(--gold)" }} />
          {labelA}
          <b className="gm-legend-val">{formatA(data[active].gmv)}</b>
        </span>
        <span className="gm-legend-key">
          <i className="gm-legend-dot" style={{ background: "var(--navy-500)" }} />
          {labelB}
          <b className="gm-legend-val">{formatB(data[active].verified)}</b>
        </span>
      </div>
    </div>
  );
}

/**
 * The automatic checks on a record — the ones that passed included.
 *
 * Showing only failures leaves a reviewer unable to tell a listing that
 * cleared every rule from one where the rules never ran; on a queue whose
 * whole promise is that a human looked, that difference is the point. A pass
 * states the rule, a failure states the finding, and each row says whether a
 * rule raised it or a moderator typed it.
 */
export function CheckList({
  checks,
}: {
  checks: {
    key: string;
    rule: string;
    passed: boolean;
    label: string;
    detail: string;
    tone: "bad" | "warn";
    automatic: boolean;
  }[];
}) {
  return (
    <ul className="gm-checks">
      {checks.map((c) => (
        <li
          key={c.key}
          className={`gm-check${c.passed ? " is-pass" : ` is-fail gm-check--${c.tone}`}`}
        >
          <span className="gm-check-ico">{c.passed ? <IconCheck /> : <IconAlert />}</span>
          <span className="gm-check-body">
            <b>{c.passed ? c.rule : c.label}</b>
            {c.passed ? null : <span>{c.detail}</span>}
          </span>
          <span className="gm-check-tag">{c.automatic ? "Rule" : "Moderator"}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One bar split by share.
 *
 * For the case where the parts add up to a whole that is itself the headline
 * — monthly revenue against the plans that make it — and a chart beside the
 * figure would only state the same composition a second time.
 */
export function StackBar({
  parts,
}: {
  parts: { label: string; value: number; color: string }[];
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div
      className="gm-stackbar"
      role="img"
      aria-label={parts
        .map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`)
        .join(", ")}
    >
      {parts.map((p) => (
        <i
          key={p.label}
          style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
          title={`${p.label} — ${Math.round((p.value / total) * 100)}%`}
        />
      ))}
    </div>
  );
}

/**
 * A funnel drawn as stages down the page, not as a taper across it.
 *
 * The drawn shape spends its width on the taper and leaves the two figures
 * that actually matter — how many reached this step, how many were lost
 * getting here — fighting for the middle of a wedge. Stacked rows give every
 * stage a full-width bar measured against the first, so the fall between any
 * two steps is a difference in length, and the count beside it says the same
 * thing in words for anyone who cannot use the length.
 */
export function Funnel({
  stages,
}: {
  stages: { key: string; label: string; value: number }[];
}) {
  const top = stages[0]?.value || 1;
  return (
    <ol className="gm-funnel">
      {stages.map((s, i) => {
        const prev = i === 0 ? null : stages[i - 1].value;
        const lost = prev === null ? 0 : prev - s.value;
        return (
          <li key={s.key} className="gm-funnel-step">
            <div className="gm-funnel-head">
              <span className="gm-funnel-label">{s.label}</span>
              <b className="gm-funnel-value">{s.value.toLocaleString("en-US")}</b>
            </div>
            <div className="gm-funnel-track">
              <i style={{ width: `${(s.value / top) * 100}%` }} />
            </div>
            <div className="gm-funnel-foot">
              {prev === null ? (
                <span>Everything below is measured against this</span>
              ) : (
                <>
                  <span>{Math.round((s.value / prev) * 100)}% of the step above</span>
                  {lost > 0 ? (
                    <span className="gm-funnel-lost">
                      {lost.toLocaleString("en-US")} lost here
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal bars — good for a ranked list where the labels matter. */
export function BarList({
  rows,
  format = (n) => String(n),
  tone = "navy",
  fill,
}: {
  rows: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  tone?: "navy" | "gold";
  /** Spread the rows over the full height of the panel. */
  fill?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={`gm-bars${fill ? " gm-bars--fill" : ""}`}>
      {rows.map((r) => (
        <div key={r.label} className="gm-bar-row">
          <span title={r.label}>{r.label}</span>
          <b>{r.hint ?? format(r.value)}</b>
          <Meter value={(r.value / max) * 100} tone={tone} />
        </div>
      ))}
    </div>
  );
}

/**
 * Concentric rings, one per slice — the shape the reference dashboards use.
 *
 * A single stacked ring hides its own composition: every slice shares one
 * circumference, so a 3% slice is a smudge you cannot read and the eye has to
 * walk the circle to compare two of them. Giving each slice its own ring puts
 * them all on the same start line at twelve o'clock, so their lengths compare
 * directly, and leaves room for the share to be written on the arc.
 *
 * The middle is a soft disc rather than a number: the headline figure belongs
 * in the card's subtitle, where it does not have to fit inside 60 pixels.
 */
export function RingChart({
  rings,
  size = 172,
  thickness = 10,
  gap = 6,
  unit = "",
}: {
  rings: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  gap?: number;
  /** Written after each value in the legend, e.g. "cards". */
  unit?: string;
}) {
  const total = rings.reduce((s, r) => s + r.value, 0) || 1;
  const c = size / 2;

  /* Largest share on the outside. Left in source order the biggest arc could
     land on the innermost, shortest ring, and the chart read as noise; sorted,
     the arcs step down together and the shape itself carries the ranking. */
  const ordered = [...rings].sort((a, b) => b.value - a.value);

  /* A band inside the edge is left clear for the share labels, which all sit
     on one circle outside the outermost ring — placing each label beside its
     own arc dropped the inner ones straight on top of the rings above them. */
  const labelBand = 15;
  const outer = c - thickness / 2 - labelBand;

  /* Rings tighten as they multiply rather than eating the middle: the disc
     never shrinks below a share of the whole, however many series arrive. */
  const minDisc = size * 0.11;
  const span = Math.max(0, outer - thickness / 2 - minDisc);
  const pitch = ordered.length > 1 ? Math.min(thickness + gap, span / (ordered.length - 1)) : 0;
  const discR = Math.max(minDisc, outer - (ordered.length - 1) * pitch - thickness / 2 - gap * 0.6);

  return (
    <div className="gm-rings">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="gm-rings-svg"
        role="img"
        aria-label={ordered
          .map((r) => `${r.label}: ${Math.round((r.value / total) * 100)}%`)
          .join(", ")}
      >
        <circle cx={c} cy={c} r={px(discR)} fill="var(--surface-2)" />

        {ordered.map((r, i) => {
          const radius = px(outer - i * pitch);
          const circ = px(2 * Math.PI * radius);
          const pct = r.value / total;
          const drawn = px(Math.max(thickness * 0.9, pct * circ));

          /* the label goes where the arc ends, but out on the label band */
          const angle = (-90 + pct * 360) * (Math.PI / 180);
          const lr = outer + thickness / 2 + 9;
          const cos = px(Math.cos(angle));
          const lx = px(c + cos * lr);
          const ly = px(c + px(Math.sin(angle)) * lr);
          const anchor = cos < -0.2 ? "end" : cos > 0.2 ? "start" : "middle";

          return (
            <g key={r.label}>
              <circle
                cx={c}
                cy={c}
                r={radius}
                fill="none"
                stroke="var(--surface-2)"
                strokeWidth={thickness}
              />
              <circle
                cx={c}
                cy={c}
                r={radius}
                fill="none"
                stroke={r.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${drawn} ${px(circ - drawn)}`}
                transform={`rotate(-90 ${c} ${c})`}
              />
              {/* only shares with room for a label get one; the rest read off
                  the legend, which carries every figure anyway */}
              {pct >= 0.12 ? (
                <text
                  x={lx}
                  y={px(ly + 3.5)}
                  textAnchor={anchor}
                  fontSize="10.5"
                  fontWeight="700"
                  fill={r.color}
                >
                  {Math.round(pct * 100)}%
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="gm-rings-keys">
        {ordered.map((r) => (
          <div key={r.label} className="gm-rings-key">
            <i style={{ background: r.color }} />
            <div>
              <b>
                {r.value.toLocaleString("en-US")}
                {unit ? ` ${unit}` : ""}
              </b>
              <span>{r.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Columns with a dashed scale behind them. Takes either one value per label
 * or several, so the same component draws a plain weekly count and a
 * side-by-side comparison.
 */
export function ColumnChart({
  data,
  height = 170,
  series,
  color = "var(--grad-navy)",
  format = (n: number) => String(n),
}: {
  data: { label: string; value?: number; values?: number[] }[];
  height?: number;
  series?: { label: string; color: string }[];
  /** Used when there is one unnamed series and so nothing to put in a legend. */
  color?: string;
  format?: (n: number) => string;
}) {
  const keys = series ?? [{ label: "", color }];
  const rows = data.map((d) => (d.values ? d.values : [d.value ?? 0]));
  const max = niceMax(Math.max(...rows.flat(), 1));
  const plotH = height - 22;

  return (
    <div className="gm-cols">
      <div className="gm-cols-plot" style={{ height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span key={t} className="gm-cols-grid" style={{ top: t * plotH }}>
            <i>{format(Math.round(max * (1 - t)))}</i>
          </span>
        ))}

        {data.map((d, di) => (
          <div
            key={d.label}
            className="gm-col-group"
            title={`${d.label}: ${rows[di].map(format).join(" · ")}`}
          >
            <div className="gm-col-bars" style={{ height: plotH }}>
              {rows[di].map((v, si) => (
                <span
                  key={si}
                  className="gm-col"
                  style={{
                    height: `${Math.max(2, (v / max) * 100)}%`,
                    background: keys[si]?.color ?? color,
                  }}
                />
              ))}
            </div>
            <span className="gm-col-label">{d.label}</span>
          </div>
        ))}
      </div>

      {series ? (
        <div className="gm-chart-legend">
          {series.map((s) => (
            <span key={s.label} className="gm-legend-key">
              <i className="gm-legend-swatch" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A single arc, for "x% of the way there". Reads as one number, not a mix. */
export function Gauge({
  value,
  max = 100,
  label,
  caption,
  color = "var(--gold)",
  size = 150,
  thickness = 14,
}: {
  value: number;
  max?: number;
  label: string;
  caption?: string;
  color?: string;
  size?: number;
  thickness?: number;
}) {
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  const r = px((size - thickness) / 2 - 1);
  const c = px(2 * Math.PI * r);
  const drawn = px(pct * c);

  return (
    <div className="gm-gauge" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${Math.round(pct * 100)}%`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${drawn} ${px(c - drawn)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="gm-gauge-center">
        <b>{label}</b>
        {caption ? <span>{caption}</span> : null}
      </div>
    </div>
  );
}

/**
 * One series over time, with the axis and the hover readout the other charts
 * use. `fill` shades under the line for a report whose caption says "area".
 *
 * This is what the report catalogue drives: pick a report on the left and its
 * own numbers are what the big panel draws.
 */
export function TrendChart({
  labels,
  values,
  height = 216,
  fill,
  format = (n: number) => String(n),
  seriesLabel,
}: {
  labels: string[];
  values: number[];
  height?: number;
  fill?: boolean;
  format?: (n: number) => string;
  seriesLabel: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 46;
  const padR = 14;
  const padT = 30;
  const padB = 26;
  const h = height;

  const peak = values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
  const active = hover ?? peak;

  /* A series that never approaches zero — active members, say — reads as a
     flat line against a zero baseline, so the floor drops to just under the
     lowest reading instead. */
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const zeroed = lo <= hi * 0.35;
  const top = niceMax(hi);
  const floor = zeroed ? 0 : Math.max(0, lo - (hi - lo) * 0.4);

  const plotW = Math.max(0, w - padL - padR);
  const plotH = h - padT - padB;
  const step = plotW / Math.max(1, values.length - 1);

  const x = (i: number) => px(padL + i * step);
  const y = (v: number) => px(padT + (1 - (v - floor) / (top - floor || 1)) * plotH);

  const line = smoothPath(values.map((v, i) => ({ x: x(i), y: y(v) })));
  const area = w ? `${line} L${x(values.length - 1)},${px(padT + plotH)} L${padL},${px(padT + plotH)} Z` : "";

  const labelEvery = step < 44 ? 2 : 1;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - box.left - padL) / (step || 1));
    setHover(Math.min(values.length - 1, Math.max(0, i)));
  }

  const tipText = `${labels[active]} · ${format(values[active])}`;
  const tipW = Math.max(76, tipText.length * 6.6 + 22);
  const tipX = px(Math.min(Math.max(x(active) - tipW / 2, 0), Math.max(0, w - tipW)));

  return (
    <div ref={ref}>
      {w > 0 ? (
        <svg
          className="gm-chart"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`${seriesLabel} over ${values.length} periods`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="gmTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const gy = px(padT + t * plotH);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={w - padR}
                  y1={gy}
                  y2={gy}
                  stroke="var(--line)"
                  strokeWidth="1"
                  strokeDasharray="4 5"
                />
                <text x={padL - 10} y={gy + 3.5} fontSize="10.5" fill="var(--ink-4)" textAnchor="end">
                  {format(Math.round(floor + (top - floor) * (1 - t)))}
                </text>
              </g>
            );
          })}

          {fill ? <path d={area} fill="url(#gmTrend)" /> : null}
          <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2.6" strokeLinecap="round" />

          <line
            x1={x(active)}
            x2={x(active)}
            y1={padT - 5}
            y2={px(padT + plotH)}
            stroke="var(--line-2)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <circle
            cx={x(active)}
            cy={y(values[active])}
            r="5.5"
            fill="var(--surface)"
            stroke="var(--gold)"
            strokeWidth="2.6"
          />

          <g>
            <rect x={tipX} y={3} width={tipW} height={21} rx="10.5" fill="var(--navy)" opacity="0.95" />
            <text
              x={px(tipX + tipW / 2)}
              y={17.5}
              fontSize="11.5"
              fontWeight="600"
              fill="#f4f6f8"
              textAnchor="middle"
            >
              {tipText}
            </text>
          </g>

          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text
                key={l}
                x={x(i)}
                y={h - 7}
                fontSize="10.8"
                fill={i === active ? "var(--ink-2)" : "var(--ink-4)"}
                fontWeight={i === active ? 650 : 400}
                textAnchor="middle"
              >
                {l}
              </text>
            ) : null
          )}
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      <div className="gm-chart-legend gm-chart-legend--dots">
        <span className="gm-legend-key">
          <i className="gm-legend-dot" style={{ background: "var(--gold)" }} />
          {seriesLabel}
          <b className="gm-legend-val">{format(values[active])}</b>
        </span>
      </div>
    </div>
  );
}

/** A tiny inline line, for a trend beside a number rather than a chart of it. */
export function Spark({
  points,
  width = 108,
  height = 34,
  color = "var(--gold)",
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  /* Inset by the widest thing drawn — the end dot plus its own radius — so
     nothing lands on the edge of the box and bleeds out of the card. */
  const pad = 4;
  const step = (width - pad * 2) / Math.max(1, points.length - 1);
  const pts = points.map((v, i) => ({
    x: pad + i * step,
    y: pad + (1 - (v - min) / span) * (height - pad * 2),
  }));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="gm-spark"
      aria-hidden="true"
    >
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.6" fill={color} />
    </svg>
  );
}

/* ==========================================================================
   Status badge helpers — one place that decides what colour a state is
   ========================================================================== */

/**
 * One badge for a listing's whole life.
 *
 * There were two of these — a verification badge and a listing badge — which
 * is what a queue split across two pages produces: the same record wearing a
 * different label depending on which screen you happened to open it from.
 */
export function ListingBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    awaiting: { tone: "warn", label: "Awaiting review" },
    "in-review": { tone: "info", label: "In review" },
    "info-requested": { tone: "gold", label: "Info requested" },
    live: { tone: "ok", label: "Live" },
    sold: { tone: "navy", label: "Sold" },
    paused: { tone: "warn", label: "Paused" },
    withdrawn: { tone: "bad", label: "Withdrawn" },
    rejected: { tone: "bad", label: "Rejected" },
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
