"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { IconBell, IconSearch, IconExternal } from "./icons";

/** Longest-prefix match, so `/admin/members/MB-1042` still reads "Members". */
const TITLES: [string, string, string][] = [
  ["/admin/verification", "Verification", "High-value and grail-tier cards held for a human decision"],
  ["/admin/listings", "Listing queue", "What has cleared verification and what is live on the market"],
  ["/admin/conflicts", "Conflict resolution", "Disputes between a buyer and a seller, and the funds held against them"],
  ["/admin/members", "Members", "Buyers, sellers and consignors — and their access to the marketplace"],
  ["/admin/pricing", "Pricing plans", "Seller plan tiers and what each one costs — synced to Stripe"],
  ["/admin/reports", "Reports", "Scheduled exports and the numbers behind the marketplace"],
  ["/admin/support", "Support", "Member tickets, in one queue"],
  ["/admin/settings", "Settings", "Thresholds, policy and the moderation team"],
  ["/admin", "Dashboard", "What needs a decision today"],
];

export default function Topbar() {
  const pathname = usePathname() ?? "/admin";
  const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`)) ?? TITLES[TITLES.length - 1];

  return (
    <header className="gm-top">
      <div className="gm-top-title">
        <h1>{hit[1]}</h1>
        <p>{hit[2]}</p>
      </div>

      <div className="gm-search">
        <IconSearch />
        <input
          type="search"
          placeholder="Search members, listings, cases…"
          aria-label="Search the admin console"
        />
      </div>

      <ThemeToggle />

      <button type="button" className="gm-btn gm-btn--icon" aria-label="Notifications" title="Notifications">
        <IconBell />
      </button>

      <a
        className="gm-btn"
        href="/"
        target="_blank"
        rel="noreferrer"
        title="Open the public marketplace in a new tab"
      >
        <IconExternal />
        Public site
      </a>
    </header>
  );
}
