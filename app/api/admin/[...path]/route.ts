import { NextResponse } from "next/server";

/**
 * The console's way to the admin API.
 *
 * It forwards, and it does not authenticate. The API decides who the caller is
 * from their own session token and what they may do from the `role` column on
 * their user row — there is no separate admin credential for this handler to
 * hold, on purpose. A second credential is a second thing to leak and rotate,
 * and a shared one cannot tell you which person approved a listing.
 *
 * What it is still for: the browser only ever talks to its own origin. No CORS,
 * no preflight, and the API host can move behind a private network later
 * without anything on the client changing.
 *
 * When the console gets its sign-in screen, the token it stores travels in the
 * Authorization header below and nothing here changes.
 */

const API = (process.env.GRAILMARKET_API_URL ?? "http://localhost:8180").replace(/\/+$/, "");

/** Nothing here is cacheable — it is a work queue. */
export const dynamic = "force-dynamic";

async function forward(req: Request, path: string[], method: "GET" | "POST") {
  const url = new URL(req.url);
  const target = `${API}/admin/${path.map(encodeURIComponent).join("/")}${url.search}`;

  const auth = req.headers.get("authorization");

  let res: Response;
  try {
    res = await fetch(target, {
      method,
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: auth } : {}),
      },
      body: method === "POST" ? await req.text() : undefined,
      cache: "no-store",
    });
  } catch {
    // A dead API is the single most likely thing to be wrong here, and
    // "failed to fetch" in a console tab tells an operator nothing.
    return NextResponse.json(
      { error: "api-unreachable", message: `No answer from the API at ${API}. Is it running?` },
      { status: 502 },
    );
  }

  const text = await res.text();
  return new NextResponse(text, {
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
