"use client";

import AccountMenu from "./AccountMenu";
import { IconBell, IconSearch, IconExternal } from "./icons";

/**
 * Search on the left, the operator's controls on the right.
 *
 * No page title lives here any more. Every page already opens with its own
 * heading — the topbar copy only repeated it, and on the dashboard it put the
 * word "Dashboard" directly above a greeting that says the same thing. The
 * theme switch moved to the sidebar header, where it reads as a setting
 * rather than as one more control in the action cluster.
 */
export default function Topbar() {
  return (
    <header className="gm-top">
      <div className="gm-search">
        <IconSearch />
        <input
          type="search"
          placeholder="Search members, listings, cases…"
          aria-label="Search the admin console"
        />
      </div>

      <div className="gm-top-actions">
        <a
          className="gm-iconbtn"
          href="/"
          target="_blank"
          rel="noreferrer"
          aria-label="Open the public marketplace in a new tab"
          title="Public site"
        >
          <IconExternal />
        </a>

        <button
          type="button"
          className="gm-iconbtn gm-iconbtn--dot"
          aria-label="Notifications — 3 unread"
          title="Notifications"
        >
          <IconBell />
        </button>

        <AccountMenu />
      </div>
    </header>
  );
}
