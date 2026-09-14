"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ApiError, sessionActive, signIn } from "../lib/api";
import { IconEye, IconEyeOff } from "../components/icons";
import "../login.css";

/**
 * The console's sign-in.
 *
 * There is no account creation here, deliberately. Console accounts are made
 * by an owner from the team page — "staff accounts: invite, scope, revoke" —
 * so a sign-up button on this screen would be an invitation to a door that
 * does not open. A member who signs up in the app and arrives here is told
 * their account is real and has no console role, which is the truth.
 */

/* ==========================================================================
   THE BRAND PANEL'S MOCK CONSOLE

   This used to be four `@keyframes` animations — one per screen — plus four
   more for the chrome's title and the page dots, all declared `infinite` and
   trusted to stay in lockstep forever because they were declared together.
   They didn't: nothing pins four independent infinite CSS animations to the
   same clock once the page has been open a while, and the result was two
   screens' content showing at once and a title that named a screen other
   than the one on display — reported back as boxes with nothing in them and
   text overlapping text.

   Rewritten as one state machine instead. `MOCK_STEPS` is the whole
   performance, in order — which screen, where the cursor is, what is
   pressed, which one-off reveal flags are on — and exactly one `setTimeout`
   chain walks through it. There is one clock, so there is nothing left for
   two pieces of the mock to disagree about. Every visual change is then a
   plain CSS `transition` keyed off a class or an inline style driven by this
   state, not a second animation timeline that also has to be kept in sync. */

type MockScreen = 0 | 1 | 2 | 3 | 4;

type MockPt = { x: number; y: number };

/** A row's own three-stage life: untouched, under the cursor, clicked. */
type RowState = "idle" | "hover" | "active";

/** Which section the demo is about to move to. Set between leaving one
 *  section and the rail click landing on the next — see `INTRO` below. */
type IntroKind = "dashboard" | "support" | "verification";

interface MockState {
  screen: MockScreen;
  cursor: MockPt;
  pressed: string | null;
  ring: { x: number; y: number; on: boolean };
  loading: boolean;
  row1: RowState;
  row2: RowState;
  trow1: RowState;
  recWithdrawn: boolean;
  toastOn: boolean;
  typed: boolean;
  sent: boolean;
  intro: IntroKind | null;
}

/** What the "next page" card says while it stands in for the section the
 *  demo is about to open — the heading names it, the line under it says
 *  what it is for. */
const INTRO: Record<IntroKind, { heading: string; sub: string }> = {
  dashboard: { heading: "Dashboard", sub: "Everything that needs attention today, in one place." },
  support: { heading: "Support", sub: "Reply to tickets and refund requests, right from the queue." },
  verification: { heading: "Verification", sub: "Review every submission before it reaches the market." },
};

/* `IDLE` is only ever used for the very first pose and as the landing spot
   the cursor is snapped to (not glided to) while a screen is loading and
   hidden — every other move goes straight from one target to the next now,
   so the cursor is never parked mid-performance. It sits in the pane's own
   empty corner instead of on the chrome's "Live" text, which is what it did
   every time it parked there before. A rough corner is fine for a resting
   spot nothing is meant to land on. */
const IDLE: MockPt = { x: 444, y: 67 };

/* Everywhere the cursor actually has to land on something, it is measured
   off the real DOM at the moment it moves there — see `measureEl` and
   `resolveStep` below — rather than a pixel position hand-measured once and
   baked into the file. That was tried twice and drifted twice: the window's
   height used to be a fixed 250px and is now whatever the aside gives it,
   so a coordinate measured at one render is wrong at another — the "next
   page" button moved with however many lines its own sentence wrapped to,
   and the chat input and send button, pinned near the bottom of a window
   that used to be short, sat low enough in a shorter real render to be
   clipped by the mock's own `overflow: hidden` and vanish outright. `nth`
   picks among several elements sharing a class — the two queue rows, the
   two "next page" cards. */
type ElementRef = { sel: string; nth?: number };

