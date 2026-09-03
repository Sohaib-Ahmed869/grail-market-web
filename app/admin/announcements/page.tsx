"use client";

import { useMemo, useState } from "react";
import {
  allAnnouncements,
  bannerToneLabel,
  liveBanner,
  members,
  operator,
  scheduleAnnouncement,
  segments,
  shortDate,
  type AnnouncementChannel,
  type BannerTone,
} from "../lib/data";
import {
  Badge,
  BlockHead,
  Card,
  CardBody,
  CardHead,
  DL,
  Empty,
  Note,
  PageHead,
  PillTabs,
  Select,
  Toast,
  Toggle,
} from "../components/ui";
import {
  IconAlert,
  IconBell,
  IconCalendar,
  IconMail,
  IconSend,
} from "../components/icons";
import { Gate } from "../components/Gate";

type Tab = "compose" | "scheduled" | "history";

/**
 * The handset preview.
 *
 * A push notification is read on a lock screen in a second and a half, at
 * about 40 characters before it truncates — which is not something anyone
 * judges correctly from a textarea. The frame is deliberately to scale and
 * the truncation is real, so a title that will be cut shows as cut here.
 */
function Handset({
  channel,
  title,
  body,
  tone,
}: {
  channel: AnnouncementChannel;
  title: string;
  body: string;
  tone: BannerTone;
}) {
  const toneColor =
    tone === "outage" ? "var(--bad)" : tone === "policy" ? "var(--gold)" : "var(--navy-500)";

  return (
    <div
      style={{
        width: 264,
        /* a picture of a handset, not a UI surface, so it is outside the scale */
        borderRadius: 30,
        border: "9px solid var(--ink)",
        background: "linear-gradient(160deg, #2b3a55, #16202f)",
        padding: "16px 12px 22px",
        boxShadow: "var(--sh-4)",
        flex: "none",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,.75)",
          fontSize: 10,
          textAlign: "center",
          marginBottom: 4,
        }}
      >
        Grail Market
      </div>
      <div
        style={{
          color: "#fff",
          fontSize: 34,
          fontWeight: 300,
          textAlign: "center",
          letterSpacing: "-0.02em",
          marginBottom: 14,
        }}
      >
        9:41
      </div>

      {channel === "banner" ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            minHeight: 132,
          }}
        >
          <div style={{ height: 4, background: toneColor }} />
          <div style={{ padding: "10px 11px" }}>
            <div
              style={{
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                color: toneColor,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {bannerToneLabel[tone]}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#101828", marginBottom: 4 }}>
              {title || "Untitled"}
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.45, color: "#475467" }}>
              {body || "No message yet."}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "rgba(255,255,255,.92)",
            borderRadius: "var(--r-md)",
            padding: "9px 11px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="gm-row" style={{ gap: 6, marginBottom: 3, flexWrap: "nowrap" }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "var(--r-xs)",
                background: "var(--navy-500)",
                flex: "none",
              }}
            />
            <span
              style={{
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: "#667085",
                fontWeight: 600,
              }}
            >
              Grail Market · now
            </span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#101828" }}>
            {(title || "Untitled").slice(0, 40)}
            {title.length > 40 ? "…" : ""}
          </div>
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.4,
              color: "#475467",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {body || "No message yet."}
          </div>
        </div>
      )}
    </div>
  );
}

