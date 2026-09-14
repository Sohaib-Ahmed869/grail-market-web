"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  fetchStaff,
  grantStaff,
  revokeStaff,
  setStaffRole as apiSetStaffRole,
  type AdminStaff,
} from "../../lib/api";
import { ROLES, roleLabel, scopesOf, shortDate, type Role } from "../../lib/data";
import {
  Badge,
  Card,
  CardBody,
  CardHead,
  Modal,
  Note,
  PageHead,
  Select,
  Toast,
  ViewToggle,
} from "../../components/ui";
import { IconCheck, IconLock, IconMail } from "../../components/icons";
import { Gate } from "../../components/Gate";

/**
 * Who holds a console role, and what it reaches.
 *
 * This used to be the "Team & access" tab on the old Settings page. Settings
 * is the personal account page now (name, password), so scoping the team
 * lives here instead — one click from the Admin Team directory via
 * "Manage access", with a way back to it.
 */
function AccessPage() {
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("tier-1");
  const [inviteCompany, setInviteCompany] = useState("");
  const [scoping, setScoping] = useState<AdminStaff | null>(null);
  const [scopeRole, setScopeRole] = useState<Role>("tier-1");
  const [revoking, setRevoking] = useState<AdminStaff | null>(null);
  const [teamWhy, setTeamWhy] = useState("");
  const [teamToast, setTeamToast] = useState<string | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [writes, setWrites] = useState(0);
  /* The switch the listing queue carries, on the one list this page holds.
     The table stays the default and stays as it was — the second option is
     the same accounts as cards, which is how the members directory already
     draws the same people, and it has room for the scopes a role carries
     without a column of run-together words. */
  const [teamLayout, setTeamLayout] = useState<"table" | "gallery">("table");

  const [team, setTeam] = useState<AdminStaff[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setTeamLoading(true);
    fetchStaff()
      .then((r) => live && setTeam(r))
      .catch((e) => live && setTeamError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setTeamLoading(false));
    return () => {
      live = false;
    };
  }, [writes]);

  async function runTeam(work: () => Promise<AdminStaff[]>, said: string) {
    if (teamBusy) return;
    setTeamBusy(true);
    try {
      setTeam(await work());
      setTeamToast(said);
      setScoping(null);
      setRevoking(null);
      setInviting(false);
      setTeamWhy("");
      setInviteEmail("");
    } catch (e) {
      setTeamToast(e instanceof ApiError ? e.message : String(e));
    } finally {
      setTeamBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Manage access"
        sub="Who holds a console role, and what it reaches."
        back={{ href: "/admin/members?scope=team", label: "Admin team" }}
        right={
          <button
            type="button"
            className="gm-btn gm-btn--primary"
            onClick={() => {
              setInviteEmail("");
              setInviteCompany("");
              setInviteRole("tier-1");
              setInviting(true);
            }}
          >
            <IconMail />
            Grant access
          </button>
        }
      />

      <div className="gm-stack">
        {teamError ? (
          <Note tone="bad">
            <b>The team could not be read.</b> {teamError}
          </Note>
        ) : null}

        {/* ------------------------------------------------- the roles */}
        <Card>
          <CardHead
            title="Roles"
            sub="Five, and what each one can reach. The console reads this table directly."
          />
          <div className="gm-tablewrap">
            <table className="gm-table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th className="gm-chipcol gm-chipcol--wide" style={{ width: "20%" }}>
                    <span>Role</span>
                  </th>
                  <th style={{ width: "18%" }}>Who holds it</th>
                  <th>Sees</th>
                  <th style={{ width: "12%" }}>Accounts</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => {
                  const held = team.filter((p) => p.role === r.key);
                  return (
                    <tr key={r.key}>
                      <td className="gm-chipcol gm-chipcol--wide">
                        {r.key === "owner" ? (
                          <Badge tone="gold">{r.label}</Badge>
                        ) : (
                          <Badge tone="idle">{r.label}</Badge>
                        )}
                      </td>
                      <td className="gm-sm gm-muted gm-nowrap">{r.who}</td>
                      <td className="gm-sm gm-muted">
                        {r.sees}
                        <div className="gm-person-tags" style={{ marginTop: 6 }}>
                          {scopesOf(r.key).map((sc) => (
                            <span key={sc} className="gm-scope">
                              {sc}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="gm-sm gm-muted gm-nowrap">{held.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <CardBody>
            <Note tone="warn">
              <b>This controls what people see, not what they could reach.</b> It stops an
              agent opening a page that is not theirs and hides the controls they cannot use,
              which is what it is for. It is not yet a lock. The console is still a prototype
              with no sign-in behind it, so someone determined and technical could get at the
              underlying data anyway. Making these roles a real barrier is work on the server
              that has not been built yet. Until it is, the outsourced tiers should be limited
              by their contract as well as by this table.
            </Note>
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Who has admin access"
            sub={
              teamLoading
                ? "Reading the team…"
                : `${team.length} account${team.length === 1 ? "" : "s"} hold a console role`
            }
            right={<ViewToggle value={teamLayout} onChange={setTeamLayout} />}
          />
          {teamLayout === "gallery" ? (
            /* The same accounts, one to a card. Nothing here is a fact the
               table does not carry; the scopes are the one thing that reads
               better wrapped than as a single line of names joined by
               middots, so this is where they are legible. */
            <div className="gm-people">
              {team.map((p) => (
                <article key={p.id} className="gm-person">
                  <div className="gm-person-top">
                    <div className="gm-person-id">
                      <b>{p.name}</b>
                      <span>{p.email}</span>
                    </div>
                    {p.role === "owner" ? (
                      <Badge tone="gold">{roleLabel(p.role)}</Badge>
                    ) : (
                      <Badge tone="idle">{roleLabel(p.role)}</Badge>
                    )}
                  </div>

                  <div className="gm-person-facts">
                    <span className="gm-person-fact">
                      On the team since {shortDate(p.since)}
                    </span>
                    <span className="gm-person-fact">
                      {p.grantedBy ? `Scoped by ${p.grantedBy}` : "Grant not recorded"}
                    </span>
                  </div>

                  <div className="gm-person-tags">
                    {scopesOf(p.role).map((sc) => (
                      <span key={sc} className="gm-scope">
                        {sc}
                      </span>
                    ))}
                  </div>

                  <div className="gm-person-foot">
                    <button
                      type="button"
                      className="gm-btn gm-btn--sm gm-btn--primary"
                      onClick={() => {
                        setScoping(p);
                        setScopeRole(p.role);
                        setTeamWhy("");
                      }}
                    >
                      Scope
                    </button>
                    <button
                      type="button"
                      className="gm-btn gm-btn--sm"
                      onClick={() => {
                        setRevoking(p);
                        setTeamWhy("");
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="gm-tablewrap">
              <table className="gm-table" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th className="gm-chipcol gm-chipcol--wide">
                      <span>Role</span>
                    </th>
                    <th>Scopes</th>
                    <th>Granted</th>
                    <th className="gm-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="gm-cell-user">
                          <div className="gm-cell2">
                            <b>{p.name}</b>
                            <span>{p.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="gm-chipcol gm-chipcol--wide">
                        {p.role === "owner" ? (
                          <Badge tone="gold">{roleLabel(p.role)}</Badge>
                        ) : (
                          <Badge tone="idle">{roleLabel(p.role)}</Badge>
                        )}
                      </td>
                      <td className="gm-sm gm-muted">{scopesOf(p.role).join(" · ")}</td>
                      <td className="gm-sm gm-muted gm-nowrap">
                        {p.grantedBy ? `by ${p.grantedBy}` : "Not recorded"}
                      </td>
                      <td className="gm-actions">
                        <div className="gm-row" style={{ gap: 6, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="gm-btn gm-btn--sm gm-btn--primary"
                            onClick={() => {
                              setScoping(p);
                              setScopeRole(p.role);
                              setTeamWhy("");
                            }}
                          >
                            Scope
                          </button>
                          <button
                            type="button"
                            className="gm-btn gm-btn--sm"
                            onClick={() => {
                              setRevoking(p);
                              setTeamWhy("");
                            }}
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ===================================================== invite */}
      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Give an account console access"
        sub="They need to have signed up already. The console cannot create an account, only give a role to one that exists."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={teamBusy || !inviteEmail.includes("@")}
              onClick={() =>
                void runTeam(
                  () => grantStaff(inviteEmail.trim(), inviteRole, inviteCompany.trim()),
                  `${inviteEmail.trim()} is now ${roleLabel(inviteRole)}`,
                )
              }
            >
              <IconMail />
              {teamBusy ? "Granting…" : "Grant access"}
            </button>
            <button type="button" className="gm-btn" onClick={() => setInviting(false)}>
              Cancel
            </button>
          </>
        }
      >
        <div className="gm-field">
          <label className="gm-label" htmlFor="inv-email">
            Work email
          </label>
          <input
            id="inv-email"
            className="gm-input gm-mono"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@grailmarket.app"
          />
        </div>
        <div className="gm-field">
          <label className="gm-label" htmlFor="inv-role">
            Role
          </label>
          <Select
            id="inv-role"
            value={inviteRole}
            onChange={(v) => setInviteRole(v as Role)}
            options={ROLES.map((r) => ({ value: r.key, label: `${r.label} · ${r.who}` }))}
            style={{ width: "100%" }}
          />
          <span className="gm-hint">
            {ROLES.find((r) => r.key === inviteRole)?.sees}
          </span>
        </div>
        <div className="gm-field">
          <label className="gm-label" htmlFor="inv-co">
            Outsourcing partner
          </label>
          <input
            id="inv-co"
            className="gm-input"
            value={inviteCompany}
            onChange={(e) => setInviteCompany(e.target.value)}
            placeholder="Leave blank for Grail Market staff"
          />
          <span className="gm-hint">
            Named on the account, so who employs someone is never worked out from a domain.
          </span>
        </div>
        {inviteRole === "owner" ? (
          <Note tone="bad">
            <b>Owner reaches everything,</b> subscriptions, the price engine and the audit log
            included. There is currently one. Consider whether Trust &amp; safety is what you
            actually mean.
          </Note>
        ) : null}
      </Modal>

      {/* ====================================================== scope */}
      <Modal
        open={!!scoping}
        onClose={() => setScoping(null)}
        title={scoping ? `Change what ${scoping.name} can reach` : ""}
        sub="Scope follows the role, so this moves the role. Single pages cannot be handed out on their own."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={
                !scoping || teamBusy || teamWhy.trim().length < 6 || scopeRole === scoping.role
              }
              onClick={() => {
                if (!scoping) return;
                const who = scoping;
                void runTeam(
                  () => apiSetStaffRole(who.id, scopeRole),
                  `${who.name} is now ${roleLabel(scopeRole)}`,
                );
              }}
            >
              <IconCheck />
              Apply
            </button>
            <button type="button" className="gm-btn" onClick={() => setScoping(null)}>
              Cancel
            </button>
          </>
        }
      >
        {scoping ? (
          <>
            <div className="gm-field">
              <label className="gm-label" htmlFor="sc-role">
                Role
              </label>
              <Select
                id="sc-role"
                value={scopeRole}
                onChange={(v) => setScopeRole(v as Role)}
                options={ROLES.map((r) => ({ value: r.key, label: r.label }))}
                style={{ width: "100%" }}
              />
            </div>
            <Card pad>
              <div className="gm-label" style={{ marginBottom: 7 }}>
                Would be able to reach
              </div>
              <div className="gm-person-tags">
                {scopesOf(scopeRole).map((sc) => (
                  <span key={sc} className="gm-scope">
                    {sc}
                  </span>
                ))}
              </div>
              <p className="gm-sm gm-muted" style={{ marginTop: 9, marginBottom: 0 }}>
                {ROLES.find((r) => r.key === scopeRole)?.sees}
              </p>
            </Card>
            <div className="gm-field">
              <label className="gm-label" htmlFor="sc-why">
                Why
              </label>
              <textarea
                id="sc-why"
                className="gm-textarea"
                value={teamWhy}
                onChange={(e) => setTeamWhy(e.target.value)}
                placeholder="A promotion, a handover, a contract change."
              />
            </div>
          </>
        ) : null}
      </Modal>

      {/* ===================================================== revoke */}
      <Modal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={revoking ? `Revoke ${revoking.name}` : ""}
        sub="Sessions end immediately and every scope is withdrawn."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={teamBusy || teamWhy.trim().length < 6}
              onClick={() => {
                if (!revoking) return;
                const who = revoking;
                /* Revoking IS setting the role back to `member`. There is no
                   separate staff record to delete — a member is a staff member
                   with a role on them, which is why this is one write. */
                void runTeam(
                  () => revokeStaff(who.id),
                  `${who.name} no longer holds a console role`,
                );
              }}
            >
              <IconLock />
              Revoke access
            </button>
            <button type="button" className="gm-btn" onClick={() => setRevoking(null)}>
              Cancel
            </button>
          </>
        }
      >
        {revoking ? (
          <>
            <Note tone="bad">
              <b>Work already assigned to this account returns to the unclaimed queue.</b> Their
              decisions stay in the audit log under their name. Revoking an account does not
              retract what it did.
            </Note>
            <div className="gm-field">
              <label className="gm-label" htmlFor="rv-why">
                Reason
              </label>
              <textarea
                id="rv-why"
                className="gm-textarea"
                value={teamWhy}
                onChange={(e) => setTeamWhy(e.target.value)}
                placeholder="Left the company, contract ended, security concern."
              />
            </div>
          </>
        ) : null}
      </Modal>

      {teamToast ? (
        <Toast title="Team updated" body={teamToast} onDone={() => setTeamToast(null)} />
      ) : null}
    </>
  );
}

export default function GatedAccessPage() {
  return (
    <Gate need="settings.write">
      <AccessPage />
    </Gate>
  );
}