const EL = {
  row1: { sel: ".gm-mock-qrow", nth: 0 },
  row2: { sel: ".gm-mock-qrow", nth: 1 },
  recWithdraw: { sel: ".gm-mock-recbtn" },
  trow1: { sel: ".gm-mock-trow", nth: 0 },
  chatInput: { sel: ".gm-mock-chatinput" },
  chatSend: { sel: ".gm-mock-send" },
  railDashboard: { sel: ".gm-mock-railicon", nth: 0 },
  railVerification: { sel: ".gm-mock-railicon", nth: 1 },
  railSupport: { sel: ".gm-mock-railicon", nth: 2 },
  /* Whichever "next page" card is actually showing, not a fixed index —
     "Support" and "Verification" carry different sentences that wrap to a
     different number of lines, which moves this button; measuring `.is-on`
     is what keeps the cursor landing on it either way. */
  introGo: { sel: ".gm-mock-intro.is-on .gm-mock-introbtn" },
} satisfies Record<string, ElementRef>;

/** An element's own centre, in the mock's own coordinate space — the same
 *  space `state.cursor`/`state.ring` are drawn in, since the cursor is
 *  `position: absolute` inside `.gm-mock` and translated by these numbers. */
function measureEl(root: HTMLElement | null, ref: ElementRef): MockPt {
  if (!root) return IDLE;
  const mockBox = root.getBoundingClientRect();
  const el = root.querySelectorAll(ref.sel)[ref.nth ?? 0] as HTMLElement | undefined;
  if (!el) return IDLE;
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2 - mockBox.left, y: b.top + b.height / 2 - mockBox.top };
}

/** A step's patch, plus the two fields that ask for a live measurement
 *  instead of carrying one. Resolved once, at the moment the step applies —
 *  see `resolveStep`, called from `tick` in `LoginMock`. */
type StepPatch = Partial<MockState> & {
  cursorFrom?: ElementRef;
  ringFrom?: ElementRef & { on: boolean };
};

function resolveStep(patch: StepPatch, root: HTMLElement | null): Partial<MockState> {
  const { cursorFrom, ringFrom, ...rest } = patch;
  const out: Partial<MockState> = { ...rest };
  if (cursorFrom) out.cursor = measureEl(root, cursorFrom);
  if (ringFrom) {
    const pt = measureEl(root, ringFrom);
    out.ring = { x: pt.x, y: pt.y, on: ringFrom.on };
  }
  return out;
}

/* The loop's true resting state, and — since `intro` is a dashboard card
   rather than `null` — also its opening beat: the demo starts on a word
   about the dashboard rather than a flash of the dashboard itself, the same
   as every other section it moves to. See `MOCK_STEPS` below: the very last
   step lands back in this exact state, so the wrap from the end of the array
   to the start is not a cut to a different picture, just the same one
   continuing. */
const RESET: MockState = {
  screen: 0,
  cursor: IDLE,
  pressed: null,
  ring: { x: 0, y: 0, on: false },
  loading: false,
  row1: "idle",
  row2: "idle",
  trow1: "idle",
  recWithdrawn: false,
  toastOn: false,
  typed: false,
  sent: false,
  intro: "dashboard",
};

/* One entry per beat. `0` is always a full reset (not a patch) — the one
   moment the whole loop re-enters at, so nothing from the previous pass can
   leak into the next one. Every other entry patches only what changes.

   Every section this demo visits is reached the same way: a rail click, the
   "next page" card naming the section, then its own button — dashboard
   included, now, rather than being the one screen that is simply already
   there when the loop starts. That used to mean the raw dashboard flashed up
   for a moment before the first rail click carried it away, and the same cut
   happened in reverse at the end of the loop: the last thing on screen was
   Verification's own "next page" card, and the tick after it jumped straight
   to the dashboard with nothing in between. Both are gone now that the
   dashboard has an intro card of its own and `RESET` opens on it rather than
   on `intro: null` — see `RESET` above.

   From the dashboard: the cursor passes over the first queue row — grey
   while it rests there — and moves on without clicking it, then hovers and
   clicks the second, which is the one that actually opens: it is the only
   row that ever turns the console's own navy, so navy keeps meaning "this is
   the one that opened" rather than becoming the colour every row eventually
   is. From the record, withdraw it, then click across to Support in the rail
   itself rather than have the record hand off on its own; do the same
   hover-then-click on a support ticket, reply to it, and click back to
   Verification in the rail — landing on the queue, not on the dashboard —
   then finally across to Dashboard's own rail icon to close the loop. Every
   section change goes through the rail; only opening a record within a
   section is a row's own click. And every move goes straight to its next
   target — nothing parks at a resting position mid-performance, which is
   what repeatedly sent the cursor back up to the chrome's "Live" text
   before. */