function AnnouncementsPage() {
  const [tab, setTab] = useState<Tab>("compose");
  const [writes, setWrites] = useState(0);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<BannerTone>("info");
  const [audience, setAudience] = useState("all");
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [banner, setBanner] = useState(false);
  const [when, setWhen] = useState("now");
  const [at, setAt] = useState("2026-09-05T09:00");
  const [toast, setToast] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => allAnnouncements(), [writes]);
  const scheduled = all.filter((a) => a.state === "scheduled");
  const sent = all.filter((a) => a.state === "sent" || a.state === "live");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const live = useMemo(() => liveBanner(), [writes]);

  const seg = segments.find((s) => s.key === audience);
  const reach = useMemo(
    () => (audience === "all" ? members.length : members.filter((m) => seg?.match(m)).length),
    [audience, seg]
  );

  const channels: AnnouncementChannel[] = [
    ...(push ? (["push"] as const) : []),
    ...(email ? (["email"] as const) : []),
    ...(banner ? (["banner"] as const) : []),
  ];

  /* What the preview shows. A banner is the thing worth checking hardest, so
     it wins the frame when it is on. */
  const previewChannel: AnnouncementChannel = banner ? "banner" : push ? "push" : "email";

  const ready = title.trim().length > 3 && body.trim().length > 10 && channels.length > 0;

  function send() {
    scheduleAnnouncement({
      title: title.trim(),
      body: body.trim(),
      channels,
      audience,
      tone,
      state: when === "now" ? (banner ? "live" : "sent") : "scheduled",
      at: when === "now" ? new Date().toISOString() : new Date(at).toISOString(),
      by: operator.name,
      reach: when === "now" ? reach : undefined,
    });
    setToast(
      when === "now"
        ? `Sent to ${reach.toLocaleString("en-US")} · ${channels.join(" + ")}`
        : `Scheduled for ${new Date(at).toLocaleString("en-GB")} · ${reach.toLocaleString("en-US")} recipients`
    );
    setTitle("");
    setBody("");
    setWrites((n) => n + 1);
  }

  return (
    <>
      <PageHead
        title="Announcements"
        sub="Broadcast push and email, the in-app banner, and anything queued to go out later."
      />

      <div className="gm-stack">
        {live ? (
          <Note tone={live.tone === "outage" ? "bad" : "warn"}>
            <b>A banner is live in the app right now.</b> &ldquo;{live.title}&rdquo;, up since{" "}
            {shortDate(live.at)}
            {live.until ? `, down automatically ${shortDate(live.until)}` : ""}. Only one runs at a
            time, so anything new replaces it.
          </Note>
        ) : null}

        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { key: "compose", label: "Compose" },
            { key: "scheduled", label: "Scheduled", count: scheduled.length },
            { key: "history", label: "Sent", count: sent.length },
          ]}
        />

        {/* ================================================= compose */}
        {tab === "compose" ? (
          <div className="gm-row" style={{ gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="gm-stack" style={{ flex: "1 1 420px", minWidth: 320 }}>
              <Card>
                <CardHead title="Message" sub="Written once, shown on every channel you pick." />
                <CardBody>
                  <div className="gm-field">
                    <label className="gm-label" htmlFor="an-title">
                      Title
                    </label>
                    <input
                      id="an-title"
                      className="gm-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Short. It is read on a lock screen."
                    />
                    <span className="gm-hint">
                      {title.length}/40 before a push notification truncates
                      {title.length > 40 ? ". The preview shows where it cuts." : ""}
                    </span>
                  </div>

                  <div className="gm-field">
                    <label className="gm-label" htmlFor="an-body">
                      Message
                    </label>
                    <textarea
                      id="an-body"
                      className="gm-textarea"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="What happened, what it means for them, and what happens next."
                    />
                    <span className="gm-hint">
                      No prices or figures in a broadcast. They are out of date by the time it lands.
                    </span>
                  </div>

                  <div className="gm-field">
                    <label className="gm-label" htmlFor="an-tone">
                      Kind
                    </label>
                    <Select
                      id="an-tone"
                      value={tone}
                      onChange={(v) => setTone(v as BannerTone)}
                      options={[
                        { value: "info", label: "Information" },
                        { value: "outage", label: "Outage" },
                        { value: "policy", label: "Policy change" },
                      ]}
                      style={{ width: "100%" }}
                    />
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHead title="Where it goes" />
                <CardBody>
                  <div className="gm-setrow">
                    <div className="gm-setrow-main">
                      <b>Push notification</b>
                      <span>Arrives now, gone once it is swiped away.</span>
                    </div>
                    <div className="gm-setrow-ctl">
                      <Toggle checked={push} onChange={setPush} label="Push" />
                    </div>
                  </div>
                  <div className="gm-setrow">
                    <div className="gm-setrow-main">
                      <b>Email</b>
                      <span>Readable later. The only channel that counts as having told someone.</span>
                    </div>
                    <div className="gm-setrow-ctl">
                      <Toggle checked={email} onChange={setEmail} label="Email" />
                    </div>
                  </div>
                  <div className="gm-setrow">
                    <div className="gm-setrow-main">
                      <b>In-app banner</b>
                      <span>Stays until it is taken down. One at a time, across the whole app.</span>
                    </div>
                    <div className="gm-setrow-ctl">
                      <Toggle checked={banner} onChange={setBanner} label="Banner" />
                    </div>
                  </div>

                  {tone === "policy" && !email ? (
                    <Note tone="warn">
                      <b>A policy change needs email.</b> A push gets swiped away and a banner
                      comes down, so neither one shows the member was told.
                    </Note>
                  ) : null}

                  <div className="gm-field" style={{ marginTop: 12 }}>
                    <label className="gm-label" htmlFor="an-aud">
                      Audience
                    </label>
                    <Select
                      id="an-aud"
                      value={audience}
                      onChange={setAudience}
                      options={segments.map((x) => ({ value: x.key, label: x.label }))}
                      style={{ width: "100%" }}
                    />
                    <span className="gm-hint">
                      {seg?.detail} <b>{reach.toLocaleString("en-US")}</b> of {members.length}{" "}
                      members.
                    </span>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHead title="When" />
                <CardBody>
                  <div className="gm-field">
                    <Select
                      value={when}
                      onChange={setWhen}
                      ariaLabel="When to send"
                      options={[
                        { value: "now", label: "Send now" },
                        { value: "later", label: "Schedule it" },
                      ]}
                      style={{ width: "100%" }}
                    />
                  </div>
                  {when === "later" ? (
                    <div className="gm-field">
                      <label className="gm-label" htmlFor="an-at">
                        Goes out
                      </label>
                      <input
                        id="an-at"
                        type="datetime-local"
                        className="gm-input"
                        value={at}
                        onChange={(e) => setAt(e.target.value)}
                      />
                      <span className="gm-hint">
                        Local time. A scheduled send can be cancelled up until it goes.
                      </span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="gm-btn gm-btn--primary"
                    style={{ marginTop: 6 }}
                    disabled={!ready}
                    onClick={send}
                  >
                    {when === "now" ? <IconSend /> : <IconCalendar />}
                    {when === "now"
                      ? `Send to ${reach.toLocaleString("en-US")}`
                      : `Schedule for ${reach.toLocaleString("en-US")}`}
                  </button>
                </CardBody>
              </Card>
            </div>

            {/* the preview */}
            <div className="gm-stack" style={{ flex: "0 0 auto", gap: 10 }}>
              <div className="gm-label">Preview</div>
              <Handset channel={previewChannel} title={title} body={body} tone={tone} />
              <p className="gm-tiny gm-dim" style={{ maxWidth: 264, margin: 0 }}>
                {previewChannel === "banner"
                  ? "In-app banner, as it sits above the feed."
                  : "Lock screen, at the size it actually arrives. Titles cut at 40 characters and the body at two lines."}
              </p>
            </div>
          </div>
        ) : null}

        {/* =============================================== scheduled */}
        {tab === "scheduled" ? (
          scheduled.length === 0 ? (
            <Card>
              <Empty icon={<IconCalendar />} title="Nothing queued" body="Compose one to schedule it." />
            </Card>
          ) : (
            <>
              <BlockHead title="Queued to go out" sub={`${scheduled.length} waiting`} />
              <div className="gm-stack" style={{ gap: 10 }}>
                {scheduled.map((a) => (
                  <Card key={a.id} pad>
                    <div className="gm-row" style={{ gap: 12, flexWrap: "nowrap", alignItems: "flex-start" }}>
                      <span className="gm-feed-ico gm-feed-ico--gold" style={{ flex: "none" }}>
                        <IconCalendar />
                      </span>
                      <div className="gm-cell2" style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <b>{a.title}</b>
                        <span>{a.body}</span>
                        <span className="gm-tiny gm-dim" style={{ marginTop: 5 }}>
                          {a.channels.join(" + ")} ·{" "}
                          {a.audience === "all" ? "everyone" : a.audience} · by {a.by}
                        </span>
                      </div>
                      <div className="gm-row" style={{ gap: 7, flex: "none" }}>
                        <Badge tone="warn">{shortDate(a.at)}</Badge>
                        <button type="button" className="gm-btn gm-btn--sm gm-btn--ghost">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )
        ) : null}

        {/* ================================================= history */}
        {tab === "history" ? (
          <>
            <BlockHead title="Already out" sub={`${sent.length} sent or live`} />
            <Card>
              <div className="gm-tablewrap">
                <table className="gm-table" style={{ minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th>Announcement</th>
                      <th>Channels</th>
                      <th>Audience</th>
                      <th>Reach</th>
                      <th className="gm-nowrap">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sent.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="gm-cell2">
                            <b>{a.title}</b>
                            <span>{bannerToneLabel[a.tone]}</span>
                          </div>
                        </td>
                        <td className="gm-sm gm-muted">
                          <div className="gm-person-tags">
                            {a.channels.map((c) => (
                              <span key={c} className="gm-scope">
                                {c === "push" ? <IconBell /> : c === "email" ? <IconMail /> : <IconAlert />}
                                &nbsp;{c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="gm-sm gm-muted">
                          {a.audience === "all" ? "Everyone" : a.audience}
                        </td>
                        <td className="gm-sm gm-mono gm-nowrap">
                          {a.reach ? a.reach.toLocaleString("en-US") : "None"}
                        </td>
                        <td className="gm-sm gm-muted gm-nowrap">
                          {a.state === "live" ? <Badge tone="ok">Live now</Badge> : shortDate(a.at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}
      </div>

      {toast ? <Toast title="Announcement" body={toast} onDone={() => setToast(null)} /> : null}
    </>
  );
}

/* Access is decided before the page renders, not inside it — see the
   warning in RoleContext about what this gate is and is not. */
export default function GatedAnnouncementsPage() {
  return (
    <Gate need="announce.write">
      <AnnouncementsPage />
    </Gate>
  );
}
