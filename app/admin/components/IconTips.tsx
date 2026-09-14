"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { OverlayPortal, localRect, localViewport } from "./ui";

/**
 * The word on a button that has no word on it.
 *
 * A row's actions are icon buttons, and each carries its word twice: in
 * `aria-label` for a screen reader and in `title` for everyone else. `title`
 * on its own is the browser's tooltip — a second of nothing, then a small
 * grey box — and it was asked for as "not easily visible, it should be
 * highlighted, since there is no text on the button to say what it is for".
 *
 * So one listener for the whole console rather than a wrapper round every
 * button: the markup keeps writing `title`, which keeps working with this
 * switched off, and on hover or keyboard focus the word is lifted out of
 * `title` (so the browser's box does not arrive a second later on top of
 * this one) and drawn at once as `.gm-tip`. `data-tip` does the same for
 * anything that is not an icon button and wants it.
 *
 * Touch is ignored: a tap is a press, and a tip that appears as the finger
 * lands is covered by the finger.
 */

/* `.gm-rowmenu-btn` is the "⋮" that opens `RowMenu` — as wordless as an
   icon button, and it carries its label in `title` the same way. */
const TARGET = [
  ".gm-btn--icon[title]",
  ".gm-rowmenu-btn[title]",
  "[data-tip]",
].join(", ");

type Tip = { text: string; x: number; y: number; below: boolean };

export default function IconTips() {
  const [tip, setTip] = useState<Tip | null>(null);
  /* How far the box has to move off the button's own centre to stay on
     screen — see the layout effect below. The arrow stays put relative to
     the button (it is what a viewer's eye is following), and only the box
     slides out from under it. */
  const [shift, setShift] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  /* A short label centred on a small icon button fits inside the window
     almost everywhere it is asked to; "Accepted grading companies" beside a
     button sitting at the page's own right edge did not; `white-space:
     nowrap` on `.gm-tip` means it never wraps to find out, it just runs off
     the edge. So this measures the box the moment it has a size (which
     `x`/`y` alone cannot predict — text width is not known until it is laid
     out) and, only if it would cross the window's edge, nudges the box back
     in — the arrow keeps pointing at the button either way, see `.gm-tip`'s
     `left: calc(50% - <shift>px)` on `::after`. */
  useLayoutEffect(() => {
    if (!tip || !boxRef.current) {
      setShift(0);
      return;
    }
    /* The box's width only — never its measured left/right, which would
       already carry whatever shift the last tip left behind and so measure
       the wrong thing. Working out the *unshifted* edges from the anchor
       itself and the width is what keeps this correct however it got here. */
    const width = localRect(boxRef.current).width;
    const vp = localViewport();
    const margin = 10;
    const naiveLeft = tip.x - width / 2;
    const naiveRight = tip.x + width / 2;
    if (naiveLeft < margin) setShift(margin - naiveLeft);
    else if (naiveRight > vp.w - margin) setShift(vp.w - margin - naiveRight);
    else setShift(0);
  }, [tip]);

  useEffect(() => {
    let current: HTMLElement | null = null;

    function targetOf(node: EventTarget | null): HTMLElement | null {
      return node instanceof Element ? node.closest<HTMLElement>(TARGET) : null;
    }

    function show(el: HTMLElement) {
      const title = el.getAttribute("title");
      if (title) {
        el.dataset.tip = title;
        el.removeAttribute("title");
      }
      const text = el.dataset.tip;
      if (!text) return;
      /* Local pixels, not visual ones — see `uiScale`. Above the button
         unless that would put it under the topbar's edge of the window. The
         true centre of the button, unclamped — the layout effect above is
         what keeps the box itself on screen without moving the arrow off
         the button it is naming. */
      const r = localRect(el);
      const below = r.top < 56;
      current = el;
      setTip({
        text,
        x: r.left + r.width / 2,
        y: below ? r.bottom : r.top,
        below,
      });
    }

    function hide() {
      if (!current) return;
      current = null;
      setTip(null);
    }

    function onOver(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      const el = targetOf(e.target);
      if (el === current) return;
      if (el) show(el);
      else hide();
    }

    function onFocus(e: FocusEvent) {
      const el = targetOf(e.target);
      if (el && el.matches(":focus-visible")) show(el);
    }

    /* A press ends it: the button is about to do something — open a record,
       withdraw a row — and the tip would outlive the row it named. */
    const root = document.documentElement;
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    root.addEventListener("pointerleave", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      root.removeEventListener("pointerleave", hide);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  return (
    <OverlayPortal>
      {tip ? (
        /* Hidden from assistive tech: the button's `aria-label` already
           names it, and a second announcement of the same word is noise. */
        <div
          ref={boxRef}
          aria-hidden="true"
          className={`gm-tip${tip.below ? " gm-tip--below" : ""}`}
          style={
            {
              left: tip.x + shift,
              top: tip.y,
              "--tip-shift": `${shift}px`,
            } as React.CSSProperties
          }
        >
          {tip.text}
        </div>
      ) : null}
    </OverlayPortal>
  );
}
