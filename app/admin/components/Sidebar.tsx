"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./ui";
import { operator } from "../lib/data";
import {
  IconDashboard,
  IconShield,
  IconListing,
  IconScale,
  IconUsers,
  IconReport,
  IconSupport,
  IconSettings,
  IconTag,
  IconLogout,
} from "./icons";

type NavEntry = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Live work waiting on a moderator, shown as a pill on the row. */
  count?: number;
  alert?: boolean;
};

const GROUPS: { title: string; items: NavEntry[] }[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: IconDashboard }],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/admin/verification", label: "Verification", icon: IconShield, count: 18 },
      { href: "/admin/listings", label: "Listing queue", icon: IconListing, count: 4 },
      { href: "/admin/conflicts", label: "Conflicts", icon: IconScale, count: 7, alert: true },
    ],
  },
  {
    title: "Community",
    items: [
      { href: "/admin/members", label: "Members", icon: IconUsers },
      { href: "/admin/support", label: "Support", icon: IconSupport, count: 3 },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/pricing", label: "Pricing plans", icon: IconTag },
      { href: "/admin/reports", label: "Reports", icon: IconReport },
      { href: "/admin/settings", label: "Settings", icon: IconSettings },
    ],
  },
];

/** `/admin` matches only itself; every other entry matches its subtree. */
function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname() ?? "/admin";

  return (
    <nav className="gm-side" aria-label="Admin sections">
      <Link href="/admin" className="gm-brand">
        <span className="gm-brand-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gm-mark-light" src="/brand/mark.svg" alt="" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gm-mark-dark" src="/brand/mark-onnavy.svg" alt="" />
        </span>
        <span className="gm-brand-text">
          <span className="gm-brand-name">GrailMarket</span>
          <span className="gm-brand-sub">Admin console</span>
        </span>
      </Link>

      <div className="gm-nav">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="gm-nav-group">{g.title}</div>
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`gm-nav-item${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  title={it.label}
                >
                  <Icon />
                  <span className="gm-nav-label">{it.label}</span>
                  {typeof it.count === "number" ? (
                    <span className={`gm-nav-count${it.alert ? " is-alert" : ""}`}>{it.count}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="gm-side-foot">
        <div className="gm-op">
          <Avatar initials={operator.initials} />
          <div className="gm-op-meta">
            <div className="gm-op-name">{operator.name}</div>
            <div className="gm-op-role">{operator.role}</div>
          </div>
          <button
            type="button"
            className="gm-btn gm-btn--ghost gm-btn--icon gm-btn--sm"
            aria-label="Sign out"
            title="Sign out"
          >
            <IconLogout />
          </button>
        </div>
      </div>
    </nav>
  );
}
