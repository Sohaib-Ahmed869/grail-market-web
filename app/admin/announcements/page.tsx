"use client";

import { useEffect, useMemo, useState } from "react";
import { bannerToneLabel, shortDate } from "../lib/data";
import {
  ApiError,
  createAnnouncement,
  fetchAnnouncements,
  setAnnouncementState,
  type Announcement,
  type AnnouncementChannel,
  type Audience,
  type BannerTone,
} from "../lib/api";
import {
  Badge,
  BlockHead,
  Card,
  CardBody,
  CardHead,
  Empty,
  SectionTabs,
  Loading,
  Note,
  PageHead,
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

type View = "compose" | "scheduled" | "history";

/** The segment keys the API knows, with the words the console uses for them.
 *  The API owns the membership rule; this owns how it reads on screen. */
const SEGMENT_LABEL: Record<string, string> = {
  all: "Everyone",
  lapsed: "Lapsed",
  "never-listed": "Never listed",
  unverified: "Stuck in verification",
  billing: "Billing needs attention",
};

const SEGMENT_DETAIL: Record<string, string> = {
  all: "Every account in the directory.",
  lapsed: "Not seen in 60 days or more, and not revoked.",
  "never-listed": "Has never published a listing, however long they have been here.",
  unverified: "Started the verification funnel and never came out of it.",
  billing: "Payment failed or the subscription was cancelled.",
};

const seg = (k: string) => SEGMENT_LABEL[k] ?? k;

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
  const [view, setView] = useState<View>("compose");
  const [writes, setWrites] = useState(0);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<BannerTone>("info");
  const [audience, setAudience] = useState("all");
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [banner, setBanner] = useState(false);
  const [when, setWhen] = useState("now");
  const [at, setAt] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Everything from the API. This page used to keep its history in a
     module-level array, which meant a send vanished on reload and two tabs of
     the console disagreed about what had gone out. */
  const [all, setAll] = useState<Announcement[]>([]);
  const [live, setLive] = useState<Announcement | null>(null);
  const [segments, setSegments] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAnnouncements()
      .then((r) => {
        if (!alive) return;
        setAll(r.announcements);
        setLive(r.banner);
        setSegments(r.segments);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [writes]);

  const scheduled = all.filter((a) => a.state === "scheduled");
  const sent = all.filter((a) => a.state === "sent" || a.state === "live");

  const reach = segments.find((s) => s.key === audience)?.reach ?? null;
  const everyone = segments.find((s) => s.key === "all")?.reach ?? null;

  const channels: AnnouncementChannel[] = [
    ...(push ? (["push"] as const) : []),
    ...(email ? (["email"] as const) : []),
    ...(banner ? (["banner"] as const) : []),
  ];

  /* What the preview shows. A banner is the thing worth checking hardest, so
     it wins the frame when it is on. */
  const previewChannel: AnnouncementChannel = banner ? "banner" : push ? "push" : "email";

  const ready = title.trim().length > 3 && body.trim().length > 10 && channels.length > 0;

  /* A default an hour out, set on the client so it is in the operator's own
     time zone rather than a date typed into the source a year ago. */
  useEffect(() => {
    if (at) return;
    const t = new Date(Date.now() + 3_600_000);
    t.setSeconds(0, 0);
    setAt(new Date(t.getTime() - t.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
  }, [at]);

  const headCount = (n: number | null) => (n === null ? "an unknown number" : n.toLocaleString("en-AU"));

  async function send() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const a = await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        channels,
        audience,
        tone,
        when: when === "now" ? "now" : "later",
        at: when === "later" ? new Date(at).toISOString() : undefined,
      });
      setTitle("");
      setBody("");
      setWrites((n) => n + 1);
      setView(when === "now" ? "history" : "scheduled");
      setToast(
        when === "now"
          ? `Recorded against ${headCount(a.reach ?? null)} accounts · ${a.channels.join(" + ")}`
          : `Queued for ${new Date(a.at).toLocaleString("en-GB")}`,
      );
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pull(a: Announcement, state: "cancelled" | "taken-down") {
    try {
      await setAnnouncementState(a.id, state);
      setWrites((n) => n + 1);
      setToast(state === "cancelled" ? `${a.title} · cancelled` : `${a.title} · banner down`);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    }
  }

  const VIEWS: { value: View; label: string; count?: number }[] = useMemo(
    () => [
      { value: "compose", label: "Compose" },
      { value: "scheduled", label: "Queued", count: scheduled.length },
      { value: "history", label: "Already out", count: sent.length },
    ],
    [scheduled.length, sent.length],
  );

  const heading = VIEWS.find((v) => v.value === view)!;

  return (
    <>
      <PageHead
        title="Announcements"
        sub="Broadcast push and email, the in-app banner, and anything queued to go out later."
      />

      <div className="gm-stack">
        {error ? (
          <Note tone="bad">
            <b>Announcements could not be read.</b> {error}
          </Note>
        ) : null}

        {/* Said once, at the top, and true of every row below it: this
            console records a broadcast, it does not dispatch one. The page
            claiming otherwise would be a claim that members were told
            something they were not. */}
        <Note tone="warn">
          <b>Nothing is dispatched yet.</b> Push and email both need a provider that is not
          wired, so a send here records what went to whom and raises the in-app banner. Every
          row says whether it was actually delivered.
        </Note>

        {live ? (
          <Note tone={live.tone === "outage" ? "bad" : "warn"}>
            <b>A banner is live in the app right now.</b> &ldquo;{live.title}&rdquo;, up since{" "}
            {shortDate(live.at)}
            {live.until ? `, down automatically ${shortDate(live.until)}` : ""}. Only one runs at a
            time, so anything new replaces it.{" "}
            <button
              type="button"
              className="gm-btn gm-btn--sm gm-btn--ghost"
              onClick={() => pull(live, "taken-down")}
            >
              Take it down
            </button>
          </Note>
        ) : null}

{/* Composing, the queue and the history are three different things
            with no "everything" between them, so the switch stays on screen. */}
        <SectionTabs
          value={view}
          onChange={setView}
          options={VIEWS.map((v) => ({ key: v.value, label: v.label, count: v.count }))}
        />

        <BlockHead
          title={heading.label}
          sub={
            view === "compose"
              ? "Written once, shown on every channel you pick."
              : view === "scheduled"
                ? `${scheduled.length} waiting to go out`
                : `${sent.length} sent or live`
          }
        />

        {/* ================================================= compose */}
        {view === "compose" ? (
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
                      options={segments.map((x) => ({ value: x.key, label: seg(x.key) }))}
                      style={{ width: "100%" }}
                    />
                    <span className="gm-hint">
                      {SEGMENT_DETAIL[audience] ?? ""}{" "}
                      {/* A count the API could not work out is not zero people. */}
                      {reach === null ? (
                        <b>Could not count this segment.</b>
                      ) : (
                        <>
                          <b>{reach.toLocaleString("en-AU")}</b>
                          {everyone !== null ? ` of ${everyone.toLocaleString("en-AU")}` : ""}{" "}
                          accounts.
                        </>
                      )}
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
                    disabled={!ready || busy}
                    onClick={send}
                  >
                    {when === "now" ? <IconSend /> : <IconCalendar />}
                    {busy
                      ? "Recording…"
                      : when === "now"
                        ? `Send to ${headCount(reach)}`
                        : `Schedule for ${headCount(reach)}`}
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
        {view === "scheduled" ? (
          loading && all.length === 0 ? (
            <Card>
              <Loading label="Reading the queue…" />
            </Card>
          ) : scheduled.length === 0 ? (
            <Card>
              <Empty icon={<IconCalendar />} title="Nothing queued" body="Compose one to schedule it." />
            </Card>
          ) : (
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
                        {a.channels.join(" + ")} · {seg(a.audience)} · by {a.by}
                      </span>
                    </div>
                    <div className="gm-row" style={{ gap: 7, flex: "none" }}>
                      <Badge tone="warn">{shortDate(a.at)}</Badge>
                      <button
                        type="button"
                        className="gm-btn gm-btn--sm gm-btn--ghost"
                        onClick={() => pull(a, "cancelled")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : null}

        {/* ================================================= history */}
        {view === "history" ? (
          <Card>
            {loading && all.length === 0 ? (
              <Loading label="Reading the history…" />
            ) : sent.length === 0 ? (
              <Empty
                icon={<IconSend />}
                title="Nothing has gone out"
                body="Broadcasts appear here once they are sent or the banner is raised."
              />
            ) : (
              <div className="gm-tablewrap">
                <table className="gm-table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Announcement</th>
                      <th>Channels</th>
                      <th>Audience</th>
                      <th>Addressed to</th>
                      <th>Delivered</th>
                      <th className="gm-nowrap">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sent.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="gm-cell2">
                            <b>{a.title}</b>
                            <span>
                              {bannerToneLabel[a.tone]} · by {a.by}
                            </span>
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
                        <td className="gm-sm gm-muted">{seg(a.audience)}</td>
                        <td className="gm-sm gm-mono gm-nowrap">
                          {a.reach === undefined ? "Not counted" : a.reach.toLocaleString("en-AU")}
                        </td>
                        <td>
                          {/* The column that stops this table implying more
                              than happened. A banner genuinely is up; a push
                              recorded against 5,000 accounts is not a push
                              5,000 people received. */}
                          {a.delivered ? (
                            <Badge tone="ok">Delivered</Badge>
                          ) : a.state === "live" ? (
                            <Badge tone="ok">Banner is up</Badge>
                          ) : (
                            <Badge tone="warn">Recorded only</Badge>
                          )}
                        </td>
                        <td className="gm-sm gm-muted gm-nowrap">
                          {a.state === "live" ? <Badge tone="ok">Live now</Badge> : shortDate(a.at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
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
