"use client";

/**
 * Who is using the console, and what that lets them open.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS IS A UI GATE, NOT A SECURITY BOUNDARY.
 *
 * The role now comes from the API — `GET /admin/me`, answered from the `role`
 * column on the operator's user row — so it is a real answer rather than a
 * guess. What this layer does with it is still only interface: hide the pages
 * and controls a role cannot use, so nobody is offered a button the server
 * will refuse. Every admin endpoint checks the same capability again on its
 * own, and that check is the one that matters. Anything the console knows is
 * already in the response it was sent.
 *
 * Nobody signed in means `me` is null and `error` is `unauthenticated`, and
 * the shell sends them to /admin/login. If the API is running with its
 * development operator set (`ADMIN_DEV_USER`) it answers without a token at
 * all and `me.devAuth` is true, so the console can say so rather than letting
 * a stand-in look like a real session.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useEffect, useState } from "react";
import { can, type Capability, type Role } from "../lib/data";
import { ApiError, fetchMe, signOut as clearSession, type Me } from "../lib/api";

const KEY = "gm-admin-role-preview";

type Ctx = {
  /** The role the console is drawing for. The operator's own, unless previewing. */
  role: Role;
  /** Who the API says is signed in. Null while loading, or if nobody is. */
  me: Me | null;
  /** Why there is no operator, when there is none. `unauthenticated` and
   *  `not-staff` are sign-in problems; anything else is the API. */
  error: string | null;
  errorMessage: string | null;
  /** Drop the session and go back to the sign-in screen. */
  signOut: () => void;
  loading: boolean;
  /** Look at the console as another role would see it. Owners only. */
  setPreview: (r: Role | null) => void;
  previewing: boolean;
};

const RoleCtx = createContext<Ctx>({
  role: "moderator",
  me: null,
  error: null,
  errorMessage: null,
  loading: true,
  signOut: () => {},
  setPreview: () => {},
  previewing: false,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreviewState] = useState<Role | null>(null);

  useEffect(() => {
    let live = true;
    fetchMe()
      .then((m) => {
        if (!live) return;
        setMe(m);
        setError(null);
        setErrorMessage(null);
      })
      .catch((e) => {
        if (!live) return;
        setMe(null);
        setError(e instanceof ApiError ? e.code : "unknown");
        setErrorMessage(e?.message ?? "Could not reach the admin API.");
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  /* Read after mount rather than during render: the server has no
     localStorage, and a preview picked up during render would not match the
     markup it sent. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Role | null;
      if (saved) setPreviewState(saved);
    } catch {
      /* private mode, blocked storage — no preview, which is the honest state */
    }
  }, []);

  function setPreview(r: Role | null) {
    setPreviewState(r);
    try {
      if (r) localStorage.setItem(KEY, r);
      else localStorage.removeItem(KEY);
    } catch {
      /* not being able to remember the choice is not a reason to refuse it */
    }
  }

  /* Previewing is a way to check the scoping, so it may only ever narrow.
     An account that is not an owner cannot preview its way into more. */
  const own = me?.role ?? "moderator";
  const role = preview && own === "owner" ? preview : own;

  function signOut() {
    clearSession();
    setPreview(null);
    /* A full navigation, not a router push: every provider under this one is
       holding a signed-in answer, and only a reload clears them all. */
    window.location.href = "/admin/login";
  }

  return (
    <RoleCtx.Provider
      value={{
        role,
        me,
        error,
        errorMessage,
        loading,
        signOut,
        setPreview,
        previewing: role !== own,
      }}
    >
      {children}
    </RoleCtx.Provider>
  );
}

export const useRole = () => useContext(RoleCtx);

/** `can` bound to the current role, for a component that only needs the answer. */
export function useCan(c: Capability) {
  const { role } = useRole();
  return can(role, c);
}
