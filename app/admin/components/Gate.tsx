"use client";

/**
 * The route gate.
 *
 * Wraps a page's content and shows it only if the current role carries the
 * capability the page needs. See the warning at the top of `RoleContext` —
 * this hides an interface, it does not protect data.
 */

import Link from "next/link";
import {
  can,
  capabilitiesOf,
  capabilityLabel,
  homeFor,
  roleLabel,
  ROLES,
  type Capability,
} from "../lib/data";
import { useRole } from "./RoleContext";
import { Card, CardBody, CardHead, Note } from "./ui";
import { IconLock } from "./icons";

export function NoAccess({ need }: { need: Capability }) {
  const { role, previewing } = useRole();
  const home = homeFor(role);
  const meta = ROLES.find((r) => r.key === role);

  return (
    <Card>
      <CardHead
        title="Not in your scope"
        sub={`You need to be able to ${capabilityLabel[need].toLowerCase()}. ${roleLabel(role)} cannot.`}
      />
      <CardBody>
        <div
          className="gm-row"
          style={{ gap: 11, flexWrap: "nowrap", alignItems: "flex-start", marginBottom: 14 }}
        >
          <span className="gm-feed-ico gm-feed-ico--warn" style={{ flex: "none" }}>
            <IconLock />
          </span>
          <div className="gm-cell2">
            <b>{roleLabel(role)}</b>
            <span>{meta?.sees}</span>
          </div>
        </div>

        <div className="gm-label" style={{ marginBottom: 6 }}>
          What you can do
        </div>
        <div className="gm-person-tags" style={{ marginBottom: 14 }}>
          {capabilitiesOf(role).map((c) => (
            <span key={c} className="gm-scope">
              {capabilityLabel[c]}
            </span>
          ))}
        </div>

        <Link className="gm-btn gm-btn--primary" href={home.href}>
          Go to {home.label}
        </Link>

        {previewing ? (
          <Note tone="gold">
            You are previewing a role. Switch back from the account menu to see the console as{" "}
            yourself.
          </Note>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Render `children` only when the role carries `need`. */
export function Gate({ need, children }: { need: Capability; children: React.ReactNode }) {
  const { role, me, errorMessage, loading } = useRole();

  /* The role is an answer from the API now, so there is a moment before it
     arrives. Rendering the refusal during it would flash "not in your scope"
     at someone who is perfectly entitled to the page. */
  if (loading) return null;

  /* Nobody is signed in, or the API is not answering. Neither is a scope
     problem, and telling an operator their role is too small when the real
     fault is a dead API sends them to the wrong person. */
  if (!me) {
    return (
      <Card>
        <CardHead
          title="Not signed in"
          sub="The console could not establish who you are."
        />
        <CardBody>
          <Note tone="bad">{errorMessage ?? "No answer from the admin API."}</Note>
        </CardBody>
      </Card>
    );
  }

  return can(role, need) ? <>{children}</> : <NoAccess need={need} />;
}
