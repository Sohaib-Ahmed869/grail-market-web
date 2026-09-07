"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import "./reset.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8180";

/** Where the link in the reset email lands.
 *
 *  It is on the web rather than in the app because an email is opened wherever
 *  it is opened — often on a laptop, often by someone who has not installed
 *  anything yet. The token is single-use and expires in thirty minutes, so the
 *  only two states worth designing are "it worked" and "ask for a new one". */
function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const short = password.length > 0 && password.length < 10;
  const mismatch = again.length > 0 && again !== password;
  const ready = Boolean(token) && password.length >= 10 && again === password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}/auth/reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await r.json().catch(() => ({}));
      if (body?.error) setError(body.message ?? "That didn't work. Ask for a new link.");
      else setDone(true);
    } catch {
      setError("We couldn't reach the server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Card title="Link Not Valid" sub="That link is missing its token.">
        <div className="reset-done">
          Reset links work once and expire after 30 minutes. If you opened this from an
          older email, the <strong>newest</strong> one is the one that works — ask for a
          new link from the app.
        </div>
      </Card>
    );
  }

  if (done) {
    return (
      <Card title="Password Changed" sub="You can sign in with it now.">
        <div className="reset-done">
          <strong>All set.</strong>
          Open the GrailCard app and sign in with your new password. We&rsquo;ve emailed
          you to confirm the change — if that wasn&rsquo;t you, reset it again straight
          away.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Choose A New Password" sub="Ten characters or more.">
      <form onSubmit={submit}>
        <label className="reset-field">
          <span>New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-invalid={short}
            placeholder="At least 10 characters"
          />
        </label>
        {short && <p className="reset-error">Use at least 10 characters.</p>}

        <label className="reset-field">
          <span>Type it again</span>
          <input
            type="password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch}
            placeholder="The same password"
          />
        </label>
        {mismatch && <p className="reset-error">These don&rsquo;t match.</p>}
        {error && <p className="reset-error">{error}</p>}

        <button className="reset-btn" type="submit" disabled={!ready || busy}>
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
    </Card>
  );
}

function Card({
  title, sub, children,
}: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <main className="reset-page">
      <div className="reset-card">
        <div className="reset-brand">GrailCard</div>
        <h1>{title}</h1>
        <p className="sub">{sub}</p>
        {children}
      </div>
    </main>
  );
}

/** useSearchParams needs a Suspense boundary, or the whole route opts out of
 *  static rendering and the build says so. */
export default function ResetPage() {
  return (
    <Suspense fallback={<Card title="Reset Password" sub="One moment…"><div /></Card>}>
      <ResetForm />
    </Suspense>
  );
}
