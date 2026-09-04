"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  changePassword,
  updateProfile,
} from "../lib/api";
import {
  Card,
  CardBody,
  CardHead,
  DL,
  Note,
  PageHead,
  Toast,
} from "../components/ui";
import { IconCheck, IconLock } from "../components/icons";
import { useRole } from "../components/RoleContext";
import { roleLabel } from "../lib/data";

/**
 * Your own account.
 *
 * It was a section inside Settings, which is the wrong page: everything else
 * there is a rule the marketplace runs on, changed by an owner and applying to
 * everybody. This is one person's name and one person's password, it applies
 * to nobody else, and most of the people who need it cannot open Settings at
 * all — editing settings is owner-only, and a Tier 1 agent still has a
 * password to change.
 *
 * Both halves go through /auth rather than /admin. The API works out whose
 * account is being changed from the session token, which is the only thing
 * that can answer that safely.
 */
function ProfilePage() {
  const { me, role, previewing } = useRole();

  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (me?.name) setName(me.name);
  }, [me?.name]);

  const nameChanged = name.trim().length >= 2 && name.trim() !== me?.name;

  /**
   * What is still missing, in words.
   *
   * The button was disabled with nothing beside it saying why, which reads as
   * broken rather than as blocked — the hints were under each field and the
   * thing you are looking at when nothing happens is the button.
   */
  const passwordBlocker =
    me?.devAuth
      ? "The development stand-in has no account to change."
      : !current
        ? "Type your current password first."
        : next.length === 0
          ? "Type a new password."
          : next.length < 10
            ? `${10 - next.length} more character${10 - next.length === 1 ? "" : "s"} needed.`
            : next !== again
              ? "The two new passwords do not match."
              : null;

  const passwordReady = passwordBlocker === null;

  async function saveName() {
    if (busy || !nameChanged) return;
    setBusy(true);
    try {
      await updateProfile({ name: name.trim() });
      setToast({
        title: "Name updated",
        body: "Decisions you take from now on are filed under it.",
      });
    } catch (e) {
      setToast({ title: "Not saved", body: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (busy || !passwordReady) return;
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setAgain("");
      setToast({
        title: "Password changed",
        body: "You have been emailed about it. Your other sessions are unaffected.",
      });
    } catch (e) {
      setToast({ title: "Not changed", body: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Your profile" sub="Your own account. Nobody else's." />

      <div className="gm-stack" style={{ maxWidth: 640 }}>
        {/* Said rather than discovered on the first refusal: the development
            stand-in is not a real account, so there is nothing to change. */}
        {me?.devAuth ? (
          <Note tone="warn">
            <b>This session is the development stand-in.</b> It is not a real account, so the API
            will refuse both changes below. Sign in properly to use this page.
          </Note>
        ) : null}

        {previewing ? (
          <Note>
            <b>You are previewing another role.</b> It changes only what the console draws. This
            page still edits your own account.
          </Note>
        ) : null}

        <Card>
          <CardHead title="Who you are" sub="The name every decision you take is filed under." />
          <CardBody>
            <DL
              rows={[
                ["Signed in as", me?.email || "not signed in"],
                ["Console role", roleLabel(role)],
              ]}
            />

            <div className="gm-field">
              <label className="gm-label" htmlFor="pf-name">
                Name
              </label>
              <input
                id="pf-name"
                className="gm-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <span className="gm-hint">
                {/* Why the log does not change with it. The entry is what it
                    said at the time, and rewriting old entries to match a new
                    name is rewriting the record. */}
                Entries already in the audit log keep the name they were written with.
              </span>
            </div>

            <div className="gm-row">
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                disabled={busy || !nameChanged}
                onClick={saveName}
              >
                <IconCheck />
                Save name
              </button>
              {!nameChanged && name.trim() === me?.name ? (
                <span className="gm-tiny gm-dim">Nothing to save.</span>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Password"
            sub="You are emailed whenever this changes, whoever changed it."
          />
          <CardBody>
            <div className="gm-field">
              <label className="gm-label" htmlFor="pf-cur">
                Current password
              </label>
              <input
                id="pf-cur"
                type="password"
                className="gm-input"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>

            <div className="gm-field">
              <label className="gm-label" htmlFor="pf-new">
                New password
              </label>
              <input
                id="pf-new"
                type="password"
                className="gm-input"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <span className="gm-hint">
                At least 10 characters.
                {next.length > 0 && next.length < 10 ? ` ${10 - next.length} more to go.` : ""}
              </span>
            </div>

            <div className="gm-field">
              <label className="gm-label" htmlFor="pf-again">
                Type it again
              </label>
              <input
                id="pf-again"
                type="password"
                className="gm-input"
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
              />
              {again.length > 0 && again !== next ? (
                <span className="gm-hint" style={{ color: "var(--bad)" }}>
                  These do not match.
                </span>
              ) : null}
            </div>

            <div className="gm-row">
              <button
                type="button"
                className="gm-btn gm-btn--primary"
                disabled={busy || !passwordReady}
                onClick={savePassword}
              >
                <IconLock />
                {busy ? "Changing…" : "Change password"}
              </button>
              {passwordBlocker ? (
                <span className="gm-tiny gm-dim">{passwordBlocker}</span>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      {toast ? (
        <Toast title={toast.title} body={toast.body} onDone={() => setToast(null)} />
      ) : null}
    </>
  );
}

/* No `Gate`. Every console role has an account, and a page that only edits
   your own name and password is not something a capability can sensibly
   withhold — the sign-in itself is the check. */
export default ProfilePage;
