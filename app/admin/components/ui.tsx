"use client";

/**
 * The pieces every admin page is built from. Presentation only — no page here
 * knows where its data came from, which is what keeps the swap from sample
 * data to a real endpoint a one-line change in the page above it.
 */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Renders overlays at the end of <body> instead of wherever the page happens
 * to mount them.
 *
 * `position: fixed` resolves against the nearest ancestor that establishes a
 * containing block, not always the viewport — and a transform, a filter, or a
 * `backdrop-filter` on any ancestor is enough to become one. `.gm-content`
 * animates `transform` with `animation-fill-mode: both`, so it stays a
 * containing block permanently even though the computed value ends at `none`.
 * A dialog mounted inside it therefore anchored to the scrolled <main>: open
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
/**
 * The console's UI scale, as a number.
 *
 * Large screens set `zoom` on the root so the whole console grows rather than
 * sitting at 14px in the middle of a 4K panel. `zoom` is the right tool for
 * that — it reflows, unlike `transform: scale` — but it splits the two
 * coordinate systems that JS positioning relies on:
 *
 *   - `getBoundingClientRect()` and `event.clientX` come back in VISUAL
 *     pixels, already multiplied by the zoom;
 *   - a `position: fixed` `left`/`top`, and anything measured against an SVG's
 *     own viewBox, are in LOCAL pixels, and get multiplied again when painted.
 *
 * So a rect fed straight back into a style is scaled twice, and a panel opens
 * a third of a screen away from the button it belongs to. Divide by this and
 * both sides are in local pixels again. It reads 1 when nothing is zoomed,
 * which is every screen under 1600px.
 */
export function uiScale(): number {
  if (typeof window === "undefined") return 1;
  const z = Number(getComputedStyle(document.documentElement).zoom);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/** A rect in local pixels, whatever the root zoom is. */
export function localRect(el: Element): DOMRect {
  const r = el.getBoundingClientRect();
  const k = uiScale();
  if (k === 1) return r;
  return new DOMRect(r.left / k, r.top / k, r.width / k, r.height / k);
}

/** The viewport in local pixels, to compare against a local rect. */
export function localViewport() {
  const k = uiScale();
  return { w: window.innerWidth / k, h: window.innerHeight / k };
}

export function OverlayPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById("gm-overlays"));
  }, []);

  if (!host) return <>{children}</>;
  return createPortal(children, host);
}

/**
 * Holds the page still while an overlay is open.
 *
 * Still reference-counted, though nothing stacks overlays any more — records
 * became routes precisely so that a Modal never opens on top of another one.
 * The count stays because it is what makes that guarantee cheap to keep: if a
 * second overlay ever does appear over a first, closing the inner one will not
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
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconCheck,
  IconCheckCircle,
  IconChevronDown,
  IconFilter,
  IconFlag,
  IconGrid,
  IconInfo,
  IconMore,
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
  back,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  /** Where the arrow at the top left goes, and what it is called.
   *
   *  A record used to be a window over the list that opened it, so leaving it
   *  meant closing the window. It is a page of its own now, and a page needs a
   *  way back that is visible before you scroll — hence the arrow beside the
   *  title rather than a link buried at the foot. */
  back?: { href: string; label: string };
}) {
  return (
    <div className={`gm-page-head${back ? " gm-page-head--back" : ""}`}>
      {back ? (
        <Link className="gm-backlink" href={back.href} aria-label={`Back to ${back.label}`}>
          <IconArrowLeft />
          <span>{back.label}</span>
        </Link>
      ) : null}
      <div className="gm-page-head-main">
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
    </div>
  );
}

/* ==========================================================================
   Action bar — what the dialog footer became

   A record used to be a dialog, and its actions sat in the dialog's footer:
   pinned to the bottom of the window, always in view, wrapping when there were
   four of them. A record is a page now, so the same row lives at the foot of
   the page and sticks to the bottom of the viewport while there is still
   record above it.

   It wraps rather than scrolls, for the reason the dialog footer wrapped: the
   last action in the row is usually the most consequential one, and a row that
   runs off the edge hides exactly that.
   ========================================================================== */

