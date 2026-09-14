"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { roleLabel } from "../lib/data";
import { useRole } from "./RoleContext";
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
  const { me, previewing, setPreview, signOut, loading } = useRole();

  /* Until the sign-in screen lands, the API answers with its development
     operator; `me` is that operator either way, so the topbar shows whoever
     the server says is acting rather than a name compiled into the bundle. */
  const name = me?.name ?? (loading ? "" : "Signed out");
  const email = me?.email || (me?.devAuth ? "development operator" : "not signed in");

  /* A dash while we do not know yet, not initials.
  
     `"Signed out"` initialled to "SO", so every page load and every full
     navigation flashed an avatar that read as somebody's initials — a person
     called SO who does not exist. An em dash is unmistakably "not yet". */
  const initials =
    name.trim() === ""
      ? ""
      : (name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase();
  const ownRole = me?.role ?? null;

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

  /* The switcher was removed, so if a preview is leftover from before,
     clear it now rather than strand someone in another role. */
  useEffect(() => {
    if (previewing) {
      setPreview(null);
    }
  }, [previewing, setPreview]);

  return (
    <div className="gm-account" ref={wrap}>
      <button
        type="button"
        className={`gm-account-btn${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name}`}
        title={name}
      >
        <span className="gm-account-av">{initials}</span>
      </button>

      {open ? (
        <div className="gm-menu gm-account-menu" role="menu">
          <div className="gm-menu-head">
            <span className="gm-account-av gm-account-av--lg">{initials}</span>
            <div className="gm-menu-head-meta">
              <b>{name}</b>
              <span>
                {ownRole ? roleLabel(ownRole) : "No console role"} · {email}
              </span>
            </div>
          </div>

          <div className="gm-menu-sep" />

          {/* Preview options removed at user request for now;
              RoleContext still supports preview mode if this feature returns. */}

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
            onClick={signOut}
          >
            <IconLogout />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
