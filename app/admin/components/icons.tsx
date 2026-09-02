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

export const IconScale = (p: P) => (
  <Ico {...p}>
    <path d="M12 3v18M7 21h10M4.5 8h15M8.5 6.8 12 4l3.5 2.8" />
    <path d="M4.5 8 2 14a3 3 0 0 0 5 0L4.5 8ZM19.5 8 17 14a3 3 0 0 0 5 0L19.5 8Z" />
  </Ico>
);

export const IconUsers = (p: P) => (
  <Ico {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20a6.4 6.4 0 0 1 12.4 0" />
    <path d="M16 5.3a3.4 3.4 0 0 1 0 6.4M17.6 14.4A6.4 6.4 0 0 1 21.2 20" />
  </Ico>
);

export const IconReport = (p: P) => (
  <Ico {...p}>
    <path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 17v-3M12 17v-6M15.5 17v-4" />
  </Ico>
);

export const IconSupport = (p: P) => (
  <Ico {...p}>
    <path d="M21 15.5a3 3 0 0 1-3 3h-3.2L12 21.5V18.5H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />
    <path d="M9.6 9.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.8-.9 1.4v.3" />
    <path d="M12 16.2h.01" />
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

export const IconRows = (p: P) => (
  <Ico {...p}>
    <rect x="3" y="4.5" width="18" height="4.2" rx="1.4" />
    <rect x="3" y="10.9" width="18" height="4.2" rx="1.4" />
    <rect x="3" y="17.3" width="18" height="2.2" rx="1.1" />
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

export const IconGrid = (p: P) => (
  <Ico {...p}>
    <rect x="3.5" y="3.5" width="7" height="8.5" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="8.5" rx="1.5" />
    <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
    <rect x="13.5" y="14.5" width="7" height="6" rx="1.5" />
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
