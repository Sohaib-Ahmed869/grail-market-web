"use client";

import { useState } from "react";
import { adminTeam } from "../lib/data";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHead,
  Note,
  PageHead,
  SettingRow,
  PillTabs,
  Toggle,
} from "../components/ui";
import {
  IconCheck,
  IconKey,
  IconLock,
  IconRefresh,
  IconSettings,
  IconShield,
  IconUsers,
} from "../components/icons";

type Section = "thresholds" | "policy" | "team" | "notifications";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "thresholds", label: "Review thresholds" },
  { key: "policy", label: "Marketplace policy" },
  { key: "team", label: "Moderation team" },
  { key: "notifications", label: "Notifications" },
];

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("thresholds");

  /* Local state only — nothing persists until the backend exists. */
  const [grailFloor, setGrailFloor] = useState("5000");
  const [highFloor, setHighFloor] = useState("1000");
  const [autoClear, setAutoClear] = useState(true);
  const [autoClearHours, setAutoClearHours] = useState("24");
  const [sampleRate, setSampleRate] = useState("5");
  const [requireCert, setRequireCert] = useState(true);
  const [blockLowConfidence, setBlockLowConfidence] = useState(true);
  const [minPhotos, setMinPhotos] = useState("4");

  const [holdOnDispute, setHoldOnDispute] = useState(true);
  const [disputeWindow, setDisputeWindow] = useState("14");
  const [autoEscalate, setAutoEscalate] = useState("72");
  const [strikeLimit, setStrikeLimit] = useState("3");
  const [allowRaw, setAllowRaw] = useState(false);
  const [commission, setCommission] = useState("8.5");

  const [notifySla, setNotifySla] = useState(true);
  const [notifyGrail, setNotifyGrail] = useState(true);
  const [notifyEscalation, setNotifyEscalation] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);

  return (
    <>
      <PageHead
        title="Settings"
        sub="What the marketplace does on its own, and what it holds back for a person."
        right={
          <>
            <button type="button" className="gm-btn">
              <IconRefresh />
              Discard changes
            </button>
            <button type="button" className="gm-btn gm-btn--primary">
              <IconCheck />
              Save changes
            </button>
          </>
        }
      />

      <div className="gm-stack">
        <div className="gm-row">
          <PillTabs value={section} onChange={setSection} options={SECTIONS} />
        </div>

        {/* ================================================== thresholds */}
        {section === "thresholds" ? (
          <div className="gm-stack">
            <Card>
              <CardHead
                title="Review tiers"
                sub="Where a submission goes the moment a seller files it"
              />
              <CardBody>
                <SettingRow
                  title="Grail tier floor"
                  hint="At or above this ask price, a card is held for full manual verification — cert lookup, every photo, provenance where the price data is thin."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <span className="gm-muted">$</span>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 118, textAlign: "right" }}
                        value={grailFloor}
                        onChange={(e) => setGrailFloor(e.target.value)}
                        inputMode="numeric"
                        aria-label="Grail tier floor"
                      />
                    </div>
                  }
                />
                <SettingRow
                  title="High-value floor"
                  hint="Between this and the grail floor, a submission gets a lighter review: cert lookup and a photo pass."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <span className="gm-muted">$</span>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 118, textAlign: "right" }}
                        value={highFloor}
                        onChange={(e) => setHighFloor(e.target.value)}
                        inputMode="numeric"
                        aria-label="High value floor"
                      />
                    </div>
                  }
                />
                <SettingRow
                  title="Auto-clear the high-value tier"
                  hint="If nobody touches a high-value submission inside the window and its ask sits inside the market band, release it. Grail tier never auto-clears."
                  control={<Toggle checked={autoClear} onChange={setAutoClear} label="Auto-clear high value" />}
                />
                <SettingRow
                  title="Auto-clear window"
                  hint="How long a high-value submission waits for a moderator before releasing itself."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={autoClearHours}
                        onChange={(e) => setAutoClearHours(e.target.value)}
                        inputMode="numeric"
                        disabled={!autoClear}
                        aria-label="Auto-clear window in hours"
                      />
                      <span className="gm-muted">hours</span>
                    </div>
                  }
                />
                <SettingRow
                  title="Standard tier spot-check rate"
                  hint="Share of below-floor listings pulled for a random review after they go live."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={sampleRate}
                        onChange={(e) => setSampleRate(e.target.value)}
                        inputMode="numeric"
                        aria-label="Spot check rate"
                      />
                      <span className="gm-muted">%</span>
                    </div>
                  }
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead title="What a submission must carry" sub="Enforced before it reaches the queue" />
              <CardBody>
                <SettingRow
                  title="Require a certificate number for slabbed cards"
                  hint="Checked against the grading company's register. A grade always belongs to a company — there is no grade-only lookup."
                  control={<Toggle checked={requireCert} onChange={setRequireCert} label="Require certificate" />}
                />
                <SettingRow
                  title="Block release on a low-confidence valuation"
                  hint="If there are too few comparable sales for this exact grader and grade, the card cannot be released without a moderator overriding it in writing."
                  control={
                    <Toggle
                      checked={blockLowConfidence}
                      onChange={setBlockLowConfidence}
                      label="Block low-confidence release"
                    />
                  }
                />
                <SettingRow
                  title="Minimum photos"
                  hint="Front, back and the slab label at minimum. Grail tier always requires all four edges regardless of this number."
                  control={
                    <input
                      className="gm-input gm-mono"
                      style={{ width: 84, textAlign: "right" }}
                      value={minPhotos}
                      onChange={(e) => setMinPhotos(e.target.value)}
                      inputMode="numeric"
                      aria-label="Minimum photos"
                    />
                  }
                />
                <SettingRow
                  title="Allow raw (ungraded) cards above the high-value floor"
                  hint="Off by default. An expensive raw card is the hardest thing on the platform to authenticate from photographs."
                  control={<Toggle checked={allowRaw} onChange={setAllowRaw} label="Allow expensive raw cards" />}
                />
              </CardBody>
            </Card>
          </div>
        ) : null}

        {/* ====================================================== policy */}
        {section === "policy" ? (
          <div className="gm-stack">
            <Card>
              <CardHead title="Conflicts and funds" sub="What happens automatically when a dispute opens" />
              <CardBody>
                <SettingRow
                  title="Hold the payout when a conflict opens"
                  hint="Funds stay held until a moderator decides. Turning this off means money can leave before a dispute is resolved."
                  control={<Toggle checked={holdOnDispute} onChange={setHoldOnDispute} label="Hold payout on dispute" />}
                />
                <SettingRow
                  title="Dispute window"
                  hint="How long after delivery a buyer can still open a conflict."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={disputeWindow}
                        onChange={(e) => setDisputeWindow(e.target.value)}
                        inputMode="numeric"
                        aria-label="Dispute window in days"
                      />
                      <span className="gm-muted">days</span>
                    </div>
                  }
                />
                <SettingRow
                  title="Auto-escalate after"
                  hint="An open case with no agreement is escalated to a lead moderator at this age."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={autoEscalate}
                        onChange={(e) => setAutoEscalate(e.target.value)}
                        inputMode="numeric"
                        aria-label="Auto escalate after hours"
                      />
                      <span className="gm-muted">hours</span>
                    </div>
                  }
                />
                <SettingRow
                  title="Strikes before automatic member review"
                  hint="Authenticity rejections and upheld conflicts both count. Reaching the limit opens a member review — it does not revoke access on its own."
                  control={
                    <input
                      className="gm-input gm-mono"
                      style={{ width: 84, textAlign: "right" }}
                      value={strikeLimit}
                      onChange={(e) => setStrikeLimit(e.target.value)}
                      inputMode="numeric"
                      aria-label="Strike limit"
                    />
                  }
                />
                <SettingRow
                  title="Commission"
                  hint="Taken from the seller on a completed sale. Shown to sellers before they list."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={commission}
                        onChange={(e) => setCommission(e.target.value)}
                        inputMode="decimal"
                        aria-label="Commission percentage"
                      />
                      <span className="gm-muted">%</span>
                    </div>
                  }
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead title="Accepted grading companies" sub="Each priced on its own scale" />
              <CardBody>
                <Note>
                  A grade is never converted between companies to reach a price. A BGS 9.5 is not a
                  PSA 10, CGC has two different 10s, and SGC legacy slabs use a 100-point scale — so
                  each is valued from its own sales only.
                </Note>
                <div className="gm-row" style={{ gap: 8, marginTop: 14 }}>
                  {["PSA", "BGS", "CGC", "SGC", "TAG"].map((g) => (
                    <Badge key={g} tone="navy">
                      {g}
                    </Badge>
                  ))}
                  <Badge tone="warn">BCCG · discount tier</Badge>
                  <Badge tone="bad">BRCR · priced as raw</Badge>
                </div>
              </CardBody>
            </Card>
          </div>
        ) : null}

        {/* ======================================================== team */}
        {section === "team" ? (
          <div className="gm-stack">
            <Card>
              <CardHead
                title="Who has admin access"
                sub={`${adminTeam.length} accounts`}
                right={
                  <span className="gm-badge gm-badge--gold gm-badge--nodot">
                    <IconLock style={{ width: 12, height: 12 }} />
                    Backend-provisioned
                  </span>
                }
              />
              <div className="gm-tablewrap">
                <table className="gm-table" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Role</th>
                      <th>Scopes</th>
                      <th>Last active</th>
                      <th className="gm-actions">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminTeam.map((p) => (
                      <tr key={p.email}>
                        <td>
                          <div className="gm-cell-user">
                            <Avatar initials={p.initials} gold={p.role === "Lead moderator"} />
                            <div className="gm-cell2">
                              <b>{p.name}</b>
                              <span>{p.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {p.role === "Lead moderator" ? (
                            <Badge tone="gold">{p.role}</Badge>
                          ) : p.role === "Service account" ? (
                            <Badge tone="info">{p.role}</Badge>
                          ) : (
                            <Badge tone="idle">{p.role}</Badge>
                          )}
                        </td>
                        <td className="gm-sm gm-muted">{p.scopes}</td>
                        <td className="gm-sm gm-muted gm-nowrap">{p.lastActive}</td>
                        <td className="gm-actions">
                          <button type="button" className="gm-btn gm-btn--sm gm-btn--danger">
                            Suspend
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHead title="Session security" sub="Applies to every admin account" />
              <CardBody>
                <SettingRow
                  title="Two-factor authentication"
                  hint="Required. This cannot be turned off from here."
                  control={
                    <span className="gm-badge gm-badge--ok">
                      <IconShield style={{ width: 12, height: 12 }} />
                      Enforced
                    </span>
                  }
                />
                <SettingRow
                  title="Session length"
                  hint="An idle admin session ends and has to sign in again."
                  control={
                    <select className="gm-select" style={{ width: 150 }} defaultValue="8 hours">
                      <option>2 hours</option>
                      <option>8 hours</option>
                      <option>24 hours</option>
                    </select>
                  }
                />
                <SettingRow
                  title="IP allowlist"
                  hint="Restrict the console to known office and VPN ranges."
                  control={
                    <button type="button" className="gm-btn gm-btn--sm">
                      <IconKey />
                      Manage ranges
                    </button>
                  }
                />
              </CardBody>
            </Card>
          </div>
        ) : null}

        {/* =============================================== notifications */}
        {section === "notifications" ? (
          <Card>
            <CardHead title="What reaches you" sub="Per-account. Other moderators set their own." />
            <CardBody>
              <SettingRow
                title="SLA about to breach"
                hint="Four hours before a submission goes over its 24-hour target."
                control={<Toggle checked={notifySla} onChange={setNotifySla} label="SLA warnings" />}
              />
              <SettingRow
                title="New grail-tier submission"
                hint="Anything at or above the grail floor, the moment it is filed."
                control={<Toggle checked={notifyGrail} onChange={setNotifyGrail} label="Grail submissions" />}
              />
              <SettingRow
                title="Conflict escalated to you"
                hint="A case that has passed the auto-escalate window and landed on your queue."
                control={
                  <Toggle checked={notifyEscalation} onChange={setNotifyEscalation} label="Escalations" />
                }
              />
              <SettingRow
                title="Daily digest"
                hint="One email at 08:00 with what is open, what breached, and what closed."
                control={<Toggle checked={notifyDigest} onChange={setNotifyDigest} label="Daily digest" />}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card pad>
          <div className="gm-row" style={{ gap: 10 }}>
            <IconSettings style={{ width: 16, height: 16, color: "var(--ink-4)" }} />
            <span className="gm-sm gm-muted">
              Changes here are front-end only until the admin API lands — nothing on this page is
              persisted yet.
            </span>
            <span className="gm-spacer gm-row" style={{ gap: 8 }}>
              <button type="button" className="gm-btn">
                <IconUsers />
                Audit log
              </button>
              <button type="button" className="gm-btn gm-btn--primary">
                <IconCheck />
                Save changes
              </button>
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}
