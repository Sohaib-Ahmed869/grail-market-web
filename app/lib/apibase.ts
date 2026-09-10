/**
 * Where the API is. One module, because it was five copies of the same line.
 *
 * `const API = process.env.X ?? "http://localhost:8180"` was written out at
 * every call site — the three proxy routes, the public client and the reset
 * page. That is fine on the machine the default happens to be true on and
 * silent everywhere else: `.env.local` is gitignored, so a fresh clone has no
 * variable at all, each of the five falls back to a port nothing is listening
 * on, and the only symptom is a fetch that fails with no mention of the
 * setting that would have fixed it. Changing the port meant finding all five.
 *
 * Two bases, and they are not interchangeable:
 *
 *   GRAILMARKET_API_URL   server-side only, read at request time, so it may
 *                         name a host the browser cannot reach and a restart
 *                         picks up a change.
 *   NEXT_PUBLIC_API_URL   baked into the bundle at build time, so it must be
 *                         reachable from the browser and a change needs a
 *                         rebuild rather than a restart.
 *
 * Either one alone is enough to run the whole thing locally: the server base
 * falls back to the public one before it falls back to a guess. Someone who
 * sets only the variable they had heard of gets a working app rather than a
 * half-working one.
 */

/** The last-resort address, and the only place the number is written. */
const LOCAL_DEFAULT = "http://localhost:8180";

const trim = (u: string) => u.replace(/\/+$/, "");

/* Said once per process, not once per request — a proxy route is hit on every
   page of the console and a warning printed 40 times reads as a fault of its
   own. */
let warned = false;

/**
 * The API as this app's own server sees it. Read inside the function, never at
 * module scope: a route module is evaluated once, and a value captured there
 * cannot be corrected without a rebuild.
 */
export function apiBase(): string {
  const configured = process.env.GRAILMARKET_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (configured) return trim(configured);

  if (!warned) {
    warned = true;
    console.warn(
      `[api] Neither GRAILMARKET_API_URL nor NEXT_PUBLIC_API_URL is set — falling back to ${LOCAL_DEFAULT}. ` +
        "If the API is on another port or another host, set GRAILMARKET_API_URL in .env.local and restart. " +
        "See .env.example.",
    );
  }
  return LOCAL_DEFAULT;
}

/**
 * The API as the browser sees it.
 *
 * `process.env.NEXT_PUBLIC_API_URL` is written out in full and read at module
 * scope on purpose — Next substitutes the literal text at build time, so it
 * cannot be assembled from a variable or looked up dynamically the way the
 * server base is.
 */
export const PUBLIC_API_BASE = trim(process.env.NEXT_PUBLIC_API_URL || LOCAL_DEFAULT);