export function ActionBar({
  children,
  note,
}: {
  children: ReactNode;
  /** Why a button is off, or where the action lands. Sits to the right on a
   *  wide screen and under the buttons on a narrow one. */
  note?: ReactNode;
}) {
  return (
    <div className="gm-actionbar">
      <div className="gm-actionbar-inner">
        {children}
        {note ? <span className="gm-actionbar-note">{note}</span> : null}
      </div>
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
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  const cls = tone === "idle" ? "" : ` gm-badge--${tone}`;
  return <span className={`gm-badge${cls}`}>{children}</span>;
}

export function Tier({ tier }: { tier: "grail" | "high-value" | "standard" }) {
  if (tier === "grail") return <span className="gm-tier gm-tier--high">Grail</span>;
  if (tier === "high-value") return <span className="gm-tier">High</span>;
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

/**
 * A graded slab: the grading company's label across the top, the card behind
 * a window below it. Raw cards drop the label and get a corner tag instead.
 *
 * It used to tint itself per game and lay a foil sheen over the chase grades.
 * Both are gone. A moderator is deciding whether a listing is honest, and no
 * part of that decision reads a colour off the thumbnail — the game is in the
 * set line, the grade is on the label, and the photograph is the evidence.
 */
export function Slab({
  grader,
  grade,
  size = "md",
  art,
}: {
  grader: string;
  grade?: string;
  size?: "sm" | "md" | "lg";
  /**
   * The card's photograph. Either a slug under `public/cards/` (the seeded
   * fixtures) or a URL from the catalogue (what a real listing carries).
   * Both arrive now that the console reads the database, so both are read.
   */
  art?: string;
}) {
  const raw = grader === "Raw" || !grade || grade === "None";

  /* A failed fetch is tracked separately from `art` itself: `gm-slab--art`
     exists only to switch OFF the drawn stand-in beneath the photo, and the
     drawn slab is a deliberate fallback — a real photo on top of it is the
     goal, but a broken-image icon on top of it is worse than the stand-in
     alone, since it looks like a rendering bug rather than a missing photo.
     So the class only turns off once the image is confirmed to work, and
     turns back on the moment it fails. */
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [art]);

  const showArt = !!art && !broken;

  return (
    <span
      className={`gm-slab gm-slab--${size}${raw ? " gm-slab--raw" : ""}${
        showArt ? " gm-slab--art" : ""
      }`}
      aria-hidden="true"
    >
      {/* The label strip and raw tag are hand-drawn pictures of the actual
          grade printed on the slab — they were a stand-in when there was no
          photograph. A real photograph makes the drawn label redundant: it
          already shows the true grade, so rendering both puts a fictional
          label on top of the real one. Hide both when art is available. */}
      {!showArt && raw ? (
        <span className="gm-slab-raw-tag">Raw</span>
      ) : !showArt ? (
        <span className="gm-slab-label">
          <b>{grader}</b>
          <i>{grade}</i>
        </span>
      ) : null}
      <span className="gm-slab-window">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {showArt ? (
          <img
            className="gm-slab-art"
            src={/^(https?:)?\/\//.test(art!) || art!.startsWith("/") ? art : `/cards/${art}.png`}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : null}
      </span>
    </span>
  );
}

/** Which game a card belongs to. A label, in the same chip as everything else. */
export function GameChip({ game }: { game: string }) {
  return <span className="gm-game">{game}</span>;
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
  /** A switch the caller has ruled out — greyed, and not reachable by tab. */
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className="gm-toggle"
      style={disabled ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
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

/**
 * Waiting, with the brand mark on it.
 *
 * Every "Reading the queue…" on this console used to be an `Empty` — the same
 * grey box a page shows when there is genuinely nothing there, with different
 * words in it. Those are opposite states: one says come back later, the other
 * says wait a moment, and drawing them identically meant an empty queue and a
 * slow one were indistinguishable until the text was read.
 *
 * The mark itself cannot be stroke-animated — it is two filled paths, not an
 * outline — so the motion is a gold arc sweeping around it, with the mark
 * breathing underneath. Both stop dead under `prefers-reduced-motion`, where
 * what is left is a static logo above the label, which still says waiting.
 */
export function Loading({ label, small }: { label?: string; small?: boolean }) {
  return (
    <div className={`gm-loading${small ? " gm-loading--sm" : ""}`} role="status" aria-live="polite">
      <span className="gm-loading-mark">
        <svg className="gm-loading-ring" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="gm-loading-track" cx="26" cy="26" r="24" />
          <circle className="gm-loading-arc" cx="26" cy="26" r="24" />
        </svg>
        {/* Two files, not one recoloured: the mark is navy and gold, and navy
            disappears on a dark panel. `mark-onnavy.svg` is the same mark with
            its navy strokes turned white. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gm-mark-light" src="/brand/mark.svg" alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gm-mark-dark" src="/brand/mark-onnavy.svg" alt="" />
      </span>
      {label ? <b>{label}</b> : null}
    </div>
  );
}

/* ==========================================================================
   Modal — one decision, and whatever it needs typed first

   This was a right-hand drawer, then a centred dialog in two widths: a narrow
   one for a decision and a wide one carrying a whole record.

   The wide one is gone. A record — a member, a case, a listing with its photo
   set — is a route now, because the actions on it each opened a *second*
   dialog on top of the first, and two overlays deep there is no back, no
   address for what you are looking at, and on a laptop the inner footer sat
   below the bottom of the outer one.

   What is left is the narrow one, and it is used for exactly what it was
   always right for: a decision that must not be dismissed by looking away,
   with the reason it is recorded under typed into it.
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

  /* Opening a second record while one is already open reuses the same scroll
     container, so without this it would keep the previous position. */
  useEffect(() => {
    if (open) body.current?.scrollTo({ top: 0 });
  }, [open, title]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div className="gm-scrim" onClick={onClose} />
      <div
        className="gm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Details"}
      >
        <header className="gm-dialog-head">
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
        <div className="gm-dialog-body" ref={body}>
          {children}
        </div>
        {footer ? <footer className="gm-dialog-foot">{footer}</footer> : null}
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
 * scrolls, or a dialog cannot clip it.
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
    /* Local pixels, so the fixed coordinates written below are not multiplied
       by the root zoom a second time. */
    const r = localRect(el);
    const vp = localViewport();
    /* enough room below for the list, or does it have to open upward? */
    const wanted = Math.min(opts.length * 36 + 12, 300);
    const up = r.bottom + wanted + 12 > vp.h && r.top > wanted + 12;
    /* the list is at least MIN_W wide even when its trigger is narrower, so
       align it to the trigger but pull it back inside the viewport */
    const width = Math.max(r.width, MIN_W);
    setBox({
      left: Math.max(8, Math.min(r.left, vp.w - width - 10)),
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
/* The height comes back alongside the width for the one chart that has to
   fill a box rather than set one: the dashboard's grid hands its cards a
   share of the window, so the chart inside cannot know how tall it is until
   it is measured. Every other caller destructures two values and is
   unaffected. Nothing here may read `window` — a viewport figure in the
   render path fails `next build` during prerender, and reports it as an
   error about `<Html>` that has nothing to do with the cause. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Local pixels: this width becomes an SVG viewBox, which is drawn in the
       zoomed context and would otherwise be scaled twice. */
    const set = () => {
      const box = localRect(el);
      setW(Math.round(box.width));
      setH(Math.round(box.height));
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, w, h] as const;
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
    /* `clientX` and the rect are both visual pixels; the step it is divided by
       is in the SVG's own units. Local pixels put the two back on one scale. */
    const box = localRect(e.currentTarget);
    const k = uiScale();
    const i = Math.round((e.clientX / k - box.left - padL) / (step || 1));
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
 * A pair of capsules per week: the money, and the work that cleared beside it.
 *
 * It has been both shapes now. It started as two hairline columns per week on
 * two scales, which was honest about the units and unreadable at twenty-four
 * bars across a column; it was then cut to one thick gold bar with the second
 * series surviving only as a figure in the legend, which was readable and had
 * quietly stopped drawing half of what it claimed to be about.
 *
 * This is the pair again, drawn thick enough to be read: two capsules per
 * period, gold for the money and slate for the verifications, with the whole
 * group dimmed except the week being read. The bars are full capsules —
 * half-round at the foot as well as the cap — so each one reads as an object
 * sitting on the baseline rather than as a column growing out of it.
 *
 * The two series keep their own scales, and that is deliberate rather than
 * sloppy: GMV is in thousands and verifications are a count in single figures,
 * so on one axis the second series is a line of dots along the floor. Each is
 * drawn against its own peak, which makes the chart a comparison of shape
 * across weeks rather than of one bar against its neighbour — and the exact
 * figures for whichever week is being read are printed underneath, where they
 * cannot be misread off a scale they do not share.
 *
 * One group is solid and the rest are faint. At rest that is the biggest week
 * for GMV, so the chart states something without being poked; under a pointer
 * it is whichever week is being pointed at. The pill floats over that group
 * rather than parking in a corner, because a readout that is not attached to
 * what it describes has to be matched up by eye every time it moves.
 *
 * `--grad-gold`'s two ends are named tokens precisely so an SVG gradient can
 * take them as stops. The slate ramp is mixed off `--info` rather than off
 * `--navy-500`, which is the same colour in both themes and disappears into
 * the dark surface; `--info` is the console's one neutral slate stated per
 * theme, so the second series reads at the same strength either way.
 */
export function VolumeChart({
  data,
  height,
  formatA = (n: number) => `$${n}k`,
  formatB = (n: number) => String(n),
  labelA = "GMV ($k)",
  labelB = "Verifications cleared",
}: {
  data: { label: string; gmv: number; verified: number }[];
  /** Left out on purpose by the dashboard: there the chart fills the share of
   *  the window its grid row was given, so it has to be measured. */
  height?: number;
  formatA?: (n: number) => string;
  formatB?: (n: number) => string;
  labelA?: string;
  labelB?: string;
}) {
  const [ref, w, boxH] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const h = Math.max(104, height ?? boxH);

  /* Room at the top for the pill to sit clear of the tallest bar, and at the
     foot for the week labels. Nothing at the sides: the first and last groups
     are already half a slot in from the edge. */
  const padL = 4;
  const padR = 4;
  const padT = 32;
  const padB = 19;

  const peak = data.reduce((best, d, i) => (d.gmv > data[best].gmv ? i : best), 0);
  const active = Math.min(data.length - 1, Math.max(0, hover ?? peak));
  const read = data[active] ?? { label: "", gmv: 0, verified: 0 };

  /* A twentieth of headroom before the scale is rounded up, so the tallest
     bar never finishes flush against the top rule. Without it a peak that
     happens to be a round number — two verifications, say — is drawn at the
     full plot height while a peak that is not is drawn at four fifths of it,
     and the two series then read as though the smaller one were the larger.
     Applied to both, so neither is flattered. */
  const maxA = niceMax(Math.max(0, ...data.map((d) => d.gmv)) * 1.05);
  const plotW = Math.max(0, w - padL - padR);
  const plotH = Math.max(0, h - padT - padB);
  const base = padT + plotH;

  const slot = plotW / Math.max(1, data.length);
  const mid = (i: number) => padL + slot * (i + 0.5);

  /* One bar to a week again, and a wide one. The paired version put two
     capsules a third of a slot wide side by side, which at twelve weeks in
     this column left each of them about five pixels — a row of hairs rather
     than the thick rounded bars this was asked for. A single series takes
     three fifths of its slot, so the bar is the mark and the gap is the
     interval, not the other way round. Capped so a four-week series does not
     become paving slabs. */
  const barW = Math.max(9, Math.min(30, slot * 0.6));

  const labelEvery = slot < 26 ? 3 : slot < 42 ? 2 : 1;

  /* A label is centred on its group, and the first and last groups sit half a
     slot from the edge — which on a phone is less than half a date. Both ends
     are pulled far enough in to stay whole; the two or three pixels that costs
     against the week they name is not readable, and a clipped month is. */
  const labelX = (i: number) => Math.min(Math.max(mid(i), 24), Math.max(24, w - 24));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    /* `clientX` and the rect are both visual pixels; the step it is divided by
       is in the SVG's own units. Local pixels put the two back on one scale. */
    const box = localRect(e.currentTarget);
    const k = uiScale();
    const i = Math.floor((e.clientX / k - box.left - padL) / (slot || 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  }

  /** A week with nothing in it is drawn as a dot on the baseline rather than
   *  as a bar, and DOT is its radius. A floored capsule at this bar width was
   *  a squashed lozenge — `rx` clamps to half the height, so a 30px-wide rect
   *  7px tall comes out as a flattened pill rather than the round mark it was
   *  meant to be. A circle says "nothing here" without pretending to a height
   *  it does not have. */
  const DOT = 7;

  /** How tall a capsule is, floored so a lean week is still a mark. Weeks at
   *  zero never reach this — they are drawn as dots instead. */
  const barH = (v: number, max: number) => Math.max(DOT * 2, (v / max) * plotH);

  const groupTop = (i: number) => base - barH(data[i].gmv, maxA);

  const tipText = formatA(read.gmv);
  const tipW = Math.max(48, tipText.length * 7.2 + 20);
  const tipX = px(Math.min(Math.max(mid(active) - tipW / 2, 0), Math.max(0, w - tipW)));
  const tipY = px(Math.max(2, groupTop(active) - 28));

  return (
    <div className="gm-volume">
      <div
        className="gm-volume-plot"
        ref={ref}
        style={height ? { height } : undefined}
      >
        {w > 0 && h > 0 && data.length > 0 ? (
          <svg
            className="gm-chart"
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            role="img"
            aria-label={`${labelA} and ${labelB} over ${data.length} weeks`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="gm-volume-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gold-lift)" />
                <stop offset="100%" stopColor="var(--gold-sink)" />
              </linearGradient>
            </defs>

            {/* Four dotted rules and a solid floor. Dotted so the bars sit in
                front of a suggestion of a scale rather than behind a grid. */}
            {[1, 0.75, 0.5, 0.25].map((f) => (
              <line
                key={f}
                x1={padL}
                x2={px(w - padR)}
                y1={px(base - f * plotH)}
                y2={px(base - f * plotH)}
                stroke="var(--line-2)"
                strokeWidth="1"
                strokeDasharray="1 6"
                strokeLinecap="round"
              />
            ))}
            <line
              x1={padL}
              x2={px(w - padR)}
              y1={px(base)}
              y2={px(base)}
              stroke="var(--line-2)"
              strokeWidth="1"
            />

            {/* A rect with `rx` at half its width IS the capsule — both ends
                half-round, no path arithmetic and nothing to get wrong when
                the bar is shorter than its own radius. */}
            {data.map((d, i) => {
              const on = i === active;
              /* The quiet weeks were at 0.26 and read as a smudge behind the
                 gridlines rather than as bars. They are the series too — only
                 the one being read is emphasised — so they sit at 0.62, which
                 is far enough under the active bar to pick it out and far
                 enough over the dotted rules to be a mark of its own. */
              const paint = {
                opacity: on ? 1 : 0.62,
                fill: on ? "url(#gm-volume-gold)" : "var(--gold)",
                style: { transition: "opacity 0.16s ease" },
              };

              if (d.gmv <= 0) {
                return (
                  <circle
                    key={d.label}
                    cx={px(mid(i))}
                    cy={px(base - DOT)}
                    r={DOT}
                    {...paint}
                  />
                );
              }

              const a = barH(d.gmv, maxA);
              return (
                <rect
                  key={d.label}
                  x={px(mid(i) - barW / 2)}
                  y={px(base - a)}
                  width={px(barW)}
                  height={px(a)}
                  rx={px(barW / 2)}
                  {...paint}
                />
              );
            })}

            {/* The readout, over the group it belongs to.

                `--navy` and `--th-ink` are the pair the console's one dark
                band is made of, and neither changes with the theme, because
                the band does not either — it is dark on both, so its ink is
                near-white on both. This asked for `--th-bg`, which is not a
                token: an unresolvable `var()` in a presentation attribute
                takes the property's initial value rather than being ignored,
                so the pill has been painting flat black and getting away with
                it because black on navy paper is close enough to the thing it
                was meant to be. */}
            <g>
              <rect x={tipX} y={tipY} width={px(tipW)} height="21" rx="10.5" fill="var(--navy)" />
              <text
                x={px(tipX + tipW / 2)}
                y={px(tipY + 14.5)}
                fontSize="11.5"
                fontWeight="650"
                fill="var(--th-ink)"
                textAnchor="middle"
              >
                {tipText}
              </text>
            </g>

            {data.map((d, i) =>
              i % labelEvery === 0 ? (
                <text
                  key={`t${d.label}`}
                  x={px(labelX(i))}
                  y={px(h - 6)}
                  fontSize="10.5"
                  fill={i === active ? "var(--ink-2)" : "var(--ink-4)"}
                  fontWeight={i === active ? 650 : 400}
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              ) : null,
            )}
          </svg>
        ) : null}
      </div>

      <div className="gm-chart-legend gm-chart-legend--dots">
        <span className="gm-legend-key">
          <i className="gm-legend-dot" style={{ background: "var(--gold)" }} />
          {labelA}
          <b className="gm-legend-val">{formatA(read.gmv)}</b>
        </span>
        {/* No swatch on this one: it is a figure for the week being read, not
            a series on the chart. A coloured dot beside it would name a bar
            that is not drawn. */}
        <span className="gm-legend-key">
          {labelB}
          <b className="gm-legend-val">{formatB(read.verified)}</b>
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
          title={`${p.label}: ${Math.round((p.value / total) * 100)}%`}
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
  gradient,
  size = 150,
  thickness = 14,
}: {
  value: number;
  max?: number;
  label: string;
  caption?: string;
  color?: string;
  /** Stroke the arc with a gradient rather than a flat colour. */
  gradient?: { from: string; to: string };
  size?: number;
  thickness?: number;
}) {
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  const r = px((size - thickness) / 2 - 1);
  const c = px(2 * Math.PI * r);
  const drawn = px(pct * c);

  /*
   * useId is called unconditionally (hooks can't be conditional) but only
   * used when a gradient is supplied. A page can show several gauges at
   * once, and every one needs its own <linearGradient> id — a fixed id
   * would let the second dial silently steal the first's ramp. useId also
   * matches on the server and client render, which a random or time-based
   * id would not, so it avoids a hydration mismatch on this
   * server-rendered app. The colons useId returns are valid in an id
   * attribute and fine inside this url(#...) reference, but we strip them
   * so the id stays readable in devtools.
   */
  const gradientId = useId().replace(/:/g, "");

  return (
    <div className="gm-gauge" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${Math.round(pct * 100)}%`}
      >
        {gradient ? (
          <defs>
            {/* Diagonal (0,0 -> 100%,100%) rather than left-to-right, so the
                arc's tone shifts as it sweeps round the dial instead of
                reading as one flat colour with a visible seam. */}
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient.from} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>
        ) : null}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={gradient ? `url(#${gradientId})` : color}
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
    /* `clientX` and the rect are both visual pixels; the step it is divided by
       is in the SVG's own units. Local pixels put the two back on one scale. */
    const box = localRect(e.currentTarget);
    const k = uiScale();
    const i = Math.round((e.clientX / k - box.left - padL) / (step || 1));
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
    /* One word where one word will do, and both words capitalised where two
       are needed. "Awaiting" is a listing nobody has picked up; "Review" is
       one a moderator has claimed — the difference is who has it, which the
       shorter pair still carries. */
    awaiting: { tone: "warn", label: "Awaiting" },
    "in-review": { tone: "info", label: "Review" },
    "info-requested": { tone: "gold", label: "Info Requested" },
    live: { tone: "idle", label: "Live" },
    sold: { tone: "navy", label: "Sold" },
    reserved: { tone: "info", label: "Reserved" },
    paused: { tone: "warn", label: "Paused" },
    withdrawn: { tone: "bad", label: "Withdrawn" },
    rejected: { tone: "bad", label: "Rejected" },
  };
  const m = map[status] ?? { tone: "idle" as BadgeTone, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function MemberBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    active: { tone: "idle", label: "Active" },
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
    resolved: { tone: "idle", label: "Resolved" },
  };
  const m = map[status] ?? { tone: "idle" as BadgeTone, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function TicketBadge({ status }: { status: string }) {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    new: { tone: "bad", label: "New" },
    open: { tone: "info", label: "Open" },
    waiting: { tone: "warn", label: "Waiting" },
    resolved: { tone: "idle", label: "Resolved" },
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

/**
 * How much the market figure is worth trusting, in words.
 *
 * It used to read `low · n=0`, which is two pieces of jargon in a chip half an
 * inch wide: a bare adjective with no noun, and a statistician's letter for
 * something the console never calls `n` anywhere else. A moderator deciding
 * whether an ask is fair has to know what is weak about the figure, and "low"
 * on its own does not say — the answer is always the sample, so the sample is
 * what it says now.
 *
 * Zero is its own sentence rather than "0 sales": there is no figure at all in
 * that case, and the card above already explains that it is withheld rather
 * than guessed.
 */
export function ConfidenceBadge({ level, sample }: { level: string; sample: number }) {
  const map: Record<string, BadgeTone> = { high: "ok", medium: "warn", low: "bad" };
  const from =
    sample === 0
      ? "no comparable sales"
      : `${sample} comparable sale${sample === 1 ? "" : "s"}`;
  return (
    <Badge tone={map[level] ?? "idle"}>
      {level === "high" ? "Confident" : level === "medium" ? "Fair confidence" : "Low confidence"}
      <span className="gm-conf-sep" aria-hidden>
        ·
      </span>
      <span className="gm-conf-from">{from}</span>
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

/**
 * Every filter over a list, behind one button.
 *
 * This replaced a row of five outlined pills. The row worked, but it was the
 * widest thing on the page and it put the console's least-used control at the
 * top of its most-used screen — and it grew every time a filter was added.
 *
 * What it must not do is hide what is applied. The button carries a count of
 * anything set away from its default, and the card's own subtitle says which
 * view is showing, so a filtered list never looks like an empty one.
 */
export function FilterMenu({
  groups,
  applied,
  onClear,
}: {
  groups: {
    key: string;
    label: string;
    value: string;
    options: { value: string; label: string; count?: number }[];
    onChange: (v: string) => void;
  }[];
  /** How many groups sit away from their default. Drawn on the button. */
  applied: number;
  onClear?: () => void;
}) {
  const btn = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{
    left: number;
    /** One of the two is set; the other is null. Flipped panels are pinned by
     *  their foot so they grow upward. */
    top: number | null;
    bottom: number | null;
    max: number;
  } | null>(null);

  /**
   * Where the panel goes, and how tall it may be.
   *
   * Horizontally it is right-aligned to the trigger then pulled back inside
   * the viewport — this button lives at the end of a toolbar, so opening
   * leftward is the only way it stays on screen.
   *
   * Vertically it is capped to the room actually left, and flips above the
   * button when there is more space up there. Without the cap a panel with
   * several groups in it simply ran off the bottom of the window and the last
   * groups could not be reached at all: nothing scrolled, because the panel
   * was fixed-positioned and as tall as it liked.
   */
  const place = useCallback(() => {
    const el = btn.current;
    if (!el) return;
    /* Local pixels, or the fixed coordinates below are multiplied by the root
       zoom a second time and the panel opens a screen away from its button. */
    const r = localRect(el);
    const vp = localViewport();
    const w = 268;
    const gap = 6;
    const edge = 12;

    const below = vp.h - r.bottom - gap - edge;
    const above = r.top - gap - edge;
    /* Flip only when below is genuinely too tight AND above is roomier —
       a panel that jumps upward for the sake of twenty pixels is worse than
       one that scrolls. */
    const flip = below < 260 && above > below;

    setBox({
      left: Math.max(8, Math.min(r.right - w, vp.w - w - 10)),
      top: flip ? null : r.bottom + gap,
      bottom: flip ? vp.h - r.top + gap : null,
      max: Math.max(180, flip ? above : below),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    }
    /**
     * Scrolling the page moves the panel with its button. Scrolling the panel
     * does nothing at all.
     *
     * This listener is on `window` in the CAPTURE phase, which means it sees
     * every scroll anywhere in the document — including the panel's own list.
     * It used to close on all of them, so a menu with more groups than fit
     * shut itself the moment anyone tried to scroll to the rest of them: the
     * taller the menu, the less usable it was.
     *
     * Closing on a page scroll was the old answer to a stale position. It does
     * not need to be: `place()` is cheap and re-reads the button's rect, so
     * the panel simply follows. It closes only when the button it belongs to
     * has left the screen, at which point there is nothing to be anchored to.
     */
    function onScroll(e: Event) {
      const t = e.target as Node | null;
      if (t && panel.current?.contains(t)) return;

      const r = btn.current ? localRect(btn.current) : null;
      if (!r || r.bottom < 0 || r.top > localViewport().h) {
        setOpen(false);
        return;
      }
      place();
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  /* Nothing to filter by, nothing to click. Pages whose sections carry
     different secondary filters end up here on the ones that carry none, and
     a Filter button that opens an empty panel is worse than no button. */
  if (groups.length === 0) return null;

  return (
    <>
      <button
        type="button"
        ref={btn}
        className={`gm-btn gm-filterbtn${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IconFilter />
        Filter
        {/* A dot, not a number. The count was of filters applied, and sitting
            next to the word "Filter" above a table of nine rows it read as
            the number of rows — which is the one thing it never was. What is
            applied is spelled out in the card's own subtitle. */}
        {applied > 0 ? <span className="gm-filterbtn-dot" aria-hidden="true" /> : null}
      </button>

      {open && box ? (
        <OverlayPortal>
          <div
            ref={panel}
            className="gm-menu gm-filterpanel"
            role="dialog"
            aria-label="Filters"
            style={
              {
                position: "fixed",
                left: box.left,
                ...(box.top === null ? { bottom: box.bottom } : { top: box.top }),
                "--gm-filter-max": `${box.max}px`,
              } as unknown as React.CSSProperties
            }
          >
            <div className="gm-filterscroll">
            {groups.map((g) => (
              <div key={g.key} className="gm-filtergroup">
                <div className="gm-label">{g.label}</div>
                <div className="gm-filteropts" role="radiogroup" aria-label={g.label}>
                  {g.options.map((o) => {
                    const on = o.value === g.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`gm-filteropt${on ? " is-active" : ""}`}
                        onClick={() => g.onChange(o.value)}
                      >
                        <span>{o.label}</span>
                        {typeof o.count === "number" ? (
                          <span className="gm-filteropt-n">{o.count}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            </div>

            {onClear ? (
              <div className="gm-filterfoot">
                <button
                  type="button"
                  className="gm-btn gm-btn--sm gm-btn--ghost"
                  disabled={applied === 0}
                  onClick={onClear}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}

/**
 * A segmented switch between the sections of a page.
 *
 * Not a filter, and that distinction is the whole reason this exists beside
 * `FilterMenu`. A filter narrows one list and has an "everything" to go back
 * to, so hiding it behind a button costs nothing — the heading says what is
 * applied. A section switch has no "all": Plans, Boosts and Billing are three
 * different tables, and putting them in a dropdown hides two thirds of a page
 * behind a control labelled "Filter".
 *
 * One container rather than separate buttons, because the choice is between
 * these options and no others. The selected one is filled and carries the
 * same corner radius as every button in the console.
 */
/* ==========================================================================
   Pagination

   A queue that grows past a screenful becomes a scroll with no sense of how
   much is left in it — and on a page whose whole job is "what is waiting",
   not knowing how much is waiting is the one thing it must not do.

   It renders nothing below the page size. A control that says "1 of 1" is a
   control that has never once been useful, and on a console that is mostly
   short lists it would be on screen far more often than it was needed.

   The page does its own slicing. This only says where you are and moves you;
   giving it the rows as well would make it the only component here that both
   draws a control and decides what the page shows.
   ========================================================================== */

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  /** One-based. */
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const at = Math.min(Math.max(1, page), pages);
  const from = (at - 1) * pageSize + 1;
  const to = Math.min(at * pageSize, total);

  /* At most seven numbers, always including the first and the last, with a
     gap standing in for whatever is skipped. Twenty numbered buttons is a
     worse way to reach page nine than two clicks on "next". */
  const numbers: (number | "gap")[] = [];
  const window = new Set<number>([1, pages, at, at - 1, at + 1]);
  if (at <= 3) [2, 3, 4].forEach((n) => window.add(n));
  if (at >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => window.add(n));
  const sorted = [...window].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) numbers.push("gap");
    numbers.push(n);
  });

  return (
    <nav className="gm-pager" aria-label="Pages">
      <span className="gm-pager-count">
        {from}–{to} of {total}
      </span>
      <div className="gm-pager-controls">
        <button
          type="button"
          className="gm-pager-step"
          onClick={() => onPage(at - 1)}
          disabled={at === 1}
          aria-label="Previous page"
        >
          <IconArrowLeft />
        </button>
        {numbers.map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} className="gm-pager-gap" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`gm-pager-n${n === at ? " is-active" : ""}`}
              onClick={() => onPage(n)}
              aria-current={n === at ? "page" : undefined}
              aria-label={`Page ${n}`}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          className="gm-pager-step"
          onClick={() => onPage(at + 1)}
          disabled={at === pages}
          aria-label="Next page"
        >
          <IconArrowRight />
        </button>
      </div>
    </nav>
  );
}

/* ==========================================================================
   Row menu — the actions on a row, behind one control

   The dashboard only, and that is the whole of the argument for it.

   The queues have a page each: a table across the full width, one or two
   actions a row, and room to name them. This table is an extract in a column
   beside the standings rail with about 825px to work in, and "Approve" and
   "Reject" as buttons were the two things that pushed it past that — the row
   grew a sideways scrollbar in the middle of a dashboard, which is the one
   place that should never ask you to scroll to read a number.

   So here, and nowhere else, the actions go behind one 30px control. It also
   gains the third thing that would not fit as a button at all: a way into the
   record, which is what you want on any row you are not sure about.
   ========================================================================== */

export type RowAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** A navigation. Rendered as a link, so it opens in a new tab on
   *  middle-click like any other link in the console. */
  href?: string;
  onClick?: () => void;
  tone?: "danger";
};

export function RowMenu({ actions, label = "Actions" }: { actions: RowAction[]; label?: string }) {
  const btn = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number | null; bottom: number | null } | null>(
    null,
  );

  /**
   * Where it opens.
   *
   * Right-aligned to the button and pulled inside the viewport, because this
   * control lives in the last column of a table. It flips above when there is
   * not room below — which is most of the time, since the rows that need it
   * most are the ones at the bottom of the list.
   */
  const place = useCallback(() => {
    const el = btn.current;
    if (!el) return;
    /* Local pixels. The root is zoomed above 1600px, and a rect fed straight
       back into a fixed coordinate is multiplied by that zoom a second time. */
    const r = localRect(el);
    const vp = localViewport();
    const w = 226;
    const gap = 6;
    const need = actions.length * 36 + 16;
    const below = vp.h - r.bottom - gap - 12;
    const flip = below < need && r.top - gap - 12 > below;

    setBox({
      left: Math.max(8, Math.min(r.right - w, vp.w - w - 10)),
      top: flip ? null : r.bottom + gap,
      bottom: flip ? vp.h - r.top + gap : null,
    });
  }, [actions.length]);

  useEffect(() => {
    if (!open) return;
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    }
    /* Follow the button rather than closing on a scroll, and give up only once
       the row it belongs to has left the screen. Same reasoning as FilterMenu:
       a menu that shuts the moment the table moves is a menu you cannot use
       while reading the table. */
    function onScroll(e: Event) {
      const t = e.target as Node | null;
      if (t && panel.current?.contains(t)) return;
      const r = btn.current ? localRect(btn.current) : null;
      if (!r || r.bottom < 0 || r.top > localViewport().h) {
        setOpen(false);
        return;
      }
      place();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  if (actions.length === 0) return null;

  return (
    <>
      <button
        type="button"
        ref={btn}
        className={`gm-rowmenu-btn${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <IconMore />
      </button>

      {open && box ? (
        <OverlayPortal>
          <div
            ref={panel}
            className="gm-menu gm-rowmenu"
            role="menu"
            aria-label={label}
            style={{
              position: "fixed",
              left: box.left,
              ...(box.top === null ? { bottom: box.bottom ?? 0 } : { top: box.top }),
            }}
          >
            {actions.map((a) =>
              a.href ? (
                <Link
                  key={a.key}
                  role="menuitem"
                  className={`gm-menu-item${a.tone === "danger" ? " gm-menu-item--danger" : ""}`}
                  href={a.href}
                  onClick={() => setOpen(false)}
                >
                  {a.icon}
                  {a.label}
                </Link>
              ) : (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  className={`gm-menu-item${a.tone === "danger" ? " gm-menu-item--danger" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    a.onClick?.();
                  }}
                >
                  {a.icon}
                  {a.label}
                </button>
              ),
            )}
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}

export function SectionTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string; count?: number }[];
}) {
  return (
    <div className="gm-segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`gm-segment${value === o.key ? " is-active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          <span>{o.label}</span>
          {typeof o.count === "number" ? <span className="gm-segment-n">{o.count}</span> : null}
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
  /* Most sellers here sit above 4.5, so a green chip on almost every row said
     nothing. Colour starts where a score is worth looking at. */
  const tone = value >= 4.2 ? "" : value >= 3.8 ? " gm-rating--mid" : " gm-rating--low";
  return (
    <span className={`gm-rating${tone}`}>
      <IconStar />
      {value.toFixed(1)}
    </span>
  );
}

/**
 * What just happened, said once and then gone.
 *
 * Three things were wrong with the shape this replaces. The tick sat in a
 * 30px ring vertically centred against a two-line message, so on anything
 * longer than a few words it floated between the two lines rather than
 * sitting with the heading it belongs to; the ring was outlined in `--ok`
 * whatever the toast said, so a failure was announced with a green tick; and
 * the body copy was styled through a bare `span` selector that also caught
 * the wrapper, which is why the heading needed a `<b>` to claw its own size
 * back.
 *
 * So: the mark is tinted by tone and aligned to the first line, the text is
 * its own block, there is a way to dismiss it before the timer, and a hairline
 * under it runs down as the timer does — a toast that vanishes with no warning
 * reads as a glitch.
 */
export function Toast({
  title,
  body,
  tone = "ok",
  onDone,
}: {
  title: string;
  body: string;
  /** `bad` for something that did not happen. The default says it did. */
  tone?: "ok" | "bad" | "info";
  onDone: () => void;
}) {
  /* Long enough to finish reading it, and there is a way out before then.

     It was 3.6 seconds, which is about one reading of a two-line message by
     somebody already looking at the corner it appears in — and nobody is,
     because they are looking at the thing they just clicked. A toast that
     goes before it has been read is a toast that never happened. So: twelve
     seconds, twenty for a failure, the hairline underneath showing how much
     of that is left, and a close button for anyone who has read it and wants
     the corner back. */
  const life = tone === "bad" ? 20000 : 12000;

  useEffect(() => {
    const t = setTimeout(onDone, life);
    return () => clearTimeout(t);
  }, [onDone, life]);

  return (
    <OverlayPortal>
      <div
        className={`gm-toast gm-toast--${tone}`}
        role={tone === "bad" ? "alert" : "status"}
        aria-live={tone === "bad" ? "assertive" : "polite"}
      >
        <span className="gm-toast-ico" aria-hidden>
          {tone === "bad" ? <IconAlert /> : tone === "info" ? <IconInfo /> : <IconCheck />}
        </span>
        <div className="gm-toast-text">
          <b>{title}</b>
          <p>{body}</p>
        </div>
        <button
          type="button"
          className="gm-toast-close"
          onClick={onDone}
          aria-label="Dismiss"
        >
          <IconX />
        </button>
        <span
          className="gm-toast-life"
          style={{ animationDuration: `${life}ms` }}
          aria-hidden
        />
      </div>
    </OverlayPortal>
  );
}
