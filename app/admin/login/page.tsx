"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ApiError, sessionActive, signIn } from "../lib/api";
import { IconEye, IconEyeOff, IconLock } from "../components/icons";

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
      <form className="gm-login-card" onSubmit={submit} noValidate>
        <div className="gm-login-brand">
          <span className="gm-login-mark" aria-hidden="true">
            <IconLock />
          </span>
          <div>
            <b>Grail Market</b>
            <span>Admin console</span>
          </div>
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
          Console accounts are created by an owner. Ask them for access rather
          than signing up.
        </p>
      </form>
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
