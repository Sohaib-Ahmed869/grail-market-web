"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ApiError, sessionActive, signIn } from "../lib/api";
import { IconEye, IconEyeOff } from "../components/icons";

/**
 * The console's sign-in.
 *
 * There is no account creation here, deliberately. Console accounts are made
 * by an owner from the team page — "staff accounts: invite, scope, revoke" —
 * so a sign-up button on this screen would be an invitation to a door that
 * does not open. A member who signs up in the app and arrives here is told
 * their account is real and has no console role, which is the truth.
 */

function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailBox = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Already signed in and back on this page: nothing to do here.
    if (sessionActive()) router.replace(next || "/admin");
    else emailBox.current?.focus();
  }, [router, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      /* A full navigation rather than a push: every provider above this page
         read "signed out" when it mounted, and a client-side route change
         would leave them holding that answer. */
      window.location.href = next || "/admin";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="gm-login">
      {/* One card, two halves: the form on the left because that is the job,
          and the brand panel inset on the right rather than bled to the edge.
          A full-height dark column reads as a splash screen the form is stuck
          to the side of; an inset panel reads as one considered object. */}
      <div className="gm-login-shell">
        <form className="gm-login-card" onSubmit={submit} noValidate>
          <div className="gm-login-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gm-login-mark gm-mark-light" src="/brand/mark.svg" alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gm-login-mark gm-mark-dark" src="/brand/mark-onnavy.svg" alt="" />
          </div>

          <div className="gm-login-head">
            <h1>Welcome back</h1>
            <p>Sign in to the GrailMarket console.</p>
          </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-login-email">
            Your email
          </label>
          <input
            id="gm-login-email"
            ref={emailBox}
            className="gm-input"
            type="email"
            autoComplete="username"
            spellCheck={false}
            placeholder="enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-login-password">
            Password
          </label>
          <div className="gm-login-secret">
            <input
              id="gm-login-password"
              className="gm-input"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              placeholder="enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* Shown rather than hidden by default: a typo in a field you
                cannot read is the most common reason a correct password is
                reported as wrong. */}
            <button
              type="button"
              className="gm-login-reveal"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide the password" : "Show the password"}
              title={reveal ? "Hide the password" : "Show the password"}
            >
              {reveal ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          <a className="gm-login-forgot" href="/admin/login">
            forgot your password?
          </a>
        </div>

        {/* The refusal, in the operator's words rather than a status code.
            "Real account, no console role" and "wrong password" are different
            problems with different next steps. */}
        {error ? (
          <p className="gm-login-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="gm-btn gm-btn--primary gm-btn--block gm-login-go"
          disabled={busy || !email.trim() || !password}
        >
          {busy ? "Signing in…" : "Log in"}
        </button>

          <p className="gm-login-foot">
            Console accounts are created by an owner — ask them for access.
          </p>
        </form>

        {/* The brand half. No stock illustration and no invented dashboard —
            the wordmark, one sentence about what this console is, and the
            three things it actually watches over. */}
        <aside className="gm-login-aside" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gm-login-logo" src="/brand/logo-horizontal-white.svg" alt="" />
          <p className="gm-login-tag">The console behind the marketplace.</p>

          {/* A mock of THIS console, not a stock dashboard: the review queue
              as it actually looks — a slab awaiting an identity decision, a
              listing held for photos, a price we are standing behind. Built
              from divs so it stays sharp at any size and costs no image. */}
          <div className="gm-mock">
            <div className="gm-mock-bar">
              <span className="gm-mock-dot" />
              <span className="gm-mock-dot" />
              <span className="gm-mock-dot" />
              <span className="gm-mock-pill" />
            </div>

            <div className="gm-mock-body">
              <div className="gm-mock-stats">
                <div className="gm-mock-stat">
                  <b>12</b>
                  <span>In review</span>
                </div>
                <div className="gm-mock-stat">
                  <b>3</b>
                  <span>Disputes</span>
                </div>
                <div className="gm-mock-stat gm-mock-stat--gold">
                  <b>A$1.2m</b>
                  <span>Listed value</span>
                </div>
              </div>

              <div className="gm-mock-rows">
                {[
                  { tag: "BGS 9.5", w: 62, amt: 78 },
                  { tag: "PSA 10", w: 46, amt: 62 },
                  { tag: "CGC 9", w: 71, amt: 55 },
                ].map((r) => (
                  <div className="gm-mock-row" key={r.tag}>
                    <span className="gm-mock-thumb" />
                    <span className="gm-mock-lines">
                      <i style={{ width: `${r.w}%` }} />
                      <i style={{ width: `${r.w - 22}%` }} />
                    </span>
                    <span className="gm-mock-badge">{r.tag}</span>
                    <span className="gm-mock-amt" style={{ width: `${r.amt}px` }} />
                  </div>
                ))}
              </div>

              <div className="gm-mock-chart">
                <svg viewBox="0 0 220 56" preserveAspectRatio="none">
                  <path
                    d="M0 44 L26 38 L52 41 L78 27 L104 31 L130 18 L156 22 L182 11 L220 6"
                    fill="none"
                    stroke="#cbb794"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          <p className="gm-login-note">
            Every action here is written to the audit log against your name.
          </p>
        </aside>
      </div>
    </div>
  );
}

/* `useSearchParams` opts its subtree out of the static shell, so it gets a
   boundary of its own rather than the whole route being client-rendered. */
export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
