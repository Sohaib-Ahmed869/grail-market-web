"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  fetchScanChecks,
  judgeScanCheck,
  rerunScanCheck,
  uploadScanCheck,
  type ScanCheck,
  type ScanCheckTally,
  type ScanChecksPage,
} from "../lib/api";
import { Badge, Card, CardBody, CardHead, Empty, Loading, Note, PageHead, Toast } from "../components/ui";
import { IconCard, IconCheck, IconRefresh, IconX } from "../components/icons";
import { Gate } from "../components/Gate";

/**
 * The scan checker.
 *
 * Paste, drop or choose card photos; each goes through the same scan pipeline
 * the app uses. Mark every answer right or wrong and the page keeps score.
 *
 * The scanner is held to one rule: it is never confidently wrong. An answer it
 * marks VERIFIED has to be right every time, so "verified and wrong" is the
 * number that must stay at zero. Coverage — how many cards verify at all — is
 * the one that should grow. Every judged card can be re-run after a pipeline
 * change, which is the regression test.
 */

type QueueItem = {
  key: string;
  name: string;
  preview: string;
  state: "queued" | "scanning" | "done" | "failed";
  checkId?: string;
  error?: string;
};

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 1000) / 10}%`);

function statusOf(c: ScanCheck): { tone: "ok" | "warn" | "bad" | "idle"; label: string } {
  const s = c.result;
  if (s.rejection) return { tone: "warn", label: `Rejected: ${s.rejection.replace(/_/g, " ")}` };
  const i = s.identification;
  if (!i) return { tone: "warn", label: "No answer" };
  if (i.cardId === "llm" || i.cardId === "described" || i.printingConfirmed === false) {
    return {
      tone: "warn",
      label: i.unconfirmedReason === "name-not-on-card" ? "Not verified: name not on card" : "Not verified: printing not read",
    };
  }
  return { tone: "ok", label: "Verified" };
}

const OUTCOME: Record<ScanCheck["outcome"], { tone: "ok" | "warn" | "bad" | "idle"; label: string }> = {
  "verified-correct": { tone: "ok", label: "Verified · correct" },
  "verified-wrong": { tone: "bad", label: "Verified · WRONG" },
  "unverified-correct": { tone: "warn", label: "Not verified · name right" },
  "unverified-wrong": { tone: "bad", label: "Not verified · wrong" },
  "no-answer": { tone: "warn", label: "No answer" },
  "bad-photo": { tone: "idle", label: "Bad photo" },
  unjudged: { tone: "idle", label: "Not judged" },
};

export default function ScanCheckPage() {
  return (
    <Gate need="scans.test">
      <ScanChecker />
    </Gate>
  );
}

function ScanChecker() {
  const [page, setPage] = useState<ScanChecksPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const files = useRef(new Map<string, File>());
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string; tone?: "ok" | "bad" | "info" } | null>(null);
  const [rerunning, setRerunning] = useState<{ done: number; total: number; changed: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setPage(await fetchScanChecks({ limit: 100 }));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Could not load checks.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const enqueue = useCallback((list: File[]) => {
    const images = list.filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      setToast({ title: "No image", body: "That was not a picture. Paste or drop a card photo.", tone: "bad" });
      return;
    }
    setQueue((q) => [
      ...images.map((f) => {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        files.current.set(key, f);
        return { key, name: f.name || "pasted image", preview: URL.createObjectURL(f), state: "queued" as const };
      }),
      ...q,
    ]);
  }, []);

  // Paste anywhere on the page: a screenshot, a copied photo, several at once.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const pasted = Array.from(e.clipboardData?.files ?? []);
      if (pasted.length) {
        e.preventDefault();
        enqueue(pasted);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enqueue]);

  // One at a time: the vision service is a single model behind a bounded queue,
  // and a page firing twenty scans at once only gets refusals back.
  useEffect(() => {
    if (queue.some((q) => q.state === "scanning")) return;
    const next = [...queue].reverse().find((q) => q.state === "queued");
    if (!next) return;
    const file = files.current.get(next.key);
    if (!file) return;
    setQueue((q) => q.map((x) => (x.key === next.key ? { ...x, state: "scanning" } : x)));
    uploadScanCheck(file)
      .then((r) => {
        files.current.delete(next.key);
        setQueue((q) => q.map((x) => (x.key === next.key ? { ...x, state: "done", checkId: r.check.id } : x)));
        void load();
      })
      .catch((e) => {
        setQueue((q) => q.map((x) =>
          x.key === next.key ? { ...x, state: "failed", error: e instanceof ApiError ? e.message : "Scan failed." } : x));
      });
  }, [queue, load]);

  const previews = new Map(queue.filter((q) => q.checkId).map((q) => [q.checkId!, q.preview]));

  const judge = async (c: ScanCheck, body: Parameters<typeof judgeScanCheck>[1]) => {
    try {
      await judgeScanCheck(c.id, body);
      await load();
    } catch (e) {
      setToast({ title: "Not saved", body: e instanceof ApiError ? e.message : "Could not save the verdict.", tone: "bad" });
    }
  };

  const rerun = async (c: ScanCheck) => {
    try {
      const r = await rerunScanCheck(c.id);
      await load();
      return r.check.outcome !== c.outcome;
    } catch (e) {
      setToast({ title: "Re-run failed", body: e instanceof ApiError ? e.message : "Could not re-run this card.", tone: "bad" });
      return false;
    }
  };

  const rerunAll = async () => {
    const judged = (page?.checks ?? []).filter((c) => c.verdict === "correct" || c.verdict === "wrong");
    if (!judged.length) return;
    setRerunning({ done: 0, total: judged.length, changed: 0 });
    let changed = 0;
    for (let i = 0; i < judged.length; i++) {
      if (await rerun(judged[i]!)) changed++;
      setRerunning({ done: i + 1, total: judged.length, changed });
    }
    setRerunning(null);
    setToast({
      title: "Re-run finished",
      body: `${judged.length} judged card${judged.length === 1 ? "" : "s"} re-scanned; ${changed} changed outcome.`,
      tone: changed ? "info" : "ok",
    });
  };

  const overall = page?.summary.overall;

  return (
    <>
      <PageHead
        title="Scan Checker"
        sub="Paste, drop or choose card photos. Each runs through the live scan pipeline. Mark every answer right or wrong."
        right={
          <button
            className="gm-btn"
            onClick={rerunAll}
            disabled={Boolean(rerunning) || !(page?.checks ?? []).some((c) => c.verdict === "correct" || c.verdict === "wrong")}
          >
            <IconRefresh /> {rerunning ? `Re-running ${rerunning.done}/${rerunning.total}` : "Re-run judged cards"}
          </button>
        }
      />

      {overall && overall.verifiedWrong > 0 && (
        <Note tone="bad">
          {overall.verifiedWrong} verified answer{overall.verifiedWrong === 1 ? " was" : "s were"} wrong. The scanner
          stood behind a wrong card — each one is a defect to fix before anything else.
        </Note>
      )}

      {/* ---- score ---------------------------------------------------------- */}
      <Card>
        <CardHead title="Accuracy" sub="Only cards you have judged count. Bad photos are left out of coverage." />
        <CardBody>
          {!page ? (
            loadError ? <Note tone="bad">{loadError}</Note> : <Loading small label="Loading checks" />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <Stat
                  label="Verified but wrong"
                  value={String(overall!.verifiedWrong)}
                  hint="Must be 0"
                  tone={overall!.verifiedWrong > 0 ? "bad" : "ok"}
                />
                <Stat label="Precision (verified)" value={pct(overall!.precision)} hint="Must be 100%" tone={overall!.precision == null || overall!.precision === 1 ? "ok" : "bad"} />
                <Stat label="Coverage" value={pct(overall!.coverage)} hint="Verified and correct, of usable photos" />
                <Stat label="Named right, not verified" value={String(overall!.unverifiedCorrect)} hint="Needed a person to pick the printing" />
                <Stat label="Wrong, not verified" value={String(overall!.unverifiedWrong)} hint="Shown as a guess, never priced" />
                <Stat label="No answer" value={String(overall!.noAnswer)} />
                <Stat label="Bad photos" value={String(overall!.badPhoto)} />
                <Stat label="Judged" value={`${overall!.judged} / ${overall!.checks}`} />
              </div>
              {Object.keys(page.summary.games).length > 0 && <GameTable games={page.summary.games} />}
            </>
          )}
        </CardBody>
      </Card>

      {/* ---- drop zone -------------------------------------------------------- */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); enqueue(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        style={{
          margin: "16px 0", padding: "28px 20px", borderRadius: 14, textAlign: "center", cursor: "pointer",
          border: `2px dashed ${dragging ? "var(--gm-gold, #A88D60)" : "var(--gm-line, #c9ced6)"}`,
          background: dragging ? "rgba(168,141,96,0.08)" : "transparent",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 15 }}>Paste (⌘V / Ctrl+V), drop, or click to choose card photos</div>
        <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
          Full-size photos work best. The card number is small type, so don&apos;t crop or shrink it.
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { enqueue(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>

      {queue.some((q) => q.state !== "done") && (
        <Card>
          <CardHead title="Scanning" sub="One at a time, so the vision service is never flooded." />
          <CardBody>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {queue.filter((q) => q.state !== "done").map((q) => (
                <div key={q.key} style={{ width: 120, fontSize: 12 }}>
                  <img src={q.preview} alt="" style={{ width: 120, height: 168, objectFit: "cover", borderRadius: 8 }} />
                  <div style={{ marginTop: 4 }}>
                    {q.state === "queued" && "Waiting"}
                    {q.state === "scanning" && "Scanning…"}
                    {q.state === "failed" && <span style={{ color: "var(--gm-bad, #b4432f)" }}>{q.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ---- checks ------------------------------------------------------------ */}
      <Card>
        <CardHead title="Checks" sub={page ? `${page.total} card${page.total === 1 ? "" : "s"} checked` : undefined} />
        <CardBody>
          {page && page.checks.length === 0 ? (
            <Empty icon={<IconCard />} title="No cards checked yet" body="Paste a card photo to run the first one." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {(page?.checks ?? []).map((c) => (
                <CheckRowView
                  key={c.id}
                  check={c}
                  preview={previews.get(c.id) ?? null}
                  onJudge={(body) => judge(c, body)}
                  onRerun={() => rerun(c)}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {toast && <Toast title={toast.title} body={toast.body} tone={toast.tone} onDone={() => setToast(null)} />}
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "bad" }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--gm-line, #e3e6ea)" }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div
        style={{
          fontSize: 24, fontWeight: 700, marginTop: 2,
          color: tone === "bad" ? "var(--gm-bad, #b4432f)" : tone === "ok" ? "var(--gm-ok, #2c7a5b)" : undefined,
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function GameTable({ games }: { games: Record<string, ScanCheckTally> }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table className="gm-table" style={{ width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Game</th>
            <th>Judged</th>
            <th>Verified but wrong</th>
            <th>Precision</th>
            <th>Coverage</th>
            <th>Named right, not verified</th>
            <th>No answer</th>
            <th>Bad photos</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(games).sort((a, b) => b[1].checks - a[1].checks).map(([game, t]) => (
            <tr key={game}>
              <td style={{ textAlign: "left", textTransform: "capitalize" }}>{game}</td>
              <td style={{ textAlign: "center" }}>{t.judged}/{t.checks}</td>
              <td style={{ textAlign: "center", color: t.verifiedWrong ? "var(--gm-bad, #b4432f)" : undefined, fontWeight: t.verifiedWrong ? 700 : undefined }}>
                {t.verifiedWrong}
              </td>
              <td style={{ textAlign: "center" }}>{pct(t.precision)}</td>
              <td style={{ textAlign: "center" }}>{pct(t.coverage)}</td>
              <td style={{ textAlign: "center" }}>{t.unverifiedCorrect}</td>
              <td style={{ textAlign: "center" }}>{t.noAnswer}</td>
              <td style={{ textAlign: "center" }}>{t.badPhoto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckRowView({
  check, preview, onJudge, onRerun,
}: {
  check: ScanCheck;
  preview: string | null;
  onJudge: (body: Parameters<typeof judgeScanCheck>[1]) => Promise<void>;
  onRerun: () => Promise<boolean>;
}) {
  const s = check.result;
  const i = s.identification;
  const status = statusOf(check);
  const outcome = OUTCOME[check.outcome];
  const [wrongOpen, setWrongOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: check.expected?.name ?? "",
    set: check.expected?.set ?? "",
    number: check.expected?.number ?? "",
    catalogId: check.expected?.catalogId ?? "",
    note: check.note ?? "",
  });

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", gap: 14, padding: 12, borderRadius: 12, border: "1px solid var(--gm-line, #e3e6ea)", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {preview && <img src={preview} alt="Your photo" style={{ width: 84, height: 118, objectFit: "cover", borderRadius: 6 }} />}
        {i?.imageUrl
          ? <img src={i.imageUrl} alt="Catalogue match" style={{ width: 84, height: 118, objectFit: "contain", borderRadius: 6 }} />
          : !preview && <div style={{ width: 84, height: 118, borderRadius: 6, background: "rgba(0,0,0,0.05)" }} />}
      </div>

      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={outcome.tone}>{outcome.label}</Badge>
          {check.runs > 1 && <span style={{ fontSize: 12, opacity: 0.6 }}>run {check.runs}×</span>}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>{i?.name || "Nothing identified"}</div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {[i?.game, i?.setName || (i ? "no set asserted" : null), i?.localId && `#${i.localId}`].filter(Boolean).join(" · ")}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Price: {s.price ? `${s.price.currency} ${s.price.value.toLocaleString("en-US")} (${s.price.basis})` : "none"}
          {s.ocrNames.length > 0 && <span style={{ opacity: 0.6 }}> · read: {s.ocrNames.join(", ")}</span>}
        </div>
        {s.candidates.length > 1 && (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            Alternatives: {s.candidates.slice(1).map((c) => [c.name, c.setName, c.localId && `#${c.localId}`].filter(Boolean).join(" ")).join(" | ")}
          </div>
        )}
        {check.expected && (
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            Actually: {[check.expected.name, check.expected.set, check.expected.number && `#${check.expected.number}`, check.expected.catalogId].filter(Boolean).join(" · ")}
          </div>
        )}
        {check.note && <div style={{ fontSize: 12.5, opacity: 0.8 }}>Note: {check.note}</div>}
        <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 4 }}>
          {new Date(check.createdAt).toLocaleString()} {check.createdBy ? `· ${check.createdBy}` : ""} · {check.id}
          {check.judgedBy ? ` · judged by ${check.judgedBy}` : ""}
        </div>

        {wrongOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 10 }}>
            <input className="gm-input" placeholder="Actual card name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="gm-input" placeholder="Set" value={form.set} onChange={(e) => setForm({ ...form, set: e.target.value })} />
            <input className="gm-input" placeholder="Number (e.g. 4/102, LOB-001)" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            <input className="gm-input" placeholder="Catalogue id (optional)" value={form.catalogId} onChange={(e) => setForm({ ...form, catalogId: e.target.value })} />
            <input className="gm-input" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ gridColumn: "1 / -1" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="gm-btn gm-btn--primary"
                disabled={busy || !form.name.trim()}
                onClick={() => act(async () => { await onJudge({ verdict: "wrong", ...form }); setWrongOpen(false); })}
              >
                Save as wrong
              </button>
              <button className="gm-btn" onClick={() => setWrongOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
        <button
          className={`gm-btn${check.verdict === "correct" ? " gm-btn--primary" : ""}`}
          disabled={busy}
          onClick={() => act(() => onJudge({ verdict: "correct", note: form.note }))}
        >
          <IconCheck /> Correct
        </button>
        <button
          className={`gm-btn${check.verdict === "wrong" ? " gm-btn--primary" : ""}`}
          disabled={busy}
          onClick={() => setWrongOpen((o) => !o)}
        >
          <IconX /> Wrong…
        </button>
        <button
          className={`gm-btn${check.verdict === "bad-photo" ? " gm-btn--primary" : ""}`}
          disabled={busy}
          onClick={() => act(() => onJudge({ verdict: "bad-photo", note: form.note }))}
        >
          Bad photo
        </button>
        <button className="gm-btn" disabled={busy} onClick={() => act(onRerun)}>
          <IconRefresh /> Re-run
        </button>
      </div>
    </div>
  );
}
