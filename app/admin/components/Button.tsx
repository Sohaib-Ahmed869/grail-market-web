"use client";

/**
 * The one button every control in the console is built from.
 *
 * Every `<button className="gm-btn ...">` in the console already draws from
 * the same CSS — one control height, one radius, primary/secondary/danger —
 * so this changes nothing about how a button looks. What it buys is one
 * place the class list is spelled, so "primary and small" cannot drift into
 * `gm-btn--primary gm-btn--sm` on one page and `gm-btn--sm gm-btn--primary`
 * misspelled as `gm-btn-sm` on another. See the BUTTONS block in admin.css
 * for what each variant actually draws, and `.gm-btn--gold` in particular —
 * a third decision reads as the secondary ring, on purpose, so `tone="gold"`
 * here is a label for what the button means rather than a style of its own.
 *
 * `Link`-as-button (a navigation styled to match, not an action) is left
 * alone: it already takes the same class names directly, which is what
 * keeps a "Manage access" link and a "Save" button the same family of
 * control on the page without this file knowing about routing at all.
 */

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost-icon";
export type ButtonSize = "md" | "sm";
export type ButtonTone = "gold";

export function buttonClass(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
  block?: boolean;
  tone?: ButtonTone;
  withdraw?: boolean;
  className?: string;
} = {}): string {
  const {
    variant = "secondary",
    size = "md",
    icon = false,
    block = false,
    tone,
    withdraw = false,
    className = "",
  } = opts;

  const parts = ["gm-btn"];
  if (variant === "primary") parts.push("gm-btn--primary");
  if (variant === "danger") parts.push("gm-btn--danger");
  if (variant === "ghost-icon") parts.push("gm-btn--ghost", "gm-btn--icon");
  // Withdraw rides on `--danger` (the ring, the tinted hover) and changes only
  // the word's colour back to ink — see the comment by `.gm-btn--withdraw`.
  if (withdraw) parts.push("gm-btn--danger", "gm-btn--withdraw");
  if (size === "sm") parts.push("gm-btn--sm");
  if (icon) parts.push("gm-btn--icon");
  if (block) parts.push("gm-btn--block");
  if (tone === "gold") parts.push("gm-btn--gold");
  if (className) parts.push(className);
  return parts.join(" ");
}

export const Button = forwardRef<
  HTMLButtonElement,
  {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Icon-only: square, no label, `aria-label`/`title` still required by the caller. */
    icon?: boolean;
    /** Fills its container — the login page's own "Log in". */
    block?: boolean;
    tone?: ButtonTone;
    /** The one Withdraw-specific tweak on top of `variant="danger"`. */
    withdraw?: boolean;
    className?: string;
    children?: ReactNode;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">
    & { type?: ButtonHTMLAttributes<HTMLButtonElement>["type"] }
>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon = false,
    block = false,
    tone,
    withdraw = false,
    className = "",
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, icon, block, tone, withdraw, className })}
      {...rest}
    >
      {children}
    </button>
  );
});