const MOCK_STEPS: Array<{ patch: StepPatch; dwell: number }> = [
  { patch: RESET, dwell: 1300 },

  { patch: { cursorFrom: EL.introGo }, dwell: 550 },
  { patch: { pressed: "introgo", ringFrom: { ...EL.introGo, on: true } }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.introGo, on: false } }, dwell: 250 },
  { patch: { loading: true }, dwell: 450 },
  { patch: { loading: false, intro: null, screen: 0, cursor: IDLE, ring: { x: 0, y: 0, on: false } }, dwell: 1700 },

  { patch: { cursorFrom: EL.railVerification }, dwell: 650 },
  { patch: { pressed: "rail-verification", ringFrom: { ...EL.railVerification, on: true } }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.railVerification, on: false } }, dwell: 400 },
  { patch: { loading: true }, dwell: 500 },
  { patch: { loading: false, intro: "verification", cursor: IDLE, ring: { x: 0, y: 0, on: false } }, dwell: 1300 },
  { patch: { cursorFrom: EL.introGo }, dwell: 550 },
  { patch: { pressed: "introgo", ringFrom: { ...EL.introGo, on: true } }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.introGo, on: false } }, dwell: 250 },
  { patch: { loading: true }, dwell: 450 },
  { patch: { loading: false, intro: null, screen: 1, cursor: IDLE, ring: { x: 0, y: 0, on: false } }, dwell: 750 },

  { patch: { cursorFrom: EL.row1 }, dwell: 650 },
  { patch: { row1: "hover" }, dwell: 500 },
  { patch: { row1: "idle", cursorFrom: EL.row2 }, dwell: 650 },
  { patch: { row2: "hover" }, dwell: 500 },
  { patch: { pressed: "row2", row2: "active", ringFrom: { ...EL.row2, on: true } }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.row2, on: false } }, dwell: 1500 },
  { patch: { loading: true }, dwell: 500 },
  { patch: { loading: false, screen: 2, cursor: IDLE, ring: { x: 0, y: 0, on: false } }, dwell: 750 },

  { patch: { cursorFrom: EL.recWithdraw }, dwell: 650 },
  {
    patch: {
      pressed: "recwithdraw",
      ringFrom: { ...EL.recWithdraw, on: true },
      recWithdrawn: true,
      toastOn: true,
    },
    dwell: 260,
  },
  { patch: { pressed: null, ringFrom: { ...EL.recWithdraw, on: false } }, dwell: 1600 },
  /* The move to Support happens in the rail, not the record — a section
     change is a click on the section, the way it actually is. What the rail
     click opens is a "next page" card naming Support and saying what it is
     for, not the section itself — that only appears once its own centre
     button is clicked, the way the reference this follows moves between
     steps. */
  { patch: { toastOn: false, cursorFrom: EL.railSupport }, dwell: 650 },
  { patch: { pressed: "rail-support", ringFrom: { ...EL.railSupport, on: true } }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.railSupport, on: false } }, dwell: 400 },
  { patch: { loading: true }, dwell: 500 },
  { patch: { loading: false, intro: "support", cursor: IDLE, ring: { x: 0, y: 0, on: false } }, dwell: 1300 },
  { patch: { cursorFrom: EL.introGo }, dwell: 550 },
  { patch: { pressed: "introgo", ringFrom: { ...EL.introGo, on: true } }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.introGo, on: false } }, dwell: 250 },
  { patch: { loading: true }, dwell: 450 },
  { patch: { loading: false, intro: null, screen: 3, cursor: IDLE, ring: { x: 0, y: 0, on: false } }, dwell: 750 },

  { patch: { cursorFrom: EL.trow1 }, dwell: 650 },
  { patch: { trow1: "hover" }, dwell: 500 },
  { patch: { pressed: "trow1", trow1: "active", ringFrom: { ...EL.trow1, on: true } }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.trow1, on: false } }, dwell: 1500 },
  { patch: { loading: true }, dwell: 500 },
  { patch: { loading: false, screen: 4, cursor: IDLE, ring: { x: 0, y: 0, on: false } }, dwell: 750 },

  { patch: { cursorFrom: EL.chatInput }, dwell: 600 },
  { patch: { pressed: "chatinput", typed: true }, dwell: 350 },
  { patch: { pressed: null }, dwell: 900 },
  { patch: { cursorFrom: EL.chatSend }, dwell: 550 },
  { patch: { pressed: "chatsend", ringFrom: { ...EL.chatSend, on: true }, sent: true }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.chatSend, on: false } }, dwell: 1500 },
  /* Straight back to Dashboard from here — a rail click, the loop's last one
     — rather than a second visit to Verification first. The tour has already
     shown every section once each; repeating one before closing the loop
     made the cycle read as Dashboard → Verification → Support → Verification
     → Dashboard, with Verification getting two turns and nothing else
     getting a second look. Landing in exactly the state `RESET` opens the
     array with means the wrap back to step 0 is invisible rather than a cut. */
  { patch: { typed: false, sent: false, cursorFrom: EL.railDashboard }, dwell: 650 },
  { patch: { pressed: "rail-dashboard", ringFrom: { ...EL.railDashboard, on: true } }, dwell: 260 },
  { patch: { pressed: null, ringFrom: { ...EL.railDashboard, on: false } }, dwell: 400 },
  { patch: { loading: true }, dwell: 500 },
  { patch: { loading: false, intro: "dashboard", cursor: IDLE, ring: { x: 0, y: 0, on: false } }, dwell: 1300 },
];

