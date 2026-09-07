import { NextResponse } from "next/server";

/**
 * Signing in to the console.
 *
 * There is no admin-only sign-in on the API: staff are members with a role, so
 * this posts to the same `/auth/login` the app uses. What it adds is the one
 * question the app never asks — does this account hold a console role — and it
 * asks it *before* handing the browser a token.
 *
 * That ordering is the point. Letting a member sign in and then watching every
 * page answer 403 is a worse experience than one honest "this account has no
 * console access", and it puts a working session token for a non-staff account
 * into the console's storage for no reason.
 *
 * This route sits beside the `[...path]` forwarder and wins for /api/admin/session
 * because a static segment beats a catch-all.
 */

const API = (process.env.GRAILMARKET_API_URL ?? "http://localhost:8180").replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid", message: "Enter an email and a password." }, { status: 400 });
  }

  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json(
      { error: "invalid", message: "Enter an email and a password." },
      { status: 400 },
    );
  }

  let signIn: Response;
  try {
    signIn = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "api-unreachable", message: `No answer from the API at ${API}. Is it running?` },
      { status: 502 },
    );
  }

  const auth = await signIn.json().catch(() => null);
  if (!auth || auth.error) {
    return NextResponse.json(
      {
        error: auth?.error ?? "bad-credentials",
        message: auth?.message ?? "That email and password don't match.",
      },
      { status: 401 },
    );
  }

  // Two-step accounts are not handled here yet. Saying so beats a blank screen
  // when the console hands a challenge token to something expecting a session.
  if (auth.mfa === "required") {
    return NextResponse.json(
      {
        error: "mfa-required",
        message: "This account uses two-step verification, which the console cannot do yet.",
      },
      { status: 401 },
    );
  }

  const token: string | undefined = auth.token;
  if (!token) {
    return NextResponse.json(
      { error: "bad-credentials", message: "That email and password don't match." },
      { status: 401 },
    );
  }

  // The role check, before the token goes anywhere near a browser.
  const meRes = await fetch(`${API}/admin/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  const me = meRes ? await meRes.json().catch(() => null) : null;

  if (!me || me.error) {
    return NextResponse.json(
      {
        error: me?.error ?? "not-staff",
        message:
          me?.message ?? "That account is real, but it does not hold a console role.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ token, me });
}
