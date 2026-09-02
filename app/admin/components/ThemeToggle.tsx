"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./icons";

type Theme = "light" | "dark";

/**
 * Reads and writes `data-gm-theme` on <html> — the same attribute the inline
 * boot script in the admin layout sets before first paint, so the toggle and
 * the no-flash path agree on one source of truth.
 *
 * Two shapes for the two states of the sidebar: a switch at the foot of the
 * open panel, where there is room for it to read as a setting, and a single
 * round button on the closed rail, where there is not.
 *
 * Mounts unset and syncs in an effect: the server has no way to know which
 * theme is stored, so rendering a guess here would mismatch on hydration.
 */
export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.gmTheme;
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  const dark = theme === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.gmTheme = next;
    try {
      localStorage.setItem("gm-admin-theme", next);
    } catch {
      /* private mode, or storage disabled — the theme still applies for this page */
    }
  }

  const label = theme === null ? "Colour theme" : dark ? "Switch to light" : "Switch to dark";

  if (compact) {
    return (
      <button
        type="button"
        className="gm-rail-item gm-rail-theme"
        onClick={toggle}
        aria-label={label}
        title={label}
      >
        {dark ? <IconMoon /> : <IconSun />}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`gm-themeswitch${dark ? " is-dark" : ""}`}
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={label}
    >
      <span className="gm-themeswitch-track">
        <IconSun />
        <IconMoon />
        <span className="gm-themeswitch-knob" />
      </span>
    </button>
  );
}
