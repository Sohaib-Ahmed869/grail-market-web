"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { operator } from "../lib/data";
import { IconLogout, IconSettings } from "./icons";

/**
 * The signed-in operator, as an avatar in the topbar with a menu under it.
 *
 * This replaced the name-and-role card that used to sit at the foot of the
 * sidebar: the identity is the same, but it costs a 40px circle instead of a
 * permanently parked block, and the two actions it carried are one click away
 * rather than one of them being a bare icon with no label.
 */
export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  /* close on a click outside, and on Escape — a menu that only closes by
     re-clicking the button strands anyone who opened it by accident */
  useEffect(() => {
    if (!open) return;

    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="gm-account" ref={wrap}>
      <button
        type="button"
        className={`gm-account-btn${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account — ${operator.name}`}
        title={operator.name}
      >
        <span className="gm-account-av">{operator.initials}</span>
      </button>

      {open ? (
        <div className="gm-menu gm-account-menu" role="menu">
          <div className="gm-menu-head">
            <span className="gm-account-av gm-account-av--lg">{operator.initials}</span>
            <div className="gm-menu-head-meta">
              <b>{operator.name}</b>
              <span>{operator.email}</span>
            </div>
          </div>

          <div className="gm-menu-sep" />

          <Link
            href="/admin/settings"
            className="gm-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <IconSettings />
            Settings
          </Link>

          <button
            type="button"
            className="gm-menu-item gm-menu-item--danger"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <IconLogout />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