/* The rail's own four sections — two more than the mock ever opens, the way
   a real folded rail carries more than the two screens any one demo visits.
   Verification's two screens (queue, record) and support's two (desk,
   ticket) share a rail icon each, so the highlight names the section rather
   than the page. */
function RailIcon({ kind }: { kind: "dashboard" | "verification" | "support" | "reports" }) {
  if (kind === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7.5" height="8.5" rx="1.6" />
        <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.6" />
        <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.6" />
        <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.6" />
      </svg>
    );
  }
  if (kind === "verification") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3.5" width="7" height="9" rx="1.6" />
        <rect x="3" y="15.5" width="7" height="5" rx="1.6" />
        <path d="M13 5.5h8M13 9h6M13 16h8M13 19.5h5" />
      </svg>
    );
  }
  if (kind === "support") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.6 12.6v-1.4a7.4 7.4 0 0 1 14.8 0v1.4" />
        <rect x="2.8" y="11.8" width="4" height="5.8" rx="2" />
        <rect x="17.2" y="11.8" width="4" height="5.8" rx="2" />
        <path d="M19.2 17.6v.3a3.2 3.2 0 0 1-3.2 3.2h-1.5" />
        <circle cx="12.6" cy="21.1" r="1.7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.6" y="4.4" width="18.8" height="15.2" rx="2" />
      <path d="M6.2 12.6 9.4 9.8l2.6 2.2 3.6-3.6" />
    </svg>
  );
}

/* A miniature of the real `Slab` component (`ui.tsx`/`cards.css`): the label
   strip carries the grade, and the window below it shows the card itself —
   one of the same catalogue images `public/cards/` already serves for the
   real console's own fixtures — rather than the navy stand-in `Slab` falls
   back to when a listing has no photograph. `gm-mock-slab--art` turns that
   drawn stand-in off, the same switch the real component makes. */
