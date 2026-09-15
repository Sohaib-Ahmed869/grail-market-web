import { NextResponse } from "next/server";
import { apiBase } from "../../../../lib/apibase";

/**
 * Card images from the scan checker to the admin API.
 *
 * Its own route because the general admin forwarder sends JSON and nothing
 * else, and a card photo is a multipart upload: the scan pipeline wants the
 * original bytes, unresized, because the collector number is a few points of
 * type in a corner. Like the forwarder, this authenticates nobody — the API
 * decides who the caller is from the bearer token passed through.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const API = apiBase();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid", message: "Expected a multipart upload." }, { status: 400 });
  }
  const auth = req.headers.get("authorization");

  let res: Response;
  try {
    res = await fetch(`${API}/admin/scans`, {
      method: "POST",
      body: form,
      headers: auth ? { authorization: auth } : {},
      cache: "no-store",
    });
  } catch {
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
