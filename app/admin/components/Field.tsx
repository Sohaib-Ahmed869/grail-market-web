"use client";

/**
 * The console's text fields.
 *
 * `TextField` draws from `.gm-input` — the same `--control-h` (34px) and
 * `--r-sm` radius every button already uses (see admin.css's "One control
 * height... One radius scale" rule), which is what makes a field and the
 * button beside it line up rather than merely match in colour. `TextArea` is
 * the multi-line sibling and does not share the fixed height on purpose —
 * see `.gm-textarea` in admin.css, sized to its own `min-height` instead.
 *
 * Both are thin wrappers, not a new look: every existing `.gm-input`/
 * `.gm-textarea` in the console already draws from the same rule, so using
 * these changes nothing on screen. What it buys is one place the class name
 * is spelled, the same reasoning `Button.tsx` gives for itself.
 */

import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export const TextField = forwardRef<
  HTMLInputElement,
  { className?: string } & InputHTMLAttributes<HTMLInputElement>
>(function TextField({ className = "", ...rest }, ref) {
  return (
    <input ref={ref} className={className ? `gm-input ${className}` : "gm-input"} {...rest} />
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  { className?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={className ? `gm-textarea ${className}` : "gm-textarea"}
      {...rest}
    />
  );
});
