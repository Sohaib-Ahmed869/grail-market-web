/**
 * A small hand-rolled icon set. Stroke icons on a 24-box, sized and coloured by
 * the CSS around them (`width`/`height`/`color` are inherited), so nothing here
 * needs a prop to fit in — and there is no icon dependency to install.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Ico({ children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---- navigation ---------------------------------------------------------- */

export const IconDashboard = (p: P) => (
  <Ico {...p}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" />
    <rect x="3" y="14.5" width="7.5" height="6.5" rx="2" />
    <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" />
  </Ico>
);

export const IconShield = (p: P) => (
  <Ico {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6l-7-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Ico>
);

export const IconQueue = (p: P) => (
  <Ico {...p}>
    <rect x="3" y="4" width="18" height="5" rx="1.6" />
    <rect x="3" y="12.5" width="12" height="5" rx="1.6" />
    <path d="M18 15h3M19.5 13.5v3" />
  </Ico>
);

/* Scales, drawn the way the reference draws them: a knob at the pivot, a
   straight beam, and pans that are dishes rather than triangles.

   The handshake underneath them in that drawing is not here. It was tried
   twice — once whole, once reduced to a single zigzag bar — and at the 14px
   this renders at in the nav it is a smudge under the scales rather than two
   hands. What survives is the half that carries the meaning: a case closes on
   a judgement, and the pans are what say judgement. */
export const IconScale = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="4.8" r="1.5" />
    <path d="M12 6.3v13.4M8.2 20.9h7.6M4.4 7.6h15.2" />
    <path d="M2 12.2h4.8a2.4 2.4 0 0 1-4.8 0ZM17.2 12.2H22a2.4 2.4 0 0 1-4.8 0Z" />
    <path d="M4.4 7.6v4.6M19.6 7.6v4.6" />
  </Ico>
);

export const IconUsers = (p: P) => (
  <Ico {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20a6.4 6.4 0 0 1 12.4 0" />
    <path d="M16 5.3a3.4 3.4 0 0 1 0 6.4M17.6 14.4A6.4 6.4 0 0 1 21.2 20" />
  </Ico>
);

/* A dashboard, not a document.

   It was a page with a folded corner and three bars on it — the icon for a
   file that happens to contain a report. The page this opens is not a
   document; it is a wall of live figures, and the frame around the charts is
   what says so.

   The drawing this is taken from also carries a pie overlapping the frame's
   corner and a list of lines beside the chart. Both were tried and both are
   lost at 14px: a five-pixel pie against a five-pixel corner is one blot. The
   line and the bars survive because they are strokes rather than shapes. */
export const IconReport = (p: P) => (
  <Ico {...p}>
    <rect x="2.6" y="4.4" width="18.8" height="15.2" rx="2.2" />
    <path d="M6.2 12.6 9.4 9.8l2.6 2.2 3.6-3.6" />
    <path d="M7.4 16.6v-1.4M11 16.6v-3.2M14.6 16.6v-2.2M18.2 16.6v-4.4" />
  </Ico>
);

/* A headset, not a speech bubble.

   Support is a desk somebody sits at with a first-reply clock running, and a
   bubble is what every other messaging surface in this console already uses —
   the case thread, the member composer, the ticket reply. The headset says
   which of those is the one with a person on the end of it.

   Five shapes, which is the most this set can carry at 15px: the band, an ear
   cup each side, the boom, and the mic. The cups are pill-shaped rather than
   rectangles because at two and a half pixels wide a rounded rectangle and a
   pill are the same drawing, and the pill has two fewer corners to blur. */
export const IconSupport = (p: P) => (
  <Ico {...p}>
    <path d="M4.6 12.6v-1.4a7.4 7.4 0 0 1 14.8 0v1.4" />
    <rect x="2.8" y="11.8" width="4" height="5.8" rx="2" />
    <rect x="17.2" y="11.8" width="4" height="5.8" rx="2" />
    <path d="M19.2 17.6v.3a3.2 3.2 0 0 1-3.2 3.2h-1.5" />
    <circle cx="12.6" cy="21.1" r="1.7" />
  </Ico>
);

export const IconSettings = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 14a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 3.6a1.7 1.7 0 0 0 1-1.55V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Ico>
);

export const IconListing = (p: P) => (
  <Ico {...p}>
    <rect x="3" y="3.5" width="7" height="9" rx="1.6" />
    <rect x="3" y="15.5" width="7" height="5" rx="1.6" />
    <path d="M13 5.5h8M13 9h6M13 16h8M13 19.5h5" />
  </Ico>
);

/* ---- actions & meta ------------------------------------------------------ */

export const IconSearch = (p: P) => (
  <Ico {...p}>
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="m20 20-4.4-4.4" />
  </Ico>
);

export const IconBell = (p: P) => (
  <Ico {...p}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5Z" />
    <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
  </Ico>
);

export const IconCheck = (p: P) => (
  <Ico {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Ico>
);

export const IconCheckCircle = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.2 12.2 2.6 2.6 5-5.4" />
  </Ico>
);

