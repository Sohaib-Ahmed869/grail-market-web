"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useRole } from "./RoleContext";

/**
 * The console's chrome, and who gets to see it.
 *
 * Two jobs, both of which need the pathname and the session, so both are here
 * rather than in the layout — a layout that could read either would have to be
 * a client component, and then the page metadata and the font would go with it.
 *
 * 1. The sign-in page has no sidebar and no topbar. It is one card on a navy
 *    field; a nav rail down the side of it would be a list of links that all
 *    refuse.
 *
 * 2. Everything else needs somebody signed in. When nobody is, this sends them
 *    to sign in and remembers where they were going.
 */

const LOGIN = "/admin/login";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const { me, loading, error } = useRole();

  const onLogin = pathname === LOGIN;

  useEffect(() => {
    if (onLogin || loading || me) return;
    /* Only a missing session sends anyone to the sign-in screen. A dead API is
       not an authentication problem, and bouncing to a login form that also
       cannot reach the API is a loop with no way out — Gate says what is
       actually wrong instead. */
    if (error === "unauthenticated" || error === "not-staff") {
      const next = encodeURIComponent(pathname);
      router.replace(`${LOGIN}?next=${next}`);
    }
  }, [onLogin, loading, me, error, pathname, router]);

  if (onLogin) return <>{children}</>;

  return (
    <div className="gm-shell">
      {/* the sidebar reads the query string to light up the current view, so
          it needs a boundary of its own rather than opting the whole console
          out of the static shell */}
      <Suspense fallback={<div className="gm-side" aria-hidden="true" />}>
        <Sidebar />
      </Suspense>
      <div className="gm-main">
        <Topbar />
        <main className="gm-content">{children}</main>
      </div>
    </div>
  );
}
