"use client";

import { useState } from "react";
import {
  bannedTerms,
  categories,
  interceptActionLabel,
  interceptTerms,
  listingFees,
  inviteStaff,
  operator,
  pendingInvites,
  revokeStaff,
  ROLES,
  roleLabel,
  scopesOf,
  serviceAccounts,
  setStaffRole,
  shortDate,
  staff,
  staffNow,
  type InterceptAction,
  type Role,
  type Staff,
  type TermAction,
} from "../lib/data";
import {
  Badge,
  Card,
  CardBody,
  CardHead,
  Modal,
  Note,
  PageHead,
  Select,
  SettingRow,
  PillTabs,
  Toast,
  Toggle,
} from "../components/ui";
import {
  IconCheck,
  IconKey,
  IconLock,
  IconMail,
  IconRefresh,
  IconSettings,
  IconShield,
  IconUsers,
} from "../components/icons";
import { Gate } from "../components/Gate";

type Section = "thresholds" | "policy" | "rules" | "fees" | "team" | "notifications";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "thresholds", label: "Review thresholds" },
  { key: "policy", label: "Marketplace policy" },
  { key: "rules", label: "Categories & word lists" },
  { key: "fees", label: "Listing fees" },
  { key: "team", label: "Team & access" },
  { key: "notifications", label: "Notifications" },
];

