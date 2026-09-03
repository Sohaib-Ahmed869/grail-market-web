"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { can, ROUTE_CAPABILITY, type Capability, type Role } from "../lib/data";
import { useRole } from "./RoleContext";
import {
  IconBell,
  IconChevronDown,
  IconDashboard,
  IconFlag,
  IconKey,
  IconListing,
  IconPanel,
  IconReport,
  IconScale,
  IconShield,
  IconSupport,
  IconTag,
  IconTrend,
  IconUsers,
} from "./icons";

/**
 * One sidebar in two states, never both at once: a floating icon rail when it
 * is closed, and a single labelled column when it is open.
 *
 * Each state carries its own copy of the controls it needs — the fold button
 * above all, since a control that folds itself away leaves you with no way
 * back. What is on screen is whichever set belongs to the current state; the
 * other is hidden by CSS, keyed off the same attribute on <html> that the
 * boot script sets before first paint.
 */

type Icon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

type Page = {
  href: string;
  label: string;
  icon: Icon;
  /* The nav carried a count pill per row. It is gone: the numbers duplicated
     what each page says on arrival, went stale between loads, and turned a
     list of destinations into a scoreboard. Nothing here counts anything. */
  /**
   * Two rows can share a path and differ only by a query — one page holding
   * two directories is still two places to go. `param` is the value this row
   * stands for, and `fallback` marks the row the page falls back to when the
   * query is missing, so a bare link still lights something.
   */
  param?: { key: string; value: string };
  fallback?: boolean;
};

/**
 * A heading that is not itself a page — it only opens to show the pages under
 * it. Two queues that are worked the same way, or two kinds of case that land
 * on the same desk, belong together under one word; giving each its own
 * top-level row said they were unrelated.
 */
type Group = { key: string; label: string; icon: Icon; children: Page[] };

type Section = ({ kind: "page" } & Page) | ({ kind: "group" } & Group);

/**
 * A run of sections under a caption.
 *
 * Every block carries one, groups included: a caption is what says where a
 * row belongs, and leaving the two groups without one left them floating in
 * a gap between the captioned blocks above and below them.
 */
type Block = { caption: string; items: Section[] };

const NAV: Block[] = [
  {
    caption: "Overview",
    items: [{ kind: "page", href: "/admin", label: "Dashboard", icon: IconDashboard }],
  },
  {
    /* what has to clear a human before it can be sold */
    caption: "Marketplace",
    items: [
      /* One row, not a "Queues" group of two. Verification and the listing
         queue were the same queue seen from two pages; the group only existed
         to hold the halves side by side. */
      {
        kind: "page",
        href: "/admin/listings",
        label: "Listing queue",
        icon: IconListing,
        /* Filled in from the API at render — see `queueCount` below. NAV is a
           module constant, so a live figure cannot be baked into it. */
      },
    ],
  },
  {
    /* the people, and everything they raise */
    caption: "Community",
    items: [
      {
        kind: "group",
        key: "cases",
        label: "Cases",
        icon: IconFlag,
        children: [
          { href: "/admin/conflicts", label: "Reports & conduct", icon: IconScale },
          { href: "/admin/support", label: "Support", icon: IconSupport },
        ],
      },
      /* One page, two directories. The member record and the staff record
         are read by different people for different reasons — a moderator
         looking up a seller has no business in the scopes table — so they
         get a row each rather than a toggle you have to know about. */
      {
        kind: "group",
        key: "people",
        label: "People",
        icon: IconUsers,
        children: [
          {
            href: "/admin/members?scope=market",
            label: "Members",
            icon: IconUsers,
            param: { key: "scope", value: "market" },
          },
          {
            href: "/admin/members?scope=team",
            label: "Admin team",
            icon: IconShield,
            param: { key: "scope", value: "team" },
            fallback: true,
          },
        ],
      },
    ],
  },
  {
    caption: "Operations",
    items: [
      /* Two pages about money, read by the same person on the same day: what
         the platform charges for, and where the numbers it quotes come from.
         Given a row each they read as unrelated, which is how the price
         engine stayed invisible behind a page called "Pricing plans". */
      {
        kind: "group",
        key: "money",
        label: "Pricing",
        icon: IconTag,
        children: [
          { href: "/admin/pricing", label: "Subscriptions & boosts", icon: IconTag },
          { href: "/admin/price-engine", label: "Price engine", icon: IconTrend },
        ],
      },
      { kind: "page", href: "/admin/reports", label: "Reports", icon: IconReport },
      { kind: "page", href: "/admin/announcements", label: "Announcements", icon: IconBell },
      { kind: "page", href: "/admin/audit", label: "Audit log", icon: IconKey },
    ],
  },
];