function MiniSlab({ grade, size, art }: { grade: string; size?: "lg"; art?: string }) {
  return (
    <span
      className={"gm-mock-slab" + (size ? ` gm-mock-slab--${size}` : "") + (art ? " gm-mock-slab--art" : "")}
      aria-hidden="true"
    >
      <span className="gm-mock-slab-label">{grade}</span>
      <span className="gm-mock-slab-window">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" />
        ) : null}
      </span>
    </span>
  );
}

const CRUMBS = [
  "Dashboard",
  "Verification",
  "Verification · record",
  "Support",
  "Support · ticket",
];
const RAIL_SECTIONS = ["dashboard", "verification", "support", "reports"] as const;

function LoginMock() {
  const [state, setState] = useState<MockState>(RESET);
  const idxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* What `cursorFrom`/`ringFrom` measure against — see `measureEl` above. */
  const mockElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function tick() {
      const step = MOCK_STEPS[idxRef.current];
      setState((prev) =>
        idxRef.current === 0 ? RESET : { ...prev, ...resolveStep(step.patch, mockElRef.current) }
      );
      idxRef.current = (idxRef.current + 1) % MOCK_STEPS.length;
      timerRef.current = setTimeout(tick, step.dwell);
    }
    timerRef.current = setTimeout(tick, MOCK_STEPS[0].dwell);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const activeSection = state.screen === 0 ? 0 : state.screen < 3 ? 1 : 2;
  /* What the crumb (and the pager dots below it) actually name.
   *
   * `state.screen` only changes once an intro card's own "See it" button is
   * clicked — while the card itself is up, it still holds whichever screen
   * was on show before the rail was clicked, unrelated to the section the
   * card is naming. Every arrival step patches `intro` and `screen` in the
   * same breath except this one gap, so the crumb read "Verification ·
   * record" under a card that said "Support". This resolves the crumb (and
   * the pager) to the section an open intro card is ABOUT, falling back to
   * the real screen the rest of the time.
   */
  const crumbIndex =
    state.intro === "dashboard" ? 0
    : state.intro === "verification" ? 1
    : state.intro === "support" ? 3
    : state.screen;
  const cls = (name: string, on: boolean) => `${name}${on ? " is-on" : ""}`;

  return (
    <div className="gm-mock-tilt">
      <div className="gm-mock" ref={mockElRef}>
        <div className="gm-mock-bar">
          <span className="gm-mock-dot" />
          <span className="gm-mock-dot" />
          <span className="gm-mock-dot" />
          <span className="gm-mock-crumb">
            {CRUMBS.map((c, i) => (
              <span key={c} className={cls("gm-mock-crumb-x", crumbIndex === i)}>
                {c}
              </span>
            ))}
          </span>
          <span className="gm-mock-live">
            <i className="gm-mock-live-dot" />
            Live
          </span>
        </div>

        <span className={cls("gm-mock-loadbar", state.loading)} />

        <div className="gm-mock-shell">
          {/* The sidebar folded to its icon rail — present on every screen,
              not just the first, because the real console's rail does not
              disappear when you open a record. It highlights the section
              you are in, the way `.gm-rail-item.is-active` does. */}
          {/* Collapsed away, not merely covered, while the "next page" card
              is up — the reference this follows has nothing down the side
              of that screen, and a rail still sitting there under it would
              be a sidebar the card is pretending not to have. */}
          <div className={"gm-mock-rail" + (state.intro ? " is-hidden" : "")}>
            {RAIL_SECTIONS.map((kind, i) => (
              <span
                key={kind}
                className={
                  cls("gm-mock-railicon", i === activeSection) +
                  (state.pressed === `rail-${kind}` ? " is-pressed" : "")
                }
              >
                <RailIcon kind={kind} />
              </span>
            ))}
          </div>

          <div className="gm-mock-pane">
            {/* A static establishing shot rather than another interactive
                beat — the cursor's next move is straight to the rail, the
                way a real operator glances at the dashboard on the way to
                the queue rather than clicking anything on it. */}
            <div className={cls("gm-mock-screen", state.screen === 0)}>
              {/* The real dashboard's own opening line — a quiet date above a
                  two-weight greeting — not a page title, because the real
                  page does not have one either: see `.gm-dash-hello` in
                  page.tsx. No name in it, the same way the real greeting
                  reads before a session has answered: this mock has nobody
                  signed into it, so there is nobody to invent one for. */}
              <div className="gm-mock-dashhead">
                <span>Today</span>
                <b>Welcome back</b>
              </div>

              <div className="gm-mock-stats">
                <div className="gm-mock-stat">
                  <i>Weekly revenue</i>
                  <b>$18.4k</b>
                </div>
                <div className="gm-mock-stat">
                  <i>Live listings</i>
                  <b>212</b>
                </div>
                <div className="gm-mock-stat">
                  <i>Open reports</i>
                  <b>4</b>
                </div>
              </div>

              {/* A card of its own, the way every panel on the real dashboard
                  is — a heading, a button that goes to the page that owns the
                  figure, and the chart underneath it. */}
              <div className="gm-mock-kpi">
                <div className="gm-mock-kpi-head">
                  <span>Marketplace volume</span>
                  <span className="gm-mock-kpi-btn">
                    All 12<i>→</i>
                  </span>
                </div>
                <div className="gm-mock-chart" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>

            <div className={cls("gm-mock-screen", state.screen === 1)}>
              <div className="gm-mock-panehead">
                <b>Verification</b>
                <span className="gm-mock-count">12 pending</span>
              </div>

              <div className="gm-mock-qrows">
                {/* Both rows are the one shape now — a slab, a name and a
                    line of real detail under it, a tier chip, a chevron —
                    so neither reads as a different width or a different
                    kind of row. Hover greys the row the cursor is over;
                    a click turns it the console's own navy, the same
                    press every other control in the mock takes. */}
                <div className={"gm-mock-qrow" + (state.row1 !== "idle" ? ` is-${state.row1}` : "")}>
                  <MiniSlab grade="10" art="/cards/pokemon-charizard.png" />
                  <span className="gm-mock-rowtext">
                    <b>Charizard VMAX</b>
                    <i>Base Set · Holo #4</i>
                  </span>
                  <span className="gm-mock-badge">High</span>
                  <span className="gm-mock-chev">›</span>
                </div>
                <div className={"gm-mock-qrow" + (state.row2 !== "idle" ? ` is-${state.row2}` : "")}>
                  <MiniSlab grade="9.5" art="/cards/pokemon-umbreon.png" />
                  <span className="gm-mock-rowtext">
                    <b>Umbreon VMAX</b>
                    <i>Evolving Skies #215</i>
                  </span>
                  <span className="gm-mock-badge">Standard</span>
                  <span className="gm-mock-chev">›</span>
                </div>
              </div>
            </div>

            <div className={cls("gm-mock-screen", state.screen === 2)}>
              <div className="gm-mock-rechead">
                <span className={"gm-mock-recchip" + (state.recWithdrawn ? " gm-mock-recchip--withdrawn" : "")}>
                  {state.recWithdrawn ? "Withdrawn" : "Review"}
                </span>
                <span className={"gm-mock-recbtn" + (state.pressed === "recwithdraw" ? " is-pressed" : "")}>
                  Withdraw
                </span>
              </div>

              <div className="gm-mock-rec">
                <div className="gm-mock-recaside">
                  <MiniSlab grade="9.5" size="lg" art="/cards/pokemon-umbreon.png" />
                  <span className="gm-mock-recname">Umbreon VMAX</span>
                  <span className="gm-mock-recsub">Seller · verified</span>
                </div>
                <div className="gm-mock-recmain">
                  <span className="gm-mock-recfact">
                    <i>Grade</i>
                    <b>PSA 9.5</b>
                  </span>
                  <span className="gm-mock-recfact">
                    <i>Asking</i>
                    <b>A$640</b>
                  </span>
                  <span className="gm-mock-recfact">
                    <i>Photos</i>
                    <b>4 of 4</b>
                  </span>
                </div>
              </div>

              <span className={cls("gm-mock-toast", state.toastOn)}>Withdrawn from sale</span>
            </div>

            <div className={cls("gm-mock-screen", state.screen === 3)}>
              <div className="gm-mock-panehead">
                <b>Support</b>
                <span className="gm-mock-count">4 open</span>
              </div>

              <div className="gm-mock-trows">
                {/* The ticket this row opens is the same one screen D shows
                    — the subject line carries across the click rather than
                    naming a ticket that then opens as a different one. */}
                <div className={"gm-mock-trow" + (state.trow1 !== "idle" ? ` is-${state.trow1}` : "")}>
                  <span className="gm-mock-avatar" />
                  <span className="gm-mock-rowtext">
                    <b>Late parcel · order #4821</b>
                    <i>Any update on my order?</i>
                  </span>
                  <span className="gm-mock-time">2h</span>
                </div>
                <div className="gm-mock-trow">
                  <span className="gm-mock-avatar" />
                  <span className="gm-mock-rowtext">
                    <b>Refund request</b>
                    <i>Card arrived with a bent corner</i>
                  </span>
                  <span className="gm-mock-time">1d</span>
                </div>
              </div>
            </div>

            <div className={cls("gm-mock-screen", state.screen === 4)}>
              <div className="gm-mock-panehead">
                <b>Late parcel · order #4821</b>
                <span className="gm-mock-recchip gm-mock-recchip--open">Open</span>
              </div>

              <div className="gm-mock-chat">
                <span className="gm-mock-bubble gm-mock-bubble--them">Any update on my order?</span>
                <span className="gm-mock-bubble gm-mock-bubble--us">Checking with the courier now.</span>
                <span className={cls("gm-mock-bubble gm-mock-bubble--us gm-mock-bubble--new", state.sent)}>
                  Refund issued — sorry for the wait.
                </span>
              </div>

              <div className="gm-mock-chatbox">
                <span className={"gm-mock-chatinput" + (state.pressed === "chatinput" ? " is-pressed" : "")}>
                  <span className={cls("gm-mock-chattype", state.typed)}>Refund issued — sorry for the wait.</span>
                </span>
                <span className={"gm-mock-send" + (state.pressed === "chatsend" ? " is-pressed" : "")}>➤</span>
              </div>
            </div>

            {/* The "next page" card: named on arrival, described in a line
                under it, and left the same way it is reached in the console
                itself — a click, here on its own centre button rather than
                on a rail icon. Both kinds stay mounted and crossfade on
                `state.intro`, the same idiom the four real screens above use,
                rather than mounting on demand and losing the transition. */}
            {(["dashboard", "support", "verification"] as const).map((kind) => (
              <div key={kind} className={cls("gm-mock-intro", state.intro === kind)}>
                <span className="gm-mock-introicon">
                  <RailIcon kind={kind} />
                </span>
                <b className="gm-mock-introhead">{INTRO[kind].heading}</b>
                <p className="gm-mock-introsub">{INTRO[kind].sub}</p>
                <span className={"gm-mock-introbtn" + (state.pressed === "introgo" ? " is-pressed" : "")}>
                  See it →
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Position and pulse are two different CSS properties on purpose,
            not one `transform` doing both. The ring is a click mark, not a
            second cursor — it is only ever meant to appear exactly where
            `state.cursor` has already arrived, which itself glided there
            over its own separate 0.6s beat before the click step runs. A
            `transform: translate(...) scale(...)` shorthand transitions the
            whole thing together, so turning it on at a new spot made it
            glide there too, in full view, arriving through whatever
            coordinates were between its last position and this one — the
            ring intended for the "See it" button read, for a few hundred
            ms, as a ring off to one side of it. `translate` as its own
            CSS property (not the `transform` function) jumps straight
            there; only `scale`, in `transform`, and `opacity` are left to
            animate, for the pulse itself. */}
        <span
          className={cls("gm-cursor-ring", state.ring.on)}
          style={{
            translate: `${state.ring.x}px ${state.ring.y}px`,
            transform: `scale(${state.ring.on ? 0.8 : 1.7})`,
          }}
        />
        <span className="gm-cursor" style={{ transform: `translate(${state.cursor.x}px, ${state.cursor.y}px)` }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path
              d="M5 3 L5 19.5 L9.4 15.3 L12.6 21.6 L15.9 20 L12.8 13.8 L19 13.6 Z"
              fill="#fff"
              stroke="#182430"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <div className="gm-mock-pager">
        {CRUMBS.map((c, i) => (
          <span key={c} className={cls("gm-mock-pager-dot", crumbIndex === i)} />
        ))}
      </div>
    </div>
  );
}

function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailBox = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Already signed in and back on this page: nothing to do here.
    if (sessionActive()) router.replace(next || "/admin");
    else emailBox.current?.focus();
  }, [router, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      /* A full navigation rather than a push: every provider above this page
         read "signed out" when it mounted, and a client-side route change
         would leave them holding that answer. */
      window.location.href = next || "/admin";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="gm-login">
      {/* One card, two halves: the form on the left because that is the job,
          and the brand panel inset on the right rather than bled to the edge.
          A full-height dark column reads as a splash screen the form is stuck
          to the side of; an inset panel reads as one considered object. */}
      <div className="gm-login-shell">
        <form className="gm-login-card" onSubmit={submit} noValidate>
          {/* The gradient wash fills the whole panel above; this inner column
              keeps the fields themselves at a fixed, centred width rather
              than stretching an input to the panel's full breadth. */}
          <div className="gm-login-cardin">
          <div className="gm-login-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gm-login-mark gm-mark-light" src="/brand/mark.svg" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gm-login-mark gm-mark-dark" src="/brand/mark-onnavy.svg" alt="" />
            <span className="gm-login-brand-name">Grail Market</span>
          </div>

          <div className="gm-login-head">
            <h1>Welcome back</h1>
            <p>Sign in to the GrailMarket console.</p>
          </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-login-email">
            Your email
          </label>
          <input
            id="gm-login-email"
            ref={emailBox}
            className="gm-input"
            type="email"
            autoComplete="username"
            spellCheck={false}
            placeholder="enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-login-password">
            Password
          </label>
          <div className="gm-login-secret">
            <input
              id="gm-login-password"
              className="gm-input"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              placeholder="enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* Shown rather than hidden by default: a typo in a field you
                cannot read is the most common reason a correct password is
                reported as wrong. */}
            <button
              type="button"
              className="gm-login-reveal"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide the password" : "Show the password"}
              title={reveal ? "Hide the password" : "Show the password"}
            >
              {reveal ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          <a className="gm-login-forgot" href="/admin/login">
            forgot your password?
          </a>
        </div>

        {/* The refusal, in the operator's words rather than a status code.
            "Real account, no console role" and "wrong password" are different
            problems with different next steps. */}
        {error ? (
          <p className="gm-login-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="gm-btn gm-btn--primary gm-btn--block gm-login-go"
          disabled={busy || !email.trim() || !password}
        >
          {busy ? "Signing in…" : "Log in"}
        </button>

          <p className="gm-login-foot">
            Console accounts are created by an owner — ask them for access.
          </p>
          </div>
        </form>

        {/* The brand half. No stock illustration and no invented dashboard —
            the console itself doing the talking, full height, and the pager
            underneath it. The mark and the "Grail Market" name are both on
            the form side now, so this side carries no logo of its own —
            just the window, padded off the panel's own edge, and the dots
            below it. */}
        <aside className="gm-login-aside" aria-hidden="true">
          <LoginMock />
        </aside>
      </div>
    </div>
  );
}

/* `useSearchParams` opts its subtree out of the static shell, so it gets a
   boundary of its own rather than the whole route being client-rendered. */
export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
