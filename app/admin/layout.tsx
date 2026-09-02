import type { Metadata } from "next";
import { Suspense } from "react";
import { Outfit } from "next/font/google";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { DriftLayer } from "./components/ui";
import "./admin.css";
import "./cards.css";
import "./parts.css";

/* Outfit, matching the public client. Loaded as a CSS variable so admin.css
   owns the whole type stack rather than inheriting whatever the root layout
   happens to set. */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-admin",
  display: "swap",
});

/* Stamp the saved theme and the folded state of the sidebar on <html> before
   the first paint. Without this the page renders light with the panel open,
   then corrects itself once React runs — a visible flash on every navigation
   for anyone who has changed either. */
const boot = `try{var t=localStorage.getItem("gm-admin-theme");if(t==="dark"||t==="light")document.documentElement.dataset.gmTheme=t;else if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.gmTheme="dark";if(localStorage.getItem("gm-admin-rail")==="1")document.documentElement.dataset.gmRail="1";}catch(e){}`;

export const metadata: Metadata = {
  title: "GrailMarket · Admin",
  description: "Verification, conflict resolution and member administration for GrailMarket.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: boot }} />
      <div className={`gm ${outfit.variable}`}>
        <div className="gm-shell">
          <DriftLayer />
          {/* the sidebar reads the query string to light up the current view,
              so it needs a boundary of its own rather than opting the whole
              console out of the static shell */}
          <Suspense fallback={<div className="gm-side" aria-hidden="true" />}>
            <Sidebar />
          </Suspense>
          <div className="gm-main">
            <Topbar />
            <main className="gm-content">{children}</main>
          </div>
        </div>

        {/* Drawers, modals and toasts mount here. Inside `.gm` so they inherit
            the tokens and the font, outside `.gm-shell` so no transformed
            ancestor can capture their `position: fixed`. */}
        <div id="gm-overlays" />
      </div>
    </>
  );
}
