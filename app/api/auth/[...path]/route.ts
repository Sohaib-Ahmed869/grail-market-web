import { NextResponse } from "next/server";

/**
 * The console's way to the account endpoints.
 *
 * The same forwarder as `/api/admin`, pointed at `/auth` instead, and for the
 * same reason: the browser only ever talks to its own origin, so there is no
 * CORS and the API host can move behind a private network without anything on
 * the client changing.
 *
 * Only the handful an operator needs for their own account. It is an allowlist
 * rather than a passthrough because `/auth` also holds `register`, `login`,
 * `oauth` and the password-reset pair — none of which the console has any
 * business proxying, and all of which would become reachable from this origin
 * the moment somebody forwarded the whole prefix.
 *
 * It does not authenticate. The API reads the caller from their own session
 * token, which is the only thing that can say whose password is being changed.
 */

const API = (process.env.GRAILMARKET_API_URL ?? "http://localhost:8180").replace(/\/+$/, "");

/** Nothing here is cacheable, and nothing here is safe to guess at. */
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["password", "profile", "me", "methods"]);

async function forward(req: Request, path: string[], method: "GET" | "POST") {
  const route = path.join("/");
  if (!ALLOWED.has(route)) {
    return NextResponse.json({ error: "not-found", message: "No such route." }, { status: 404 });
  }

  const auth = req.headers.get("authorization");

  let res: Response;
  try {
    res = await fetch(`${API}/auth/${route}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: auth } : {}),
      },
      body: method === "POST" ? await req.text() : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error: "api-unreachable",
        message: `The API at ${API} did not answer. Is it running?`,
      },
      { status: 502 },
    );
  }

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path, "GET");
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path, "POST");
}