const SECTIONS: Section[] = NAV.flatMap((b) => b.items);

/**
 * Which capability a row needs, matched the way `ROUTE_CAPABILITY` matches.
 *
 * A row nobody can open should not be in the nav at all: leaving it there and
 * letting it fail on arrival teaches an agent that half the console is broken
 * rather than that half of it is not theirs.
 */
function capabilityFor(p: Page): Capability | null {
  const path = p.href.split("?")[0];
  const hit = ROUTE_CAPABILITY.find(
    (r) =>
      r.path === path &&
      (!r.param || (p.param && p.param.key === r.param[0] && p.param.value === r.param[1]))
  );
  return hit?.cap ?? null;
}

const allowed = (role: Role, p: Page) => {
  const cap = capabilityFor(p);
  return cap === null || can(role, cap);
};

/** The nav as this role sees it. A heading with nothing under it is dropped. */
function navFor(role: Role): Block[] {
  return NAV.map((b) => ({
    ...b,
    items: b.items.flatMap<Section>((s) => {
      if (s.kind === "page") return allowed(role, s) ? [s] : [];
      const children = s.children.filter((c) => allowed(role, c));
      return children.length ? [{ ...s, children }] : [];
    }),
  })).filter((b) => b.items.length > 0);
}

/* Only real pages go on the rail — a heading has nowhere to send you. */
/** Only real pages go on the rail, and only the ones this role can open. */
const railFor = (role: Role): Page[] =>
  navFor(role)
    .flatMap((b) => b.items)
    .flatMap((s) => (s.kind === "page" ? [s] : s.children));

/**
 * Whether a row is the page you are on.
 *
 * `/admin` matches only itself; every other entry matches its subtree. A row
 * carrying a `param` has to match that too, or the two rows sharing a path
 * would both light up at once.
 */
function isActive(pathname: string, search: URLSearchParams, p: Page) {
  const path = p.href.split("?")[0];

  const onPath =
    path === "/admin"
      ? pathname === "/admin" || pathname === "/admin/"
      : pathname === path || pathname.startsWith(`${path}/`);

  if (!onPath) return false;
  if (!p.param) return true;

  const current = search.get(p.param.key);
  return current === null ? !!p.fallback : current === p.param.value;
}

