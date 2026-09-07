"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAttention, type Attention } from "../lib/api";
import { IconBell, IconCheckCircle } from "./icons";
import { localRect, localViewport, OverlayPortal } from "./ui";

/**
 * The bell, doing something.
 *
 * It used to be an icon with `aria-label="Notifications: 3 unread"` written
 * into it and no handler at all — a control that announced a count it had
 * never counted, to a screen reader, on every page.
 *
 * What it holds is not a member's notifications. Those belong to the member.
 * It holds the work that has gone past a line somebody promised it would not:
 * listings past the review target, tickets past their first reply, cases
 * nobody has picked up, boosts charged for and never run. Every row links to
 * the page that fixes it.
 *
 * Nothing is dismissible, on purpose. There is nothing to mark as read — an
 * item leaves this list when the work behind it is done, which is the only
 * thing that should make it go away.
 */
export default function Bell() {
  const btn = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Attention[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);

  /* Re-read on a timer as well as on open: the point of the dot is that it
     appears while you are looking at something else. Ninety seconds is slow
     enough to be free and fast enough that the bell is not lying for long. */
  const read = useCallback(() => {
    fetchAttention()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    read();
    const t = setInterval(read, 90_000);
    return () => clearInterval(t);
  }, [read]);

  const place = useCallback(() => {
    const el = btn.current;
    if (!el) return;
    /* Local pixels — see `uiScale` in ui.tsx. */
    const r = localRect(el);
    const vp = localViewport();
    const w = 320;
    setBox({
      left: Math.max(8, Math.min(r.right - w, vp.w - w - 10)),
      top: r.bottom + 8,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    read();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    }
    /* Scrolls from inside the panel are its own; anything else moves it. */
    function onScroll(e: Event) {
      const t = e.target as Node | null;
      if (t && panel.current?.contains(t)) return;
      place();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place, read]);

  /* Red only for something already past its promise. A bell that goes red for
     work that is merely due is a bell people stop looking at. */
  const bad = items.some((i) => i.tone === "bad");
  const label = !loaded
    ? "Notifications"
    : items.length === 0
      ? "Notifications: nothing needs attention"
      : `Notifications: ${items.length} ${items.length === 1 ? "thing needs" : "things need"} attention`;

  return (
    <>
      <button
        type="button"
        ref={btn}
        className={`gm-iconbtn${items.length > 0 ? " gm-iconbtn--dot" : ""}${
          bad ? " is-bad" : ""
        }`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell />
      </button>

      {open && box ? (
        <OverlayPortal>
          <div
            ref={panel}
            className="gm-menu gm-bellpanel"
            role="dialog"
            aria-label="Needs attention"
            style={{ position: "fixed", left: box.left, top: box.top }}
          >
            <div className="gm-bellhead">
              <b>Needs attention</b>
              <span>Anything past a target. Nothing to dismiss: it clears itself.</span>
            </div>

            {items.length === 0 ? (
              <div className="gm-bellclear">
                <IconCheckCircle />
                <b>{loaded ? "Nothing is late" : "Reading…"}</b>
                {loaded ? <span>Every queue is inside its target.</span> : null}
              </div>
            ) : (
              <div className="gm-belllist">
                {items.map((i) => (
                  <Link
                    key={i.key}
                    href={i.href}
                    className="gm-bellrow"
                    onClick={() => setOpen(false)}
                  >
                    <span className={`gm-belldot gm-belldot--${i.tone}`} aria-hidden="true" />
                    <span>{i.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}
