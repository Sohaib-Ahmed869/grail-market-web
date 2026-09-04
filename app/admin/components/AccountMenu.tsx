"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { roleLabel, ROLES } from "../lib/data";
import { useRole } from "./RoleContext";
import { IconLogout, IconSettings, IconUsers } from "./icons";

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
  const { role, me, previewing, setPreview, signOut, loading } = useRole();

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

          {/* Preview another role.

              Not a permission, and not a way to gain one: the API answers
              every request from the role on the operator's own user row, so
              this only ever changes what the console draws. Offered to owners
              alone, because for anyone else "view as" can only mean seeing
              less than they already see. */}
          {ownRole === "owner" ? (
          <div style={{ padding: "8px 12px 4px" }}>
            <div className="gm-label" style={{ marginBottom: 6 }}>
              View the console as
            </div>
            <div style={{ display: "grid", gap: 3 }}>
              {ROLES.map((r) => {
                const on = role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => setPreview(r.key === ownRole ? null : r.key)}
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      borderRadius: "var(--r-sm)",
                      cursor: "pointer",
                      font: "inherit",
                      fontSize: 12.5,
                      background: on ? "var(--surface-2)" : "transparent",
                      color: on ? "var(--ink)" : "var(--ink-3)",
                      border: `1px solid ${on ? "var(--line)" : "transparent"}`,
                    }}
                  >
                    <b style={{ fontWeight: on ? 600 : 500 }}>{r.label}</b>
                    <div className="gm-tiny gm-dim">{r.who}</div>
                  </button>
                );
              })}
            </div>
            {previewing ? (
              <button
                type="button"
                className="gm-btn gm-btn--sm gm-btn--ghost"
                style={{ marginTop: 7, width: "100%" }}
                onClick={() => setPreview(null)}
              >
                Back to {roleLabel(ownRole)}
              </button>
            ) : null}
          </div>
          ) : null}

          <div className="gm-menu-sep" />

          {/* Your own account first, then the marketplace's. They are
              different things and used to be one page: Settings is rules an
              owner sets for everybody, this is one person's name and
              password — and most roles cannot open Settings at all. */}
          <Link
            href="/admin/profile"
            className="gm-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <IconUsers />
            Your profile
          </Link>

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