export const IconX = (p: P) => (
  <Ico {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Ico>
);

export const IconXCircle = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Ico>
);

export const IconAlert = (p: P) => (
  <Ico {...p}>
    <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20.2h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </Ico>
);

export const IconInfo = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.8h.01" />
  </Ico>
);

export const IconClock = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2V12l3.2 1.9" />
  </Ico>
);

export const IconEye = (p: P) => (
  <Ico {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Ico>
);

/* The eye, struck through. Its own icon rather than the open eye rotated or
   dimmed, because "hidden" has to read at 15px without the reader comparing
   it to the other state. */
export const IconEyeOff = (p: P) => (
  <Ico {...p}>
    <path d="M10.7 6.1A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.7 3.4" />
    <path d="M6.4 7.7A17 17 0 0 0 2.5 12S6 18 12 18a9.6 9.6 0 0 0 4-.85" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3.5 3.5 20.5 20.5" />
  </Ico>
);

export const IconBan = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </Ico>
);

export const IconArrowUp = (p: P) => (
  <Ico {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Ico>
);

export const IconArrowDown = (p: P) => (
  <Ico {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Ico>
);

export const IconArrowLeft = (p: P) => (
  <Ico {...p}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </Ico>
);

export const IconArrowRight = (p: P) => (
  <Ico {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Ico>
);

export const IconChevronDown = (p: P) => (
  <Ico {...p}>
    <path d="m6 9 6 6 6-6" />
  </Ico>
);

export const IconDownload = (p: P) => (
  <Ico {...p}>
    <path d="M12 3.5v11M8 11l4 4 4-4" />
    <path d="M4.5 17.5v1.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5" />
  </Ico>
);

export const IconFilter = (p: P) => (
  <Ico {...p}>
    <path d="M3.5 5.5h17l-6.6 7.6v5.2l-3.8 2v-7.2L3.5 5.5Z" />
  </Ico>
);

export const IconRefresh = (p: P) => (
  <Ico {...p}>
    <path d="M20 11.5a8 8 0 1 0-.9 4.6" />
    <path d="M20.5 5.5V11h-5.4" />
  </Ico>
);

export const IconDollar = (p: P) => (
  <Ico {...p}>
    <path d="M12 2.8v18.4" />
    <path d="M16.4 6.6H10a3.1 3.1 0 0 0 0 6.2h4a3.1 3.1 0 0 1 0 6.2H7" />
  </Ico>
);

export const IconTrend = (p: P) => (
  <Ico {...p}>
    <path d="m3.5 16.5 5-5.5 4 3.5 7-8" />
    <path d="M15 6.5h5v5" />
  </Ico>
);

export const IconLock = (p: P) => (
  <Ico {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
  </Ico>
);

export const IconKey = (p: P) => (
  <Ico {...p}>
    <circle cx="8" cy="8" r="4.2" />
    <path d="m11.2 11.2 8 8M17 17l2-2M14.2 14.2l2-2" />
  </Ico>
);

export const IconMail = (p: P) => (
  <Ico {...p}>
    <rect x="2.8" y="5" width="18.4" height="14" rx="2.4" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Ico>
);

export const IconSend = (p: P) => (
  <Ico {...p}>
    <path d="M20.5 3.5 10.5 13.5" />
    <path d="M20.5 3.5 14.2 20.5l-3.7-7-7-3.7 17-6.3Z" />
  </Ico>
);

export const IconInbox = (p: P) => (
  <Ico {...p}>
    <path d="M3 13.5h4.5l1.5 3h6l1.5-3H21" />
    <path d="M5.4 4.5h13.2l2.4 9v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.4-9Z" />
  </Ico>
);

export const IconFlag = (p: P) => (
  <Ico {...p}>
    <path d="M5 21V4.5M5 4.5h11l-1.8 3.6L16 12H5" />
  </Ico>
);

export const IconCard = (p: P) => (
  <Ico {...p}>
    <rect x="4.5" y="2.8" width="15" height="18.4" rx="2.4" />
    <path d="M8.5 7.5h7M8.5 11h4" />
    <circle cx="14.5" cy="15.5" r="2.2" />
  </Ico>
);

export const IconPackage = (p: P) => (
  <Ico {...p}>
    <path d="M20.5 7.8v8.4a1.6 1.6 0 0 1-.85 1.42l-6.9 3.7a1.6 1.6 0 0 1-1.5 0l-6.9-3.7A1.6 1.6 0 0 1 3.5 16.2V7.8a1.6 1.6 0 0 1 .85-1.42l6.9-3.6a1.6 1.6 0 0 1 1.5 0l6.9 3.6A1.6 1.6 0 0 1 20.5 7.8Z" />
    <path d="m3.9 6.9 8.1 4.3 8.1-4.3M12 21v-9.8" />
  </Ico>
);

export const IconStar = (p: P) => (
  <Ico {...p}>
    <path d="m12 3.5 2.7 5.5 6 .9-4.35 4.25 1.03 6L12 17.3l-5.38 2.85 1.03-6L3.3 9.9l6-.9L12 3.5Z" />
  </Ico>
);

export const IconMessage = (p: P) => (
  <Ico {...p}>
    <path d="M20.5 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5V6A2.5 2.5 0 0 1 6.5 3.5H18A2.5 2.5 0 0 1 20.5 6Z" />
  </Ico>
);

/* Announcements and notifications both used the bell, and they are opposite
   directions: a notification arrives for whoever is signed in, an
   announcement is what the console broadcasts out to members.

   A horn, a handle and three rays. Not the ellipse at the bell's mouth or the
   button on the body — both are in the drawing this is taken from and both
   are lost at 15px, where the whole icon is fifteen pixels wide and every
   shape is an outline. The rays are what stop it reading as a plain cone, so
   they get the space the detail would have taken. They stop at x=21: an arc
   drawn to 25 is outside the 24-box and is simply not painted, which is how
   the first attempt at this ended up a cone with nothing beside it.

   The handle hangs BELOW the horn's lower edge rather than starting inside
   it. Drawn from y=13 it sat within the cone, and two round-capped strokes
   crossing at that size do not read as one shape behind another — they fill
   in, and the corner of the megaphone became a blot. */
export const IconMegaphone = (p: P) => (
  <Ico {...p}>
    <path d="m2.6 10.4 12.4-4.2v11.6L2.6 13.6Z" />
    <path d="M6.6 16.2v2.6a1.6 1.6 0 0 0 3.2 0v-1.6" />
    <path d="M17.6 8.4 20.3 7M18 12h2.9M17.6 15.6l2.7 1.4" />
  </Ico>
);

export const IconExternal = (p: P) => (
  <Ico {...p}>
    <path d="M13.5 4.5H19.5V10.5" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18 14.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5" />
  </Ico>
);

export const IconLogout = (p: P) => (
  <Ico {...p}>
    <path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" />
    <path d="M9.5 16 5 12l4.5-4M5 12h9.5" />
  </Ico>
);

export const IconMore = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="5.5" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="12" cy="18.5" r="1.4" />
  </Ico>
);

export const IconNote = (p: P) => (
  <Ico {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="2.2" />
    <path d="M8 8.5h8M8 12h8M8 15.5h5" />
  </Ico>
);

/* Three lines, not three outlined boxes.

   Every icon here is stroked, so a rectangle is TWO horizontal lines a couple
   of pixels apart. Three of them made twelve strokes inside a 15px square,
   which at that size stopped being rows and became a smudge. A line is one
   stroke, and three lines with five points of air between them read as rows
   at any size this console uses. */
export const IconRows = (p: P) => (
  <Ico {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Ico>
);

/* the sidebar's own collapse control: a frame with its leading column filled,
   which is the panel it hides and brings back */
export const IconPanel = (p: P) => (
  <Ico {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.6" />
    <path d="M9.5 4v16" />
    <path d="M6.2 8.6h0.6M6.2 12h0.6M6.2 15.4h0.6" />
  </Ico>
);

/* Four squares with a real gap between them, and the same size each. They
   were 8.5 and 6 tall on the two rows with 2.5 between — at 15px that gap was
   under two pixels and the four tiles ran together into a grid of mush. */
export const IconGrid = (p: P) => (
  <Ico {...p}>
    <rect x="3.8" y="3.8" width="7.4" height="7.4" rx="1.8" />
    <rect x="12.8" y="3.8" width="7.4" height="7.4" rx="1.8" />
    <rect x="3.8" y="12.8" width="7.4" height="7.4" rx="1.8" />
    <rect x="12.8" y="12.8" width="7.4" height="7.4" rx="1.8" />
  </Ico>
);

export const IconSun = (p: P) => (
  <Ico {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </Ico>
);

export const IconMoon = (p: P) => (
  <Ico {...p}>
    <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7Z" />
  </Ico>
);

export const IconTag = (p: P) => (
  <Ico {...p}>
    <path d="M11.6 3.5H20v8.4l-8.7 8.7a1.8 1.8 0 0 1-2.5 0l-5.9-5.9a1.8 1.8 0 0 1 0-2.5l8.7-8.7Z" />
    <circle cx="16.2" cy="7.8" r="1.4" />
  </Ico>
);

export const IconPin = (p: P) => (
  <Ico {...p}>
    <path d="M12 21s7-5.2 7-10.6A7 7 0 0 0 5 10.4C5 15.8 12 21 12 21Z" />
    <circle cx="12" cy="10.4" r="2.6" />
  </Ico>
);

export const IconCalendar = (p: P) => (
  <Ico {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
    <path d="M3.5 9.8h17M8.2 3.2v3.4M15.8 3.2v3.4" />
  </Ico>
);

export const IconSparkle = (p: P) => (
  <Ico {...p}>
    <path d="M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2l-1.7-5.8L4.5 10.7 10.3 9 12 3.2Z" />
    <path d="M18.8 3.2v3M20.3 4.7h-3" />
  </Ico>
);