export default function Sidebar() {
  const pathname = usePathname() ?? "/admin";
  const search = useSearchParams() ?? new URLSearchParams();
  const { role } = useRole();

  /* The nav this role actually has. Everything below reads these, so a row
     the role cannot open is not rendered, not merely disabled. */
  const nav = navFor(role);
  const rail = railFor(role);

  /* Which heading holds the page you are on. Seeded into the open set rather
     than applied in an effect, so the group is already open on first paint. */
  const activeGroup = SECTIONS.find(
    (s): s is { kind: "group" } & Group =>
      s.kind === "group" && s.children.some((c) => isActive(pathname, search, c))
  )?.key;

  const [open, setOpen] = useState<string[]>(() => (activeGroup ? [activeGroup] : []));

  /* Navigating into a group opens it. Closing one keeps it closed until you
     go somewhere inside it again — the user's last gesture wins. */
  useEffect(() => {
    if (activeGroup) setOpen((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);

  function toggle(key: string) {
    setOpen((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  /* Folded or not is stamped on <html>, the same way the theme is, so the
     shell's grid can react to it without the layout having to be a client
     component. The inline boot script in the layout sets it before paint. */
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    setFolded(document.documentElement.dataset.gmRail === "1");
  }, []);

  function fold(next: boolean) {
    setFolded(next);
    if (next) document.documentElement.dataset.gmRail = "1";
    else delete document.documentElement.dataset.gmRail;
    try {
      localStorage.setItem("gm-admin-rail", next ? "1" : "0");
    } catch {
      /* storage disabled — the fold still applies for this page */
    }
  }

  function pageRow(p: Page, nested?: boolean) {
    const Icon = p.icon;
    const active = isActive(pathname, search, p);
    return (
      <Link
        key={p.href}
        href={p.href}
        className={`${nested ? "gm-nav-kid" : "gm-nav-item"}${active ? " is-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <Icon />
        <span className={nested ? undefined : "gm-nav-label"}>{p.label}</span>

      </Link>
    );
  }

  return (
    <nav className="gm-side" aria-label="Admin sections">
      {/* =========================================================== closed */}
      <div className="gm-rail">
        <div className="gm-rail-inner">
          <Link href="/admin" className="gm-rail-mark" aria-label="GrailMarket admin">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gm-mark-light" src="/brand/mark.svg" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gm-mark-dark" src="/brand/mark-onnavy.svg" alt="" />
          </Link>

          <button
            type="button"
            className="gm-rail-fold"
            onClick={() => fold(false)}
            aria-label="Open the sidebar"
            aria-expanded={false}
            title="Open the sidebar"
          >
            <IconPanel />
          </button>

          <span className="gm-rail-div" aria-hidden="true" />

          <div className="gm-rail-items">
            {rail.map((p) => {
              const Icon = p.icon;
              const active = isActive(pathname, search, p);
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className={`gm-rail-item${active ? " is-active" : ""}`}
                  aria-label={p.label}
                  aria-current={active ? "page" : undefined}
                  title={p.label}
                >
                  <Icon />

                </Link>
              );
            })}
          </div>

          {/* A 74px decorative rule used to sit here, between the nav and the
              theme toggle. On a short window it was the difference between
              the last nav row being reachable and being scrolled out of
              sight — a divider that hid a destination. */}
          {/* Settings is not here, and not in the panel either: it opens from
              the avatar menu in the topbar, which is on screen in both states. */}
          <ThemeToggle compact />
        </div>
      </div>

      {/* ============================================================= open */}
      <div className="gm-panel">
        <div className="gm-panel-head">
          <Link href="/admin" className="gm-rail-mark" aria-label="GrailMarket admin">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gm-mark-light" src="/brand/mark.svg" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gm-mark-dark" src="/brand/mark-onnavy.svg" alt="" />
          </Link>

          <div className="gm-panel-brand">
            <b>GrailMarket</b>
            <span>Admin console</span>
          </div>

          <button
            type="button"
            className="gm-rail-fold"
            onClick={() => fold(true)}
            aria-label="Close the sidebar"
            aria-expanded={true}
            title="Close the sidebar"
          >
            <IconPanel />
          </button>
        </div>

        <div className="gm-panel-nav">
          {nav.map((block) => (
            <div key={block.caption} className="gm-nav-block">
              <div className="gm-nav-grouphead">{block.caption}</div>

              {block.items.map((s) => {
                if (s.kind === "page") return pageRow(s);

                const Icon = s.icon;
                const isOpen = open.includes(s.key);
                const holdsCurrent = s.children.some((c) => isActive(pathname, search, c));

                return (
                  <div key={s.key}>
                    <button
                      type="button"
                      className={`gm-nav-item gm-nav-item--group${
                        holdsCurrent ? " is-active" : ""
                      }${isOpen ? " is-open" : ""}`}
                      onClick={() => toggle(s.key)}
                      aria-expanded={isOpen}
                      aria-controls={`gm-group-${s.key}`}
                    >
                      <Icon />
                      <span className="gm-nav-label">{s.label}</span>
                      <IconChevronDown className="gm-nav-caret" />
                    </button>

                    {isOpen ? (
                      <div className="gm-nav-kids" id={`gm-group-${s.key}`}>
                        {s.children.map((c) => pageRow(c, true))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="gm-panel-foot">
          <span>Appearance</span>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