function SettingsPage() {
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
  const [sessionLength, setSessionLength] = useState("8 hours");

  const [pauseOnReport, setPauseOnReport] = useState(true);
  const [reportWindow, setReportWindow] = useState("14");
  const [autoEscalate, setAutoEscalate] = useState("72");
  const [strikeLimit, setStrikeLimit] = useState("3");
  const [allowRaw, setAllowRaw] = useState(false);

  /* Categories, and the two word lists. Local, like the rest of this page. */
  const [cats, setCats] = useState(() =>
    Object.fromEntries(categories.map((c) => [c.key, c.live]))
  );
  const [banned, setBanned] = useState(() => bannedTerms.map((t) => ({ ...t })));
  const [intercept, setIntercept] = useState(() => interceptTerms.map((t) => ({ ...t })));
  const [newBanned, setNewBanned] = useState("");
  const [newIntercept, setNewIntercept] = useState("");
  const [interceptOn, setInterceptOn] = useState(true);

  /* Fees. Off until they are agreed — see the note beside them. */
  /* Team changes. Session-local, and every one of them writes to the log. */
  const [writes, setWrites] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("tier-1");
  const [inviteCompany, setInviteCompany] = useState("");
  const [scoping, setScoping] = useState<Staff | null>(null);
  const [scopeRole, setScopeRole] = useState<Role>("tier-1");
  const [revoking, setRevoking] = useState<Staff | null>(null);
  const [teamWhy, setTeamWhy] = useState("");
  const [teamToast, setTeamToast] = useState<string | null>(null);

  const [feesLive, setFeesLive] = useState(listingFees.agreed);
  const [perListing, setPerListing] = useState(String(listingFees.perListing));
  const [allowance, setAllowance] = useState(String(listingFees.freeAllowance));
  const [feeFloor, setFeeFloor] = useState(String(listingFees.floor));
  const [allowanceResets, setAllowanceResets] = useState(listingFees.resets);

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
                  hint="At or above this ask price, a card is held for full manual verification: cert lookup, every photo, and provenance where the price data is thin."
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
                  hint="Checked against the grading company's register. A grade always belongs to a company, so there is no grade-only lookup."
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
              <CardHead
                title="Reports and conduct"
                sub="What happens on its own when one member reports another. No money passes through the platform, so every lever here acts on standing."
              />
              <CardBody>
                <SettingRow
                  title="Pause the reported member's listings when a case opens"
                  hint="Their live listings come off the market until the case closes. Buying and browsing are untouched. Turning this off leaves an account trading while it is under review."
                  control={<Toggle checked={pauseOnReport} onChange={setPauseOnReport} label="Pause listings on report" />}
                />
                <SettingRow
                  title="Reporting window"
                  hint="How long after a trade one member can still report the other's conduct."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={reportWindow}
                        onChange={(e) => setReportWindow(e.target.value)}
                        inputMode="numeric"
                        aria-label="Reporting window in days"
                      />
                      <span className="gm-muted">days</span>
                    </div>
                  }
                />
                <SettingRow
                  title="Auto-escalate after"
                  hint="An open case with no finding is escalated to Trust and safety at this age. Threats skip the clock and escalate on arrival."
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
                  hint="Authenticity rejections and upheld conduct cases both count. Reaching the limit opens a member review, but does not close the account on its own."
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
                {/* The commission setting that used to sit here has gone.
                    It described a take-rate on a completed sale, which is a
                    model this marketplace does not run: no money passes
                    through Grail Market, so there is nothing to take a
                    percentage of. What the platform actually charges for is
                    under Listing fees. */}
              </CardBody>
            </Card>

            <Card>
              <CardHead title="Accepted grading companies" sub="Each priced on its own scale" />
              <CardBody>
                <Note>
                  A grade is never converted between companies to reach a price. A BGS 9.5 is not a
                  PSA 10, CGC has two different 10s, and SGC legacy slabs use a 100-point scale, so
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

        {/* ======================================================= rules */}
        {section === "rules" ? (
          <div className="gm-stack">
            <Card>
              <CardHead
                title="Categories"
                sub="Turning one off stops new listings in it. Anything already live stays where it is."
              />
              <div className="gm-tablewrap">
                <table className="gm-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Accepts</th>
                      <th>Live listings</th>
                      <th className="gm-actions">Open for new</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.key}>
                        <td>
                          <b>{c.name}</b>
                        </td>
                        <td className="gm-sm gm-muted">{c.kinds.join(" · ")}</td>
                        <td className="gm-sm gm-mono">{c.listings.toLocaleString("en-US")}</td>
                        <td className="gm-actions">
                          <Toggle
                            checked={cats[c.key]}
                            onChange={(v) => setCats((x) => ({ ...x, [c.key]: v }))}
                            label={`${c.name} open for new listings`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHead
                title="Banned terms"
                sub="Matched against a listing's title and description. Block refuses the listing outright; flag sends it to a moderator."
              />
              <CardBody>
                <div className="gm-row" style={{ gap: 8, marginBottom: 12, flexWrap: "nowrap" }}>
                  <input
                    className="gm-input"
                    style={{ flex: "1 1 auto" }}
                    value={newBanned}
                    onChange={(e) => setNewBanned(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newBanned.trim()) {
                        e.preventDefault();
                        setBanned((b) => [
                          { term: newBanned.trim().toLowerCase(), action: "flag" as TermAction, reason: "Added from settings.", hits: 0 },
                          ...b,
                        ]);
                        setNewBanned("");
                      }
                    }}
                    placeholder="Add a term. It matches anywhere in the text"
                    aria-label="Add a banned term"
                  />
                  <button
                    type="button"
                    className="gm-btn gm-btn--sm"
                    disabled={!newBanned.trim()}
                    onClick={() => {
                      setBanned((b) => [
                        { term: newBanned.trim().toLowerCase(), action: "flag" as TermAction, reason: "Added from settings.", hits: 0 },
                        ...b,
                      ]);
                      setNewBanned("");
                    }}
                  >
                    Add
                  </button>
                </div>

                <div className="gm-tablewrap">
                  <table className="gm-table" style={{ minWidth: 760 }}>
                    <thead>
                      <tr>
                        <th style={{ width: "22%" }}>Term</th>
                        <th>Why it is on the list</th>
                        <th style={{ width: "12%" }}>30d hits</th>
                        <th style={{ width: "18%" }}>Action</th>
                        <th className="gm-actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {banned.map((t, i) => (
                        <tr key={t.term}>
                          <td className="gm-mono gm-sm">{t.term}</td>
                          <td className="gm-sm gm-muted">{t.reason}</td>
                          <td className="gm-sm gm-mono">
                            {t.hits === 0 ? <span className="gm-dim">never</span> : t.hits}
                          </td>
                          <td>
                            <Select
                              value={t.action}
                              onChange={(v) =>
                                setBanned((b) =>
                                  b.map((x, j) => (j === i ? { ...x, action: v as TermAction } : x))
                                )
                              }
                              ariaLabel={`Action for ${t.term}`}
                              options={[
                                { value: "block", label: "Block" },
                                { value: "flag", label: "Flag" },
                              ]}
                            />
                          </td>
                          <td className="gm-actions">
                            <button
                              type="button"
                              className="gm-btn gm-btn--sm gm-btn--ghost"
                              onClick={() => setBanned((b) => b.filter((_, j) => j !== i))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Off-platform chat interceptor"
                sub="Matched against member-to-member messages"
                right={
                  <Toggle
                    checked={interceptOn}
                    onChange={setInterceptOn}
                    label="Interceptor on"
                  />
                }
              />
              <CardBody>
                <Note tone="gold">
                  <b>This is the highest-harm thing that happens in messages.</b> A sale taken
                  off-platform loses the identity check on both sides, and once it is gone there is
                  nothing anyone on this desk can do about it. No money passed through us, so there
                  is nothing to reverse and nobody to hold. The list matches words rather than
                  intent, so it over-matches on purpose. Most of it only warns the sender, and only
                  the payment rails hold a message for a person to read.
                </Note>

                <div className="gm-row" style={{ gap: 8, margin: "12px 0", flexWrap: "nowrap" }}>
                  <input
                    className="gm-input"
                    style={{ flex: "1 1 auto" }}
                    value={newIntercept}
                    onChange={(e) => setNewIntercept(e.target.value)}
                    placeholder="Add a phrase: a payment app, a contact detail, or a way of asking"
                    aria-label="Add an intercepted phrase"
                  />
                  <button
                    type="button"
                    className="gm-btn gm-btn--sm"
                    disabled={!newIntercept.trim()}
                    onClick={() => {
                      setIntercept((t) => [
                        { term: newIntercept.trim().toLowerCase(), action: "warn" as InterceptAction, group: "intent" as const, hits: 0 },
                        ...t,
                      ]);
                      setNewIntercept("");
                    }}
                  >
                    Add
                  </button>
                </div>

                <div className="gm-tablewrap">
                  <table className="gm-table" style={{ minWidth: 760 }}>
                    <thead>
                      <tr>
                        <th style={{ width: "28%" }}>Phrase</th>
                        <th style={{ width: "16%" }}>Group</th>
                        <th style={{ width: "14%" }}>30d hits</th>
                        <th style={{ width: "26%" }}>What happens</th>
                        <th className="gm-actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {intercept.map((t, i) => (
                        <tr key={t.term} style={interceptOn ? undefined : { opacity: 0.5 }}>
                          <td className="gm-mono gm-sm">{t.term}</td>
                          <td className="gm-sm gm-muted">
                            <span className="gm-scope">{t.group}</span>
                          </td>
                          <td className="gm-sm gm-mono">{t.hits}</td>
                          <td>
                            <Select
                              value={t.action}
                              onChange={(v) =>
                                setIntercept((x) =>
                                  x.map((y, j) =>
                                    j === i ? { ...y, action: v as InterceptAction } : y
                                  )
                                )
                              }
                              ariaLabel={`Action for ${t.term}`}
                              options={(
                                ["warn", "hold", "escalate"] as InterceptAction[]
                              ).map((a) => ({ value: a, label: interceptActionLabel[a] }))}
                            />
                          </td>
                          <td className="gm-actions">
                            <button
                              type="button"
                              className="gm-btn gm-btn--sm gm-btn--ghost"
                              onClick={() => setIntercept((x) => x.filter((_, j) => j !== i))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        ) : null}

        {/* ======================================================== fees */}
        {section === "fees" ? (
          <div className="gm-stack">
            <Note tone={feesLive ? "warn" : "gold"}>
              {feesLive ? (
                <>
                  <b>Fees are live.</b> Every listing past the allowance is charged at the rate
                  below. Turning this on is a commercial decision, not a settings change.
                </>
              ) : (
                <>
                  <b>Nothing is charged for a listing today.</b> The brief says these are settled
                  &ldquo;once they are agreed&rdquo;, and they have not been. The numbers are here,
                  editable, and switched off until somebody decides them.
                </>
              )}
            </Note>

            <Card>
              <CardHead
                title="Listing fees"
                sub="What a member pays to put a card on the market, over and above their plan"
                right={
                  <Toggle checked={feesLive} onChange={setFeesLive} label="Fees are live" />
                }
              />
              <CardBody>
                <SettingRow
                  title="Free-listing allowance"
                  hint="Listings a member can publish before a fee applies. Their plan quota still caps how many can be live at once. This is about how many they may create."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={allowance}
                        onChange={(e) => setAllowance(e.target.value)}
                        inputMode="numeric"
                        aria-label="Free listing allowance"
                      />
                      <span className="gm-muted">free</span>
                    </div>
                  }
                />
                <SettingRow
                  title="Allowance resets"
                  hint="Monthly is the usual shape. Once means it is a one-time grant to a new account and never comes back."
                  control={
                    <Select
                      value={allowanceResets}
                      onChange={(v) => setAllowanceResets(v as "monthly" | "once")}
                      ariaLabel="How the allowance resets"
                      options={[
                        { value: "monthly", label: "Every month" },
                        { value: "once", label: "Once per account" },
                      ]}
                    />
                  }
                />
                <SettingRow
                  title="Fee per listing"
                  hint="Charged on each listing past the allowance, when it is published rather than when it sells."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <span className="gm-muted">A$</span>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={perListing}
                        onChange={(e) => setPerListing(e.target.value)}
                        inputMode="decimal"
                        aria-label="Fee per listing in AUD"
                      />
                    </div>
                  }
                />
                <SettingRow
                  title="Fee floor"
                  hint="No fee is charged below this ask price, so a small listing does not carry a fee worth most of the card."
                  control={
                    <div className="gm-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <span className="gm-muted">A$</span>
                      <input
                        className="gm-input gm-mono"
                        style={{ width: 84, textAlign: "right" }}
                        value={feeFloor}
                        onChange={(e) => setFeeFloor(e.target.value)}
                        inputMode="numeric"
                        aria-label="Fee floor in AUD"
                      />
                    </div>
                  }
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead title="What this is not" />
              <CardBody>
                <p className="gm-sm gm-muted" style={{ margin: 0 }}>
                  There is no commission and no take rate. Grail Market is not in the middle of a
                  sale, since the two members settle it between themselves, so there is no
                  percentage to take and nothing to hold back. Everything the platform earns is a
                  subscription, a boost, or a listing fee, all of which are charged to the seller
                  directly and none of which touch the trade.
                </p>
              </CardBody>
            </Card>
          </div>
        ) : null}

        {/* ======================================================== team */}
        {section === "team" ? (
          <div className="gm-stack">
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
                      <th style={{ width: "20%" }}>Role</th>
                      <th style={{ width: "18%" }}>Who holds it</th>
                      <th>Sees</th>
                      <th style={{ width: "12%" }}>Accounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map((r) => {
                      const held = staff.filter((p) => p.role === r.key);
                      return (
                        <tr key={r.key}>
                          <td>
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
                sub={`${staff.length} people, each on one of the five roles`}
                right={
                  <button
                    type="button"
                    className="gm-btn gm-btn--sm gm-btn--primary"
                    onClick={() => {
                      setInviteEmail("");
                      setInviteCompany("");
                      setInviteRole("tier-1");
                      setInviting(true);
                    }}
                  >
                    <IconMail />
                    Invite
                  </button>
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
                    {staff.map((raw) => {
                      const p = staffNow(raw);
                      return (
                      <tr key={p.email} style={p.status === "revoked" ? { opacity: 0.5 } : undefined}>
                        <td>
                          <div className="gm-cell-user">
                            <div className="gm-cell2">
                              <b>{p.name}</b>
                              <span>{p.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {p.role === "owner" ? (
                            <Badge tone="gold">{roleLabel(p.role)}</Badge>
                          ) : (
                            <Badge tone="idle">{roleLabel(p.role)}</Badge>
                          )}
                          {p.outsourced ? (
                            <span className="gm-scope" style={{ marginLeft: 6 }}>
                              Outsourced
                            </span>
                          ) : null}
                        </td>
                        <td className="gm-sm gm-muted">{scopesOf(p.role).join(" · ")}</td>
                        <td className="gm-sm gm-muted gm-nowrap">{p.lastActive}</td>
                        <td className="gm-actions">
                          {p.status === "revoked" ? (
                            <Badge tone="bad">Revoked</Badge>
                          ) : (
                            <div className="gm-row" style={{ gap: 6, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="gm-btn gm-btn--sm"
                                onClick={() => {
                                  setScoping(raw);
                                  setScopeRole(p.role);
                                  setTeamWhy("");
                                }}
                              >
                                Scope
                              </button>
                              <button
                                type="button"
                                className="gm-btn gm-btn--sm gm-btn--danger"
                                onClick={() => {
                                  setRevoking(raw);
                                  setTeamWhy("");
                                }}
                              >
                                Revoke
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {pendingInvites().length > 0 ? (
              <Card>
                <CardHead
                  title="Invited, not yet accepted"
                  sub="An invite is not an account. It becomes one when they accept and set up 2FA."
                />
                <div className="gm-tablewrap">
                  <table className="gm-table" style={{ minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Invited by</th>
                        <th className="gm-nowrap">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInvites().map((i) => (
                        <tr key={i.id}>
                          <td className="gm-mono gm-sm">{i.email}</td>
                          <td>
                            <Badge tone="idle">{roleLabel(i.role)}</Badge>
                            {i.company ? (
                              <span className="gm-scope" style={{ marginLeft: 6 }}>
                                {i.company}
                              </span>
                            ) : null}
                          </td>
                          <td className="gm-sm gm-muted">{i.invitedBy}</td>
                          <td className="gm-sm gm-muted gm-nowrap">{shortDate(i.at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            {/* ------------------------------------------- service accounts

                Kept apart from the table above on purpose. These hold a key,
                not a role, and folding them in meant giving one of the five
                to a machine — which is how a reporting bot ends up counted
                as an Owner.
            */}
            <Card>
              <CardHead
                title="Service accounts"
                sub="Machines. No role, no sign-in, and a scope written out rather than inherited."
              />
              <div className="gm-tablewrap">
                <table className="gm-table" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Purpose</th>
                      <th>Scope</th>
                      <th>Last used</th>
                      <th className="gm-actions">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceAccounts.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="gm-cell-user">
                            <div className="gm-cell2">
                              <b>{a.name}</b>
                              <span>{a.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="gm-sm gm-muted">{a.purpose}</td>
                        <td>
                          <div className="gm-person-tags">
                            {a.scopes.map((sc) => (
                              <span key={sc} className="gm-scope">
                                {sc}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="gm-sm gm-muted gm-nowrap">{a.lastActive}</td>
                        <td className="gm-actions">
                          <button type="button" className="gm-btn gm-btn--sm gm-btn--danger">
                            Revoke key
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
                    <Select
                      width={150}
                      value={sessionLength}
                      onChange={setSessionLength}
                      ariaLabel="Session length"
                      options={["2 hours", "8 hours", "24 hours"]}
                    />
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
              Nothing on this page is saved yet. It takes effect once the admin system behind it
              is built.
            </span>
            <span className="gm-spacer gm-row" style={{ gap: 8 }}>
              <a className="gm-btn" href="/admin/audit">
                <IconUsers />
                Audit log
              </a>
              <button type="button" className="gm-btn gm-btn--primary">
                <IconCheck />
                Save changes
              </button>
            </span>
          </div>
        </Card>
      </div>

      {/* ===================================================== invite */}
      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite a staff account"
        sub="They get an email. The account exists once they accept and set up two-factor, not before."
        footer={
          <>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={!inviteEmail.includes("@")}
              onClick={() => {
                inviteStaff(
                  inviteEmail.trim(),
                  inviteRole,
                  operator.name,
                  inviteCompany.trim() || undefined
                );
                setInviting(false);
                setWrites((n) => n + 1);
                setTeamToast(`Invite sent to ${inviteEmail.trim()}`);
              }}
            >
              <IconMail />
              Send invite
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setInviting(false)}>
              Cancel
            </button>
            <span className="gm-spacer gm-tiny gm-dim">Written to the audit log</span>
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
              disabled={!scoping || teamWhy.trim().length < 6 || scopeRole === staffNow(scoping).role}
              onClick={() => {
                if (!scoping) return;
                setStaffRole(scoping, scopeRole, operator.name, teamWhy.trim());
                setTeamToast(`${scoping.name} is now ${roleLabel(scopeRole)}`);
                setScoping(null);
                setWrites((n) => n + 1);
              }}
            >
              <IconCheck />
              Apply
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setScoping(null)}>
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
              className="gm-btn gm-btn--danger"
              disabled={teamWhy.trim().length < 6}
              onClick={() => {
                if (!revoking) return;
                revokeStaff(revoking, operator.name, teamWhy.trim());
                setTeamToast(`${revoking.name} revoked`);
                setRevoking(null);
                setWrites((n) => n + 1);
              }}
            >
              <IconLock />
              Revoke access
            </button>
            <button type="button" className="gm-btn gm-btn--ghost" onClick={() => setRevoking(null)}>
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
        <Toast title="Team updated" body={`${teamToast} · written to the audit log`} onDone={() => setTeamToast(null)} />
      ) : null}
    </>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedSettingsPage() {
  return (
    <Gate need="settings.write">
      <SettingsPage />
    </Gate>
  );
}
