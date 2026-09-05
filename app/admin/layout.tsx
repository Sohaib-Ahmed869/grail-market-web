import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Shell from "./components/Shell";
import { RoleProvider } from "./components/RoleContext";
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
      <RoleProvider>
      <div className={`gm ${outfit.variable}`}>
        {/* The chrome, and the sign-in gate around it. Both need the pathname
            and the session, so both live in a client component rather than
            dragging this layout — and the metadata and font with it — out of
            the server. */}
        <Shell>{children}</Shell>

        {/* Modals and toasts mount here. Inside `.gm` so they inherit the
            tokens and the font, outside the shell so no transformed ancestor
            can capture their `position: fixed`. */}
        <div id="gm-overlays" />
      </div>
      </RoleProvider>
    </>
  );
}
