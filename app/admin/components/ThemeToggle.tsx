"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./icons";

type Theme = "light" | "dark";

/**
 * Reads and writes `data-gm-theme` on <html> — the same attribute the inline
 * boot script in the admin layout sets before first paint, so the toggle and
 * the no-flash path agree on one source of truth.
 *
 * Mounts unset and syncs in an effect: the server has no way to know which
 * theme is stored, so rendering a guess here would mismatch on hydration.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.gmTheme;
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.gmTheme = next;
    try {
      localStorage.setItem("gm-admin-theme", next);
    } catch {
      /* private mode, or storage disabled — the theme still applies for this page */
    }
  }

  return (
    <div className="gm-themetoggle" role="group" aria-label="Colour theme">
      <button
        type="button"
        className={theme === "light" ? "is-active" : ""}
        onClick={() => apply("light")}
        aria-pressed={theme === "light"}
        aria-label="Light theme"
        title="Light theme"
      >
        <IconSun />
      </button>
      <button
        type="button"
        className={theme === "dark" ? "is-active" : ""}
        onClick={() => apply("dark")}
        aria-pressed={theme === "dark"}
        aria-label="Dark theme"
        title="Dark theme"
      >
        <IconMoon />
      </button>
    </div>
  );
}
