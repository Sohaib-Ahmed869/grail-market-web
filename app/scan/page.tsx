"use client";

import { createContext, Fragment, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { PUBLIC_API_BASE as API } from "../lib/apibase";

type SideCentering = { lr: number; tb: number; measurable: boolean };
type Scan = {
  id: string;
  status: string;
  createdAt: string;
  rejection?: { reason: string; userMessage: string; retryHint: string } | null;
  backRejection?: { reason: string; userMessage: string; retryHint: string } | null;
  measurement?: {
    centering: {
      front: SideCentering;
      back?: SideCentering | null;
      passesAt: { psa10: boolean; psa9: boolean };
      overlayImageKey?: string | null;
    };
    confidence: { centering: number };
  } | null;
  grade?: {
    overall: number;
    band: { low: number; high: number };
    subgrades: {
      centering?: { value: number; confidence: number } | null;
      corners?: { value: number; confidence: number } | null;
      edges?: { value: number; confidence: number } | null;
      surface: { value: number; confidence: number };
    };
    findings?: {
      scratchesDetected: boolean;
      clusterCount: number;
      clusters: { x: number; y: number; w: number; h: number; areaPx: number }[];
      defectFrac: number;
    } | null;
    method: string;
    notes: string[];
  } | null;
  authenticity?: { digitalLikely: boolean; noiseFloor: number } | null;
  origin?: {
    language: "en" | "ja" | "unknown";
    japaneseTextDetected: boolean;
    note: string;
  } | null;
  recommendation?: {
    verdict: "grade" | "dont_grade" | "insufficient_data";
    reasoning: string;
    gradingCost: number;
    rawValue?: number | null;
    likelyGrade?: string | null;
    rows: { grade: string; value?: number | null; net?: number | null; inBand: boolean }[];
  } | null;
  identification?: {
    cardId: string;
    name: string;
    /** the catalog's own-language name, when it differs from the display one */
    nameLocal?: string | null;
    setId?: string | null;
    setName: string;
    localId: string;
    rarity?: string | null;
    imageUrl?: string | null;
    matchScore: number;
    ocrName: string;
    game?: string;
    /** false when the name was matched but the printing could not be proven */
    printingConfirmed?: boolean | null;
    unconfirmedReason?: string | null;
  } | null;
  ocrNames?: string[] | null;
  summary?: string | null;
  slab?: {
    company: string;
    gradeText: string;
    certNumber?: string | null;
    verifyUrl?: string | null;
  } | null;
  related?:
    | {
        name: string;
        localId: string;
        imageUrl?: string | null;
        price?: number | null;
        unit: string;
      }[]
    | null;
  valuation?: {
    updatedAt?: string | null;
    graded?: {
      source: string;
      psa8?: number | null;
      psa9?: number | null;
      psa10?: number | null;
      estimated?: boolean;
      citations?: { label: string; url: string }[] | null;
    } | null;
    webEstimate?: {
      value: number;
      sampleSize: number;
      citations: { label: string; url: string }[];
    } | null;
    tcgplayer?: {
      unit: string;
      variant: string;
      low?: number | null;
      mid?: number | null;
      high?: number | null;
      market?: number | null;
    } | null;
    cardmarket?: {
      unit: string;
      low?: number | null;
      trend?: number | null;
      avg30?: number | null;
    } | null;
    conditionAdjusted?: { value: number; multiplier: number } | null;
    pricesByGrader?: Record<
      string,
      Record<
        string,
        {
          price: number;
          count?: number | null;
          confidence?: "high" | "medium" | "low" | null;
          method?: string | null;
          low?: number | null;
          high?: number | null;
          median?: number | null;
          asOf?: string | null;
          /** the source blends label variants, so this is not variant-specific */
          blended?: boolean | null;
        }
      >
    > | null;
    slabLabelVariant?: string | null;
    identificationSuspect?: string | null;
    marketNote?: string | null;
    /** The figure for THIS holder, decided by the backend's ladder, carrying
     *  how it was reached. Authoritative — the fallbacks below it exist for
     *  older responses that do not include it. */
    slabPrice?: {
      price: number;
      low?: number | null;
      high?: number | null;
      sampleSize?: number | null;
      confidence: "high" | "medium" | "low";
      basis:
        | "observed"
        | "same-grader-interpolated"
        | "same-grader-nearest"
        | "modelled-cross-grader"
        | "ask-over-suspect-sale";
      method: string;
      explain: string;
      suspect?: boolean | null;
      suspectReason?: string | null;
    } | null;
    slabGrader?: string | null;
    slabGrade?: number | null;
    variant?: string | null;
    /** median live ASKING price at the card's own grader and grade, present
     *  only where no completed sale at that grade reaches us */
    liveAsk?: {
      median: number;
      low?: number | null;
      high?: number | null;
      count: number;
      total: number;
      grader?: string | null;
      grade?: number | null;
      raw?: boolean;
      printing?: string | null;
      staleCeiling?: number | null;
      staleCeilingDays?: number | null;
      cappedByStale?: boolean;
      otherPrintings?: { name: string; count: number; low: number; high: number }[];
    } | null;
  } | null;
};

type PulseCard = {
  label: string;
  setName: string;
  game: string;
  price?: number | null;
  change24h?: number | null;
  change7d?: number | null;
  low7?: number | null;
  high7?: number | null;
  spark: number[];
};

/** Both tickers are opt-in. The page should open on the card, not on scrolling
 *  market noise — so each collapses to a quiet label until asked for, and the
 *  choice is remembered. Data is only fetched once actually opened. */
function useDisclosure(key: string) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(key) === "1");
    } catch {
      /* private mode — default closed */
    }
  }, [key]);
  const toggle = () =>
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* non-fatal */
      }
      return next;
    });
  return [open, toggle] as const;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`tick-chev${open ? " open" : ""}`} width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TickerItems({ cards }: { cards: PulseCard[] }) {
  return (
    <>
      {cards.map((c, i) => {
        const chg = c.change7d ?? c.change24h;
        const up = (chg ?? 0) >= 0;
        return (
          <span className="htick" key={c.label + i}>
            <b>{c.label}</b>
            {c.price != null && <span className="htick-price">${c.price.toFixed(2)}</span>}
            {chg != null && (
              <span className={up ? "up-text" : "down-text"}>
                {up ? "▲" : "▼"}{Math.abs(chg).toFixed(1)}%
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

function MarketTicker() {
  const [open, toggle] = useDisclosure("gc.ticker.market");
  const [cards, setCards] = useState<PulseCard[]>([]);
  useEffect(() => {
    if (!open || cards.length > 0) return;
    fetch(`${API}/market/pulse`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCards)
      .catch(() => {});
  }, [open, cards.length]);
  return (
    <div className={`hticker${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="tick-toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="market-ticker"
        title={open ? "Hide market prices" : "Show market prices"}
      >
        <span className="label-mono accent-text">Market</span>
        <Chevron open={open} />
      </button>
      <div id="market-ticker" className="reveal-x" aria-hidden={!open}>
        <div className="hticker-clip">
          <div className="hticker-track">
            <TickerItems cards={cards} />
            <TickerItems cards={cards} />
          </div>
        </div>
      </div>
    </div>
  );
}

type NewsItem = { title: string; source: string; link: string; publishedAt: string };

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function NewsLineItems({ items }: { items: NewsItem[] }) {
  return (
    <>
      {items.map((n, i) => (
        <a className="newsline-item" href={n.link} target="_blank" rel="noreferrer" key={n.link + i}>
          <span className="news-source">{n.source}</span>
          {n.title.replace(/ - [^-]+$/, "")}
          <span className="muted small">{timeAgo(n.publishedAt)}</span>
        </a>
      ))}
    </>
  );
}

function NewsLine() {
  const [open, toggle] = useDisclosure("gc.ticker.news");
  const [items, setItems] = useState<NewsItem[]>([]);
  useEffect(() => {
    if (!open || items.length > 0) return;
    fetch(`${API}/market/news`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => {});
  }, [open, items.length]);
  return (
    <div className={`newsline${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="tick-toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="hobby-wire"
        title={open ? "Hide hobby news" : "Show hobby news"}
      >
        <span className="label-mono violet-text">Hobby wire</span>
        <Chevron open={open} />
      </button>
      <div id="hobby-wire" className="reveal-y" aria-hidden={!open}>
        <div className="newsline-inner">
          <div className="newsline-clip">
            <div className="newsline-track">
              <NewsLineItems items={items} />
              <NewsLineItems items={items} />
            </div>
          </div>
          {items.length > 0 && (
            <span className="label-mono muted">{items.length} stories</span>
          )}
        </div>
      </div>
    </div>
  );
}

function BandTrack({ overall, band }: { overall: number; band: { low: number; high: number } }) {
  const pos = (v: number) => `${((v - 1) / 9) * 100}%`;
  return (
    <div className="band-track-wrap">
      <div className="band-track">
        <div
          className="band-track-band"
          style={{ left: pos(band.low), width: `calc(${pos(band.high)} - ${pos(band.low)})` }}
        />
        <div className="band-track-dot" style={{ left: pos(overall) }} />
      </div>
      <div className="band-track-labels label-mono">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

function CritCard({
  label,
  sub,
  note,
}: {
  label: string;
  sub?: { value: number; confidence: number } | null;
  note?: string;
}) {
  return (
    <div className="crit-card">
      <div className="crit-head">
        <span className="crit-label">{label}</span>
        <span
          className="crit-value"
          style={{ color: sub ? gradeColor(sub.value) : "var(--muted)" }}
        >
          {sub ? sub.value.toFixed(1) : "not measurable"}
        </span>
      </div>
      {sub ? (
        <>
          <div className="crit-bar">
            <div
              style={{
                width: `${(sub.value / 10) * 100}%`,
                background: gradeColor(sub.value),
              }}
            />
          </div>
          <div className="muted small">
            {(sub.confidence * 100).toFixed(0)}% confidence{note ? ` · ${note}` : ""}
          </div>
        </>
      ) : (
        <div className="muted small">{note ?? "None"}</div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = (localStorage.getItem("gc-theme") as "dark" | "light") || "dark";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("gc-theme", next);
  };
  return (
    <button className="theme-toggle" onClick={flip}>
      {theme === "dark" ? "☀ Light" : "☾ Dark"}
    </button>
  );
}

const SCAN_STEPS = [
  "Detecting card…",
  "Checking photo quality…",
  "Measuring borders…",
  "Reading card text…",
  "Matching catalog…",
  "Fetching market prices…",
];

/* ============ CURRENCY ============ */
// Feeds price in mixed units — TCGplayer/PPT/eBay in USD, Cardmarket in EUR.
// Rates are quoted FROM USD, so EUR converts via USD rather than directly.

type FxTable = { base: string; date: string; rates: Record<string, number> };

const FX_FALLBACK: FxTable = {
  base: "USD",
  date: "",
  rates: { USD: 1, AUD: 1.5, EUR: 0.92, GBP: 0.79, CAD: 1.37, NZD: 1.67, JPY: 157 },
};

// shown first in the picker — the markets this audience actually sells into
const PRIMARY = ["AUD", "USD", "EUR", "GBP", "JPY", "CAD", "NZD"];

const CURRENCY_NAMES: Record<string, string> = {
  AUD: "Australian Dollar", USD: "US Dollar", EUR: "Euro", GBP: "British Pound",
  JPY: "Japanese Yen", CAD: "Canadian Dollar", NZD: "New Zealand Dollar",
  SGD: "Singapore Dollar", HKD: "Hong Kong Dollar", CHF: "Swiss Franc",
  CNY: "Chinese Yuan", KRW: "South Korean Won", INR: "Indian Rupee",
  BRL: "Brazilian Real", MXN: "Mexican Peso", ZAR: "South African Rand",
  SEK: "Swedish Krona", NOK: "Norwegian Krone", DKK: "Danish Krone",
  PLN: "Polish Zloty", CZK: "Czech Koruna", HUF: "Hungarian Forint",
  RON: "Romanian Leu", TRY: "Turkish Lira", ILS: "Israeli Shekel",
  THB: "Thai Baht", MYR: "Malaysian Ringgit", PHP: "Philippine Peso",
  IDR: "Indonesian Rupiah", ISK: "Icelandic Krona",
};

type CurrencyCtx = {
  code: string;
  setCode: (c: string) => void;
  fx: FxTable;
  ready: boolean;
};

const CurrencyContext = createContext<CurrencyCtx>({
  code: "AUD",
  setCode: () => {},
  fx: FX_FALLBACK,
  ready: false,
});

let fxPromise: Promise<FxTable> | null = null;

function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCodeState] = useState("AUD");
  const [fx, setFx] = useState<FxTable>(FX_FALLBACK);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gc-currency");
      if (saved && /^[A-Z]{3}$/.test(saved)) setCodeState(saved);
    } catch {
      /* private mode — stay on the default */
    }
    fxPromise ??= fetch(`${API}/market/fx`)
      .then((r) => (r.ok ? r.json() : FX_FALLBACK))
      .then((b: FxTable) => (b?.rates?.USD ? b : FX_FALLBACK))
      .catch(() => FX_FALLBACK);
    fxPromise.then((t) => {
      setFx(t);
      setReady(true);
    });
  }, []);

  const setCode = (c: string) => {
    setCodeState(c);
    try {
      localStorage.setItem("gc-currency", c);
    } catch {
      /* non-fatal */
    }
  };

  return (
    <CurrencyContext.Provider value={{ code, setCode, fx, ready }}>
      {children}
    </CurrencyContext.Provider>
  );
}

function useCurrency() {
  return useContext(CurrencyContext);
}

/** Convert into the display currency. `from` is the unit the feed quoted. */
function convert(v: number, from: string, to: string, fx: FxTable): number | null {
  if (from === to) return v;
  const fromRate = from === "USD" ? 1 : fx.rates[from];
  const toRate = to === "USD" ? 1 : fx.rates[to];
  if (!fromRate || !toRate) return null;
  return (v / fromRate) * toRate;
}

function formatMoney(v: number, code: string): string {
  // whole units above 1000 — "A$58,723" reads better than "A$58,723.00"
  const digits = Math.abs(v) >= 1000 ? 0 : 2;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(v);
  } catch {
    return `${code} ${v.toFixed(digits)}`;
  }
}

/** A price in the user's chosen currency, with the source figure kept
 *  visible underneath — converted numbers should never look like the
 *  original sale. */
function Money({
  v,
  unit = "USD",
  showSource = true,
}: {
  v?: number | null;
  unit?: string;
  showSource?: boolean;
}) {
  const { code, fx } = useCurrency();
  if (v == null) return <>n/a</>;
  const converted = convert(v, unit, code, fx);
  if (converted == null) return <>{formatMoney(v, unit)}</>;
  return (
    <>
      {formatMoney(converted, code)}
      {showSource && unit !== code && (
        <span className="muted small"> · {formatMoney(v, unit)}</span>
      )}
    </>
  );
}

/** Non-JSX variant for table cells and strings. */
function useMoneyFmt() {
  const { code, fx } = useCurrency();
  return (v: number | null | undefined, unit = "USD") => {
    if (v == null) return "n/a";
    const c = convert(v, unit, code, fx);
    return c == null ? formatMoney(v, unit) : formatMoney(c, code);
  };
}

function CurrencyPicker() {
  const { code, setCode, fx } = useCurrency();
  const all = Object.keys(fx.rates).sort();
  const rest = all.filter((c) => !PRIMARY.includes(c));
  return (
    <label className="fx-picker" title="Display currency">
      <span className="sr-only">Display currency</span>
      <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Display currency">
        <optgroup label="Common">
          {PRIMARY.filter((c) => all.includes(c)).map((c) => (
            <option key={c} value={c}>
              {c} · {CURRENCY_NAMES[c] ?? c}
            </option>
          ))}
        </optgroup>
        {rest.length > 0 && (
          <optgroup label="All currencies">
            {rest.map((c) => (
              <option key={c} value={c}>
                {c} · {CURRENCY_NAMES[c] ?? c}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}

function CaptureSlot({
  label,
  required,
  file,
  onPick,
  scanning,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onPick: (f: File) => void;
  scanning: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="slot">
      <div className="slot-label label-mono">
        {label} · {required ? "required" : "optional"}
      </div>
      <div
        className={`scan-frame${scanning ? " scanning" : ""}`}
        onClick={() => !scanning && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onPaste={(e) => {
          const f = imageFromClipboard(e.clipboardData as unknown as DataTransfer);
          if (f && !scanning) {
            e.preventDefault();
            onPick(f);
          }
        }}
        tabIndex={0}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f && !scanning) onPick(f);
        }}
      >
        <span className="bracket" />
        {preview ? <img src={preview} alt={label} /> : <span>Drop or tap to add the {label.toLowerCase()} photo</span>}
        {scanning && preview && <div className="scanline" />}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
      </div>
    </div>
  );
}

function CenteringBlock({ title, c }: { title: string; c: SideCentering }) {
  return (
    <div>
      <div className="muted">{title}</div>
      {c.measurable ? (
        <div className="centering-pair">
          <CenteringDiagram c={c} />
          <div>
            <div className="muted small">L / R</div>
            <div className="ratios">
              {c.lr.toFixed(0)}/{(100 - c.lr).toFixed(0)}
            </div>
          </div>
          <div>
            <div className="muted small">T / B</div>
            <div className="ratios">
              {c.tb.toFixed(0)}/{(100 - c.tb).toFixed(0)}
            </div>
          </div>
        </div>
      ) : (
        <p className="muted">
          No printed border to measure against (borderless / full-art) — we won&apos;t guess.
        </p>
      )}
    </div>
  );
}

function Viewer({ scan }: { scan: Scan }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [mode, setMode] = useState<"overlay" | "warped">("overlay");
  const [grid, setGrid] = useState(false);
  const hasBack = !!scan.measurement?.centering.back;
  const key = `${scan.id}/${side}_${mode === "overlay" ? "overlay" : "warped"}.png`;

  return (
    <div className="viewer" id="detection">
      <div className="viewer-tabs">
        <button className={mode === "overlay" ? "active" : ""} onClick={() => setMode("overlay")}>
          Detection lines
        </button>
        <button className={mode === "warped" ? "active" : ""} onClick={() => setMode("warped")}>
          Original
        </button>
        <button className={grid ? "active" : ""} onClick={() => setGrid((v) => !v)}>
          Grid
        </button>
        {hasBack && (
          <>
            <button className={side === "front" ? "active" : ""} onClick={() => setSide("front")}>
              Front
            </button>
            <button className={side === "back" ? "active" : ""} onClick={() => setSide("back")}>
              Back
            </button>
          </>
        )}
      </div>
      <div className="viewer-stage">
        <img src={`${API}/storage/${key}`} alt="scan" />
        {grid && <div className="measure-grid" />}
      </div>
      {mode === "overlay" && (
        <div className="muted small" style={{ marginTop: 6, lineHeight: 1.5 }}>
          <span style={{ color: "#28dcc8" }}>■</span> measured border lines &amp; points ·{" "}
          <span style={{ color: "#eb3c3c" }}>■</span> surface marks (scratches / print lines) ·{" "}
          <span style={{ color: "#3cc850" }}>●</span>/<span style={{ color: "#ebc83c" }}>●</span>/
          <span style={{ color: "#eb3c3c" }}>●</span> corner condition rings (score below each)
        </div>
      )}
    </div>
  );
}

function gradeColor(v: number) {
  if (v >= 9) return "#2fbf71";
  if (v >= 7) return "#4da3ff";
  if (v >= 5) return "#e8a13c";
  return "#e05252";
}


function GradePanel({ scan }: { scan: Scan }) {
  const g = scan.grade;
  if (!g) return null;
  const critNote = (key: "centering" | "corners" | "edges") => {
    if (g.subgrades[key]) return undefined;
    return key === "centering"
      ? "No printed border on this design — we don't guess."
      : "Art runs to the edge — no border stock to judge.";
  };
  return (
    <div className="panel verdict">
      {scan.status === "rejected" && (
        <div style={{ marginBottom: 12 }}>
          <span className="badge warn">provisional — photo failed the quality gate</span>
          <span className="muted small"> a rough impression only; re-shoot for a real grade</span>
        </div>
      )}
      <div className="verdict-head">
        <div>
          <div className="label-mono accent-text">GC estimate</div>
          <div className="gc-num" style={{ color: gradeColor(g.overall) }}>
            {g.overall.toFixed(1)}
          </div>
        </div>
        <div className="verdict-side">
          <p className="muted" style={{ margin: 0 }}>
            Honest band <b style={{ color: "var(--text)" }}>{g.band.low.toFixed(1)} – {g.band.high.toFixed(1)}</b>.
            The band is the claim; the number is its midpoint.
          </p>
          <BandTrack overall={g.overall} band={g.band} />
          {scan.authenticity?.digitalLikely && (
            <span className="badge warn">possible digital image</span>
          )}
        </div>
      </div>
      <div className="crit-grid">
        <CritCard
          label="Surface"
          sub={g.subgrades.surface}
          note={
            g.findings?.scratchesDetected
              ? `${g.findings.clusterCount} marks flagged`
              : "no marks above threshold"
          }
        />
        <CritCard label="Corners" sub={g.subgrades.corners} note={critNote("corners")} />
        <CritCard label="Centering" sub={g.subgrades.centering} note={critNote("centering")} />
        <CritCard label="Edges" sub={g.subgrades.edges} note={critNote("edges")} />
      </div>
      {scan.status !== "rejected" && (
        <a className="see-detection" href="#detection">
          See detection view
        </a>
      )}
      {scan.summary && (
        <p style={{ margin: "14px 0 8px", lineHeight: 1.65 }}>{scan.summary}</p>
      )}
      {g.notes.map((n) => (
        <div key={n} className="muted small">
          {n}
        </div>
      ))}
    </div>
  );
}

function CenteringDiagram({ c }: { c: SideCentering }) {
  const W = 110;
  const H = 154;
  const bx = 26;
  const by = 30;
  const left = (bx * c.lr) / 100;
  const top = (by * c.tb) / 100;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="centering-diagram">
      <rect x={1} y={1} width={W - 2} height={H - 2} rx={6} fill="var(--panel-2)" stroke="var(--track-strong)" strokeWidth={1.5} />
      <line x1={W / 2} y1={4} x2={W / 2} y2={H - 4} stroke="var(--track)" strokeDasharray="3 4" />
      <line x1={4} y1={H / 2} x2={W - 4} y2={H / 2} stroke="var(--track)" strokeDasharray="3 4" />
      <rect
        x={1 + left}
        y={1 + top}
        width={W - 2 - bx}
        height={H - 2 - by}
        rx={3}
        fill="var(--radar-fill)"
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

const GAME_LABELS: Record<string, string> = {
  pokemon: "Pokémon TCG",
  mtg: "Magic: The Gathering",
  yugioh: "Yu-Gi-Oh!",
  onepiece: "One Piece TCG",
  lorcana: "Disney Lorcana",
  digimon: "Digimon Card Game",
  starwars: "Star Wars: Unlimited",
  sports: "Sports card",
  unionarena: "Union Arena",
  dragonball: "Dragon Ball Fusion",
  gundam: "Gundam Card Game",
  riftbound: "Riftbound",
  other: "Other card",
};

function IdentityPanel({ scan }: { scan: Scan }) {
  const idn = scan.identification;
  if (!idn) {
    const read = (scan.ocrNames ?? []).filter(Boolean);
    return (
      <div className="panel">
        <span className="badge warn">card not identified</span>
        {read.length > 0 ? (
          <p className="muted">
            We read <b style={{ color: "var(--text)" }}>{read.map((n) => `“${n}”`).join(", ")}</b>{" "}
            off the card, but found no match in the catalogs we support — Pokémon TCG, Magic:
            The Gathering, Yu-Gi-Oh!, and One Piece. If this card is from another game (sports
            cards, Top Trumps, Lorcana…), it isn&apos;t in our database yet.
          </p>
        ) : (
          <p className="muted">
            We couldn&apos;t read enough text off this photo to search the catalog. A closer,
            sharper shot of the card name usually fixes this.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="panel identity">
      {idn.imageUrl && <img src={idn.imageUrl} alt={idn.name} />}
      <div>
        <h2>{idn.name}</h2>
        {idn.nameLocal && idn.nameLocal !== idn.name && (
          <div className="identity-local" lang="ja">
            {idn.nameLocal}
            <span className="muted small"> · as printed on the card</span>
          </div>
        )}
        <div className="muted">
          {idn.game && (
            <span className="badge info" style={{ marginRight: 6 }}>
              {GAME_LABELS[idn.game] ?? idn.game}
            </span>
          )}
          {idn.setId && idn.setId !== idn.setName ? `${idn.setId} · ` : ""}
          {idn.setName} · #{idn.localId}
          {idn.rarity ? ` · ${idn.rarity}` : ""}
        </div>
        {scan.origin && (
          <div style={{ marginTop: 6 }}>
            <span className={`badge ${scan.origin.japaneseTextDetected ? "info" : "pass"}`}>
              {scan.origin.japaneseTextDetected
                ? "Japanese print"
                : scan.origin.language === "en"
                  ? "English print"
                  : "language unknown"}
            </span>
            <span className="muted small"> {scan.origin.note}</span>
          </div>
        )}
        <div className="muted small" style={{ marginTop: 4 }}>
          Identification is not authentication — we cannot detect counterfeits or
          reprints. High-value cards should be authenticated by a grading company.
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>
          {idn.cardId === "llm" ? (
            <>
              Identified by AI vision (world knowledge) — not catalog-verified, so treat the
              set/edition as a strong guess and there&apos;s no market data attached.
            </>
          ) : idn.cardId === "described" ? (
            <>
              Described from the card&apos;s own text — this card isn&apos;t in any catalog we
              support (Pokémon, Magic, Yu-Gi-Oh!, One Piece), so there&apos;s no market data
              for it.
            </>
          ) : (
            <>
              Read from card: “{idn.ocrName}” · match {(idn.matchScore * 100).toFixed(0)}%
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationPanel({ scan }: { scan: Scan }) {
  const r = scan.recommendation;
  if (!r) return null;
  const verdictBadge =
    r.verdict === "grade" ? (
      <span className="badge pass" style={{ fontSize: 16, padding: "6px 16px" }}>
        GRADE IT
      </span>
    ) : r.verdict === "dont_grade" ? (
      <span className="badge fail" style={{ fontSize: 16, padding: "6px 16px" }}>
        DON&apos;T GRADE IT
      </span>
    ) : (
      <span className="badge warn" style={{ fontSize: 16, padding: "6px 16px" }}>
        NOT ENOUGH DATA
      </span>
    );
  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        {verdictBadge}
        {r.likelyGrade && (
          <span className="muted">
            most likely outcome: <b style={{ color: "var(--text)" }}>{r.likelyGrade}</b>
          </span>
        )}
      </div>
      <p style={{ margin: "6px 0 10px" }}>{r.reasoning}</p>
      <table className="rec-table">
        <thead>
          <tr>
            <th>If it grades</th>
            <th>Sells for</th>
            <th>Net after costs</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.grade} className={row.inBand ? "in-band" : ""}>
              <td>{row.grade}</td>
              <td><Money v={row.value} /></td>
              <td
                style={{
                  color:
                    row.net == null
                      ? undefined
                      : row.net >= 0
                        ? "var(--green)"
                        : "var(--red)",
                  fontWeight: 700,
                }}
              >
                {row.net != null
                  ? `${row.net >= 0 ? "+" : "−"}$${Math.abs(row.net).toFixed(2)}`
                  : "—"}
              </td>
              <td className="muted small">{row.inBand ? "in your grade band" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small">
        Assumes ${r.gradingCost} grading cost
        {r.rawValue != null && <> · raw value ${r.rawValue.toFixed(2)}</>} · graded prices are
        eBay sales averages
      </div>
    </div>
  );
}

function FindingsLine({ scan }: { scan: Scan }) {
  const f = scan.grade?.findings;
  if (!f) return null;
  return (
    <div className="muted small" style={{ marginTop: 6 }}>
      {f.scratchesDetected ? (
        <>
          <span className="badge warn">
            {f.clusterCount} surface mark{f.clusterCount === 1 ? "" : "s"} flagged
          </span>{" "}
          possible scratches / print lines — boxed in red on the Detection lines view
          ({(f.defectFrac * 100).toFixed(2)}% of the face affected)
        </>
      ) : (
        <>
          <span className="badge pass">no scratches detected</span> no surface marks above
          the detection threshold on this photo
        </>
      )}
    </div>
  );
}

function ebaySoldUrl(query: string) {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
}

function EbayComps({ scan }: { scan: Scan }) {
  const idn = scan.identification;
  if (!idn) return null;
  const base = [idn.name, idn.setName, idn.localId].filter(Boolean).join(" ");
  return (
    <div className="panel">
      <div className="muted" style={{ marginBottom: 6 }}>
        eBay sold listings <span className="small">(real completed sales — the ground truth)</span>
      </div>
      {!scan.valuation && (
        <p className="muted small" style={{ margin: "0 0 8px" }}>
          No price database covers this card&apos;s game — these sold listings are the best
          pricing that exists for it, from any tool.
        </p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="ebay-link" href={ebaySoldUrl(base)} target="_blank" rel="noreferrer">
          Raw sold listings →
        </a>
        <a className="ebay-link" href={ebaySoldUrl(`${base} PSA`)} target="_blank" rel="noreferrer">
          PSA graded sold →
        </a>
        <a className="ebay-link" href={ebaySoldUrl(`${base} PSA 10`)} target="_blank" rel="noreferrer">
          PSA 10 sold →
        </a>
      </div>
    </div>
  );
}

/** Any price we produced ourselves says so, in plain words, right next to the
 *  number — never a bare figure the user could mistake for a market feed. */
function EstimateNote({ source }: { source: string }) {
  const text =
    source === "web-search"
      ? "Estimated from system data, read off public web pages by our own lookup rather than a pricing service. Each figure was re-checked against the page it came from; confirm via the sources before acting."
      : source === "cardgrader"
        ? "Estimated from system data, using a third-party model's comparable sales rather than a pricing service. Confirm with the eBay sold links before acting."
        : "Estimated from system data, using our own multiples off the raw price rather than a pricing service. Treat it as a ballpark and confirm with the eBay sold links below.";
  return (
    <div className="est-note">
      <span className="badge warn">estimated</span>
      <span>{text}</span>
    </div>
  );
}

function Sources({ items }: { items?: { label: string; url: string }[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="est-sources small">
      <span className="muted small">sources: </span>
      {items.map((c) => (
        <a key={c.url} href={c.url} target="_blank" rel="noreferrer">
          {c.label}
        </a>
      ))}
    </div>
  );
}

function ValuationPanel({ scan }: { scan: Scan }) {
  const v = scan.valuation;
  const fmt = useMoneyFmt();
  const { code } = useCurrency();
  if (!v) return null;
  return (
    <div className="panel">
      <div className="muted" style={{ marginBottom: 6 }}>
        Market value <span className="small">(raw / ungraded · shown in {code})</span>
      </div>
      {v.tcgplayer && (
        <>
          <div className="price-row">
            <span>TCGplayer market ({v.tcgplayer.variant})</span>
            <span className="v"><Money v={v.tcgplayer.market} /></span>
          </div>
          <div className="price-row">
            <span>TCGplayer low – high</span>
            <span className="v">
              {fmt(v.tcgplayer.low, v.tcgplayer.unit)} – {fmt(v.tcgplayer.high, v.tcgplayer.unit)}
            </span>
          </div>
        </>
      )}
      {v.cardmarket && (
        <>
          <div className="price-row">
            <span>Cardmarket trend</span>
            <span className="v">{fmt(v.cardmarket.trend, v.cardmarket.unit)}</span>
          </div>
          <div className="price-row">
            <span>Cardmarket 30-day avg</span>
            <span className="v">{fmt(v.cardmarket.avg30, v.cardmarket.unit)}</span>
          </div>
        </>
      )}
      {v.webEstimate && (
        <div className="price-row">
          <span>
            Raw, read from web sources{" "}
            <span className="muted small">
              ({v.webEstimate.sampleSize} verified {v.webEstimate.sampleSize === 1 ? "figure" : "figures"})
            </span>
          </span>
          <span className="v"><Money v={v.webEstimate.value} /></span>
        </div>
      )}
      {v.webEstimate && !v.graded && (
        <>
          <EstimateNote source="web-search" />
          <Sources items={v.webEstimate.citations} />
        </>
      )}
      {v.conditionAdjusted && (
        <div className="price-row" style={{ background: "rgba(77,163,255,0.06)" }}>
          <span>
            <b>This copy, in its estimated condition</b>{" "}
            <span className="muted small">(× {v.conditionAdjusted.multiplier} of NM)</span>
          </span>
          <span className="v" style={{ color: "var(--accent)" }}>
            <Money v={v.conditionAdjusted.value} />
          </span>
        </div>
      )}
      {v.graded && (
        <>
          <div className="muted" style={{ margin: "12px 0 6px" }}>
            Graded value{" "}
            <span className="small">
              {v.graded.estimated
                ? v.graded.source === "cardgrader"
                  ? "(third-party estimate, CardGrader comps)"
                  : v.graded.source === "web-search"
                    ? "(read from public web pages, verified against source)"
                    : "(estimated from raw price multiples)"
                : "(eBay sales medians)"}
            </span>
          </div>
          {([["PSA 10", v.graded.psa10], ["PSA 9", v.graded.psa9], ["PSA 8", v.graded.psa8]] as const).map(
            ([label, price]) =>
              price != null && (
                <div className="price-row" key={label}>
                  <span>
                    {label}
                    {v.graded!.estimated && <span className="muted small"> (est.)</span>}
                  </span>
                  <span className="v"><Money v={price} /></span>
                </div>
              ),
          )}
          {v.graded.estimated && <EstimateNote source={v.graded.source} />}
          <Sources items={v.graded.citations} />
        </>
      )}
      {scan.slab && (
        <div className="muted small" style={{ marginTop: 8 }}>
          <span className="badge info">slab premium</span> The prices above are for{" "}
          <b>raw, ungraded copies</b>. A {scan.slab.company}-certified{" "}
          {scan.slab.gradeText} slab sells for a large premium over raw.{" "}
          {scan.slab.verifyUrl ? (
            <a href={scan.slab.verifyUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              see {scan.slab.company}&apos;s own value estimate on the cert page
            </a>
          ) : (
            "check recent graded sales for its real value"
          )}
          .
        </div>
      )}
      {v.updatedAt && (
        <div className="muted small" style={{ marginTop: 8 }}>
          Prices updated {new Date(v.updatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

/* ============ PRICE BUDGET ============ */
// Graded prices come from a metered provider with a daily credit budget. When
// it runs dry, cards still identify but price as blank — which reads like a
// broken scanner unless we say otherwise. This makes the budget visible.

type Quota = {
  provider: string;
  dailyLimit: number | null;
  dailyRemaining: number | null;
  totalRemaining: number | null;
  resetsAt: string | null;
  creditsPerLookup: number;
  lookupsLeft: number | null;
  lockedOut: boolean;
  cachedCards: number;
  observedAt: string | null;
  configured: boolean;
  /** What has actually happened, from the append-only ledger in the shared
   *  store. Distinct from `budget`, which is what providers will still allow. */
  scans?: {
    shared: boolean;
    today: number;
    month: number;
    total: number;
    billableToday: number;
    creditsToday: Record<string, number>;
    lastScanAt: string | null;
  };
  budget?: {
    scansLeft: number | null;
    scansPerDay: number | null;
    limitedBy: string | null;
    resetsAt: string | null;
    cachedCards: number;
    providers: {
      id: string;
      label: string;
      role: string;
      unit: string;
      used: number | null;
      limit: number | null;
      remaining: number | null;
      costPerScan: number;
      scansLeft: number | null;
      reported: boolean;
      gating: boolean;
      note?: string;
      period: string;
    }[];
  };
};

function untilReset(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "any moment";
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Shared so the topbar chip and the in-result banner never disagree. */
function useQuota(): { q: Quota | null; reload: () => void } {
  const [q, setQ] = useState<Quota | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/market/quota`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => alive && setQ(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [nonce]);
  return { q, reload: () => setNonce((n) => n + 1) };
}

function QuotaChip({ q }: { q: Quota | null }) {
  const [open, setOpen] = useState(false);
  if (!q || !q.configured) return null;
  const b = q.budget;
  const left = b?.scansLeft ?? q.lookupsLeft;
  const total = b?.scansPerDay ?? null;
  const done = q.scans?.today ?? 0;
  const out = q.lockedOut || left === 0;
  const low = left != null && left > 0 && left <= 3;
  const tone = out ? "is-out" : low ? "is-low" : "is-ok";

  return (
    <div className="quota-wrap">
      <button
        type="button"
        className={`quota-chip ${tone}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Price-lookup budget"
      >
        <span className="quota-dot" aria-hidden="true" />
        {/* Scans DONE leads, because it is a fact. Scans left is an estimate
            off provider quotas and moves for reasons nobody here caused — it
            used to be the only number shown, which is why it read as wrong. */}
        <span className="quota-done">{done} scanned</span>
        <span className="quota-sep" aria-hidden="true">·</span>
        <span className="quota-left">
          {left == null ? "budget ?" : `${left} left`}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="quota-pop" role="dialog" aria-label="Price lookup budget">
          {q.scans && (
            <div className="quota-ledger">
              <div className="quota-ledger-row">
                <span>Scans today</span>
                <b className="mono">{q.scans.today}</b>
              </div>
              <div className="quota-ledger-row">
                <span>This month</span>
                <b className="mono">{q.scans.month}</b>
              </div>
              <div className="quota-ledger-row">
                <span>All time</span>
                <b className="mono">{q.scans.total}</b>
              </div>
              <div className="quota-ledger-row muted small">
                <span>
                  {q.scans.billableToday} of today&apos;s cost credits. The rest were
                  already in the store
                </span>
              </div>
              <p className="quota-ledger-note muted small">
                Counted from a permanent record of every scan
                {q.scans.shared ? " shared by every instance" : " on this machine only"}. It
                does not reset when the server does.
              </p>
            </div>
          )}

          <div className="quota-pop-head">
            <b>New-card scans left today</b>
            {total != null && (
              <span className="quota-big">
                {left}
                <span className="muted">/{total}</span>
              </span>
            )}
          </div>

          {total != null && total > 0 && (
            <div className="quota-bar" aria-hidden="true">
              <div
                className={`quota-bar-fill ${tone}`}
                style={{ width: `${Math.max(0, Math.min(100, ((left ?? 0) / total) * 100))}%` }}
              />
            </div>
          )}

          {b?.limitedBy && (
            <p className="muted small quota-note" style={{ marginTop: 0 }}>
              Capped by <b style={{ color: "var(--text)" }}>{b.limitedBy}</b>. A scan is
              only as available as its tightest provider.
            </p>
          )}

          <div className="quota-providers">
            {(b?.providers ?? [])
              .filter((p) => p.gating || p.used)
              .map((p) => {
                const pct =
                  p.limit && p.limit > 0
                    ? Math.max(0, Math.min(100, ((p.remaining ?? 0) / p.limit) * 100))
                    : null;
                const dry = p.scansLeft === 0;
                return (
                  <div className="quota-prov" key={p.id}>
                    <div className="quota-prov-top">
                      <span className={dry ? "down-text" : undefined}>
                        <b>{p.label}</b>
                        <span className="muted small"> · {p.role}</span>
                      </span>
                      <span className="v">
                        {p.limit != null
                          ? `${p.remaining ?? 0}/${p.limit}`
                          : `${p.used ?? 0} used`}
                      </span>
                    </div>
                    {pct != null && (
                      <div className="quota-bar sm" aria-hidden="true">
                        <div
                          className={`quota-bar-fill ${dry ? "is-out" : pct <= 20 ? "is-low" : "is-ok"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    <div className="quota-prov-sub muted small">
                      {p.costPerScan} {p.unit}/scan
                      {p.scansLeft != null && ` · ${p.scansLeft} scans`}
                      {` · per ${p.period}`}
                      {!p.reported && " · measured locally"}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="quota-line">
            <span>Cards already cached</span>
            <span className="v">{q.cachedCards} · free</span>
          </div>
          {q.resetsAt && (
            <div className="quota-line">
              <span>Resets in</span>
              <span className="v">{untilReset(q.resetsAt)}</span>
            </div>
          )}

          <p className="muted small quota-note">
            {out
              ? "Budget spent. Cards still scan and identify, and anything already cached still prices, but a card we have not priced before will show no market value until the reset."
              : "Only cards we have not priced before spend credits. Repeat scans are served from cache and cost nothing."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Shown inside the result when a blank price is explained by the budget,
 *  so the empty state is never mistaken for a detection failure. */
function QuotaBanner({ scan, q }: { scan: Scan; q: Quota | null }) {
  if (!q || !q.configured) return null;
  const out = q.lockedOut || (q.budget?.scansLeft ?? q.lookupsLeft) === 0;
  if (!out) return null;
  const hasPrice = Boolean(
    scan.valuation?.graded ||
      scan.valuation?.tcgplayer?.market ||
      scan.valuation?.cardmarket?.trend ||
      scan.valuation?.webEstimate,
  );
  if (hasPrice) return null; // priced from cache — nothing to apologise for
  return (
    <div className="quota-banner">
      <span className="badge warn">price budget spent</span>
      <span>
        The card was identified correctly. The missing value is our price
        provider&apos;s daily credit budget, not the scan.
        {q.resetsAt ? ` Resets in ${untilReset(q.resetsAt)}.` : ""}
      </span>
    </div>
  );
}

/* ============ PRICE HERO ============ */
// Pricing is the reason people scan a card, so it leads the page and always
// renders — including the "we found nothing" case, which is information too.
// Everything here is derived once and reused by GradePanel below.

type PriceView = {
  headline: number | null;      // the number that answers "what is it worth"
  headlineUnit: string;         // currency the headline is quoted in
  headlineLabel: string;        // what that number represents
  /** slab detected but the grade could not be read off the label */
  slabGradeUnknown: boolean;
  raw: number | null;           // ungraded market, for context
  rawUnit: string;
  grades: { label: string; value: number | null; isSlab: boolean }[];
  /** the company on the label, if any */
  slabCompany: string | null;
  /** median LIVE ASKING price at this exact grader+grade, where we hold no
   *  sold comps for it. An ask, clearly labelled as one — never a sale. */
  ask: {
    median: number; low?: number | null; high?: number | null;
    count: number; grader?: string | null; grade?: number | null; raw?: boolean;
    printing?: string | null;
    staleCeiling?: number | null; staleCeilingDays?: number | null; cappedByStale?: boolean;
    otherPrintings?: { name: string; count: number; low: number; high: number }[];
  } | null;
  /** true when the headline figure is an asking price, not a completed sale */
  headlineIsAsk: boolean;
  /** true when the sale comps are from a DIFFERENT grader than the slab.
   *  Our comps are PSA sales; a BGS or CGC card is being read across. */
  crossGrader: boolean;
  blendedVariant: boolean;
  slabPrice: Scan["valuation"] extends infer V
    ? V extends { slabPrice?: infer P }
      ? P | null
      : null
    : null;
  verified: boolean;            // real sold comps vs our own estimate
  source: string | null;
};

/** Numeric grade off a slab label ("NM-MT 8.5" -> 8.5, "GEM MT 10" -> 10). */
function slabGradeNum(scan: Scan): number {
  if (!scan.slab) return NaN;
  // Prefer the numeric grade the reader already resolved. Scraping it back out
  // of a display string fails whenever the label prints a word and no digit —
  // "PSA MINT" is a grade of 9, but the regex sees nothing.
  const fromField = scan.valuation?.slabGrade;
  if (typeof fromField === "number" && Number.isFinite(fromField)) return fromField;
  return Number(scan.slab.gradeText.match(/(\d+(?:\.\d)?)\s*$/)?.[1]);
}

function priceView(scan: Scan): PriceView {
  const v = scan.valuation;
  const g = v?.graded ?? null;
  const rawUnit =
    v?.tcgplayer?.market != null
      ? v.tcgplayer.unit || "USD"
      : v?.cardmarket?.trend != null
        ? v.cardmarket.unit || "EUR"
        : "USD";
  const raw =
    v?.tcgplayer?.market ?? v?.cardmarket?.trend ?? v?.webEstimate?.value ?? null;

  const n = slabGradeNum(scan);
  // A slab whose grade digit we could not read. Falling back to the raw price
  // here is the worst possible answer: the card is demonstrably graded, and a
  // raw quote understates it by an order of magnitude. Say we cannot read it
  // and point at the grade ladder instead.
  const slabGradeUnknown = Boolean(scan.slab) && !Number.isFinite(n);
  // A slabbed card is worth its GRADED price, at ITS OWN grader.
  //
  // This used to read g.psa10 / g.psa9 / g.psa8 — the legacy flat shape, which
  // has no grader dimension at all — and so quoted a PSA figure for every
  // slab, whatever was on the holder. The comment below it said "every graded
  // comp we can buy is a PSA sale", and that stopped being true: the API sends
  // pricesByGrader, and for a Beckett Destined Rivals Mewtwo it was sending
  // BGS 10 at $1,364 from 23 sales, high confidence, while this line reported
  // the PSA 10 figure of $1,150 and labelled it a cross-grader estimate. The
  // right number was on screen in the Beckett tab the whole time.
  const gradeKey = Number.isFinite(n) ? String(n).replace(/\.0$/, "") : null;
  const ownGrader =
    scan.slab && gradeKey
      ? v?.pricesByGrader?.[scan.slab.company]?.[gradeKey] ?? null
      : null;
  // Fall back to the nearest PSA tier ONLY when we hold nothing for this
  // grader at this grade. That is a genuine cross-grader estimate; the case
  // above is not.
  const psaTier =
    scan.slab && g && Number.isFinite(n)
      ? (n >= 9.5 ? g.psa10 : n >= 9 ? g.psa9 : g.psa8) ?? null
      : null;
  const slabValue = ownGrader?.price ?? psaTier;

  const likely = scan.recommendation?.likelyGrade ?? null;
  const likelyValue = likely
    ? scan.recommendation?.rows?.find((r) => r.grade === likely)?.value ?? null
    : null;

  // A raw card is worth its raw market price. There is no condition
  // adjustment any more — we stopped grading, so there is no grade to
  // discount by, and inventing one turned an $84 card into $21.
  const slabCompany = scan.slab?.company ?? null;
  const ask = v?.liveAsk ?? null;
  // Every graded comp we can buy is a PSA sale. For a Beckett or CGC slab we
  // are therefore quoting the nearest PSA tier, not a sale of this card in
  // this holder — and the two are not interchangeable. Say so rather than
  // printing "PSA 8" over a Beckett 8.5.
  const crossGrader = Boolean(
    slabCompany &&
      slabCompany !== "PSA" &&
      slabCompany !== "UNKNOWN" &&
      slabValue != null &&
      ownGrader == null, // we quoted PSA because we hold nothing for this grader
  );

  // A figure that blends label variants is not a price for THIS holder.
  //
  // Beckett's 10 is two products. A Black Label 10 — all four subgrades
  // exactly 10 — and a gold-label Pristine share the key `bgs10` at our
  // source, so the median we hold blends them: $1,364 for a card whose Black
  // Label copies sell between $12,700 and $14,300. Showing that under a Black
  // Label badge is a confident wrong answer, so it is flagged rather than
  // quoted as though it fits.
  const blendedVariant = Boolean(
    ownGrader?.blended && v?.slabLabelVariant === "black",
  );

  // An asking price for the RIGHT grader and grade beats a completed sale from
  // the wrong one, so it outranks a cross-grader figure — but never a genuine
  // same-grader sale.
  // A raw card's ask wins over the catalog's raw price when the ask is for a
  // DIFFERENT printing than the catalog quotes: TCGplayer's $1.90 is the base
  // SR of OP07-085, and this copy is the SP treatment at about $130.
  // The backend decides what this holder is worth, and says how it got there.
  //
  // It walks a ladder — a sale at this exact grader and grade, then this
  // company's neighbouring grades, then a measured cross-grader ratio — and it
  // will hand back the ASKING market when the recorded sale contradicts its own
  // grade ladder. That last case is why the Gold Star showed A$15,750 from a
  // BGS 8.5 figure sitting below its own BGS 8, while three real BGS 8.5
  // listings on the same page asked A$26,215, A$34,953 and A$45,000.
  //
  // None of that reasoning can be reproduced here — it needs the whole grade
  // ladder and the ratio model — so this stops second-guessing it and renders
  // what it was given. The older logic below remains for responses that predate
  // slabPrice.
  const slabPrice = v?.slabPrice ?? null;
  const headlineIsAsk =
    slabPrice != null
      ? slabPrice.basis === "ask-over-suspect-sale"
      : ask != null && (ask.raw ? Boolean(ask.printing) : slabValue == null || crossGrader);

  // A slabbed card is NEVER quoted at its raw price. That fallback is what put
  // A$2.78 above a One Piece BGS 9.5 whose own listings panel, on the same
  // screen, showed A$800-2,374. With no graded figure and no ask we say so and
  // show nothing — a blank is cheap, a wrong number is not.
  // A suspect identification suppresses the price entirely.
  //
  // The backend works out that a $0.08 raw card in a PSA 10 holder is almost
  // certainly a different printing sharing the collector number, and says so.
  // Printing a number under that warning is the same mistake as pricing a
  // photo we rejected: we have already concluded we do not know what this card
  // is, and a figure derived from the wrong card does not become safe by
  // having a caveat above it. The listings below are the honest answer.
  const identSuspect = v?.identificationSuspect ?? null;

  const headline = identSuspect
    ? null
    : slabPrice
    ? slabPrice.price
    : slabGradeUnknown && !headlineIsAsk
      ? null
      : headlineIsAsk
        ? ask!.median
        : scan.slab
          ? slabValue ?? null
          : raw ?? null;
  // asks and graded comps are USD; only `raw` can be EUR
  const headlineUnit = headline === raw && !scan.slab ? rawUnit : "USD";

  const headlineLabel = identSuspect
    ? "we can't price this one, see below"
    : slabPrice
    ? slabPrice.basis === "ask-over-suspect-sale"
      ? `median asking price · ${slabPrice.sampleSize} live ${scan.slab?.company ?? ""} ${slabGradeNum(scan)} listings. Our recorded sales for this grade contradict the grade below it`
      : slabPrice.basis === "observed"
        ? blendedVariant
          ? `${scan.slab!.company} ${scan.slab!.gradeText}, BLACK LABEL. Our ${scan.slab!.company} ${slabGradeNum(scan)} figure blends label variants and understates a Black Label. Check Black Label sold listings before pricing.`
          : `in its ${scan.slab!.company} ${scan.slab!.gradeText} slab`
        : slabPrice.explain
    : headlineIsAsk
    ? `median asking price · ${ask!.count} live ${
        ask!.grader && ask!.grade != null
          ? `${ask!.grader} ${ask!.grade}`
          : ask!.grader
            // A slab whose grade is not a number — PSA "AUTHENTIC" — is still a
            // slab. Calling these "ungraded" listings would describe the one
            // thing about the card that is certainly false.
            ? `${ask!.grader}-graded (grades mixed)`
            : "ungraded"
      } listings`
    : slabValue
      ? blendedVariant
        ? `${scan.slab!.company} ${scan.slab!.gradeText}, BLACK LABEL. Our ${scan.slab!.company} ${slabGradeNum(scan)} figure blends label variants and understates a Black Label. Check Black Label sold listings before pricing.`
        : crossGrader
        ? `${scan.slab!.company} ${scan.slab!.gradeText}, priced at the nearest PSA tier`
        : `in its ${scan.slab!.company} ${scan.slab!.gradeText} slab`
      : raw != null
        ? "raw, ungraded market price"
        : "no market price found";

  const grades = g
    ? ([["PSA 10", g.psa10, 10], ["PSA 9", g.psa9, 9], ["PSA 8", g.psa8, 8]] as const).map(
        ([label, value, tier]) => ({
          label,
          value: value ?? null,
          // highlight the tier the slab actually sits in
          isSlab:
            Number.isFinite(n) &&
            (tier === 10 ? n >= 9.5 : tier === 9 ? n >= 9 && n < 9.5 : n < 9),
        }),
      )
    : [];

  return {
    headline,
    headlineUnit,
    headlineLabel,
    slabGradeUnknown,
    raw,
    rawUnit,
    grades,
    slabCompany,
    ask,
    headlineIsAsk,
    crossGrader,
    blendedVariant,
    // "verified sales" means the headline IS a completed sale. When the ladder
    // handed back an asking price — because the recorded sale contradicted its
    // own grade ladder — that badge would be a straight untruth, and it sits
    // directly beneath the number.
    verified:
      slabPrice != null
        ? slabPrice.basis === "observed"
        : Boolean(g && !g.estimated),
    slabPrice,
    source: g?.source ?? (v?.tcgplayer ? "tcgplayer" : v?.cardmarket ? "cardmarket" : null),
  };
}

const SOURCE_LABEL: Record<string, string> = {
  pokemonpricetracker: "eBay sold comps · PokemonPriceTracker",
  cardgrader: "CardGrader comps",
  "web-search": "read from public web pages, verified against source",
  estimate: "our own multiples off the raw price, not a pricing service",
  tcgplayer: "TCGplayer market",
  cardmarket: "Cardmarket trend",
};


/* ── grader tabs ─────────────────────────────────────────────────────────────
   A grade belongs to the company that issued it, so the prices are shown per
   grader rather than as a single PSA ladder. Selecting a grader we hold no
   sales for says exactly that: a Beckett card must never display PSA figures
   under a Beckett heading. */

const GRADER_ORDER = ["Ungraded", "PSA", "BGS", "CGC", "SGC", "TAG", "ACE"];
const GRADER_LABEL: Record<string, string> = {
  BGS: "BECKETT", PSA: "PSA", CGC: "CGC", SGC: "SGC", TAG: "TAG", ACE: "ACE",
  Ungraded: "Ungraded",
};

function GraderTabs({ scan, pv }: { scan: Scan; pv: PriceView }) {
  const v = scan.valuation;
  const byGrader = v?.pricesByGrader ?? {};
  const slabGrader = v?.slabGrader ?? null;
  // open on the card's own grader — that is the question the owner is asking
  const [active, setActive] = useState<string>(slabGrader ?? "Ungraded");
  useEffect(() => {
    setActive(slabGrader ?? "Ungraded");
  }, [slabGrader]);

  const rawValue = pv.raw;
  const grades = byGrader[active] ?? {};
  const gradeKeys = Object.keys(grades).sort((a, b) => Number(b) - Number(a));
  const slabGradeStr =
    v?.slabGrade != null ? String(v.slabGrade).replace(/\.0$/, "") : null;

  return (
    <div className="ph-graders">
      <div className="grader-tabs" role="tablist" aria-label="Grading company">
        {GRADER_ORDER.map((g) => {
          const has = g === "Ungraded" ? rawValue != null : Boolean(byGrader[g]);
          const isCardGrader = g === slabGrader;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={active === g}
              className={
                "grader-tab" +
                (active === g ? " is-active" : "") +
                (isCardGrader ? " is-card" : "") +
                (has ? "" : " is-empty")
              }
              onClick={() => setActive(g)}
            >
              {GRADER_LABEL[g] ?? g}
              {isCardGrader && <span className="grader-dot" aria-label="this card" />}
            </button>
          );
        })}
      </div>

      {active === "Ungraded" ? (
        rawValue != null ? (
          <div className="ph-grades">
            <div className="ph-grade">
              <div className="ph-grade-label">Raw · ungraded</div>
              <div className="ph-grade-value">
                <Money v={rawValue} unit={pv.rawUnit} showSource={false} />
              </div>
            </div>
          </div>
        ) : (
          <p className="grader-empty muted small">No ungraded market price for this card.</p>
        )
      ) : gradeKeys.length > 0 ? (
        <div className="ph-grades">
          {gradeKeys.map((k) => {
            const mine = active === slabGrader && k === slabGradeStr;
            // Accept either a bare number or a GradePoint. A browser holding
            // an older bundle against a newer API rendered $NaN otherwise, and
            // a price that says NaN is worse than one that is slightly stale.
            const rawPt = grades[k] as unknown;
            const pt =
              typeof rawPt === "number"
                ? { price: rawPt as number, count: null, confidence: null }
                : (rawPt as { price: number; count?: number | null; confidence?: "high" | "medium" | "low" | null });
            const thin = (pt.count ?? 0) > 0 && (pt.count as number) < 3;
            return (
              <div className={`ph-grade${mine ? " is-slab" : ""}`} key={k}>
                <div className="ph-grade-label">
                  {GRADER_LABEL[active] ?? active} {k}
                  {mine && <span className="ph-grade-you">this card</span>}
                </div>
                <div className="ph-grade-value">
                  <Money v={pt.price} showSource={false} />
                </div>
                {/* the figure alone hides how much is behind it: the same
                    number can be 400 sales or a single anecdote */}
                <div className="ph-grade-eviq">
                  {pt.count != null && (
                    <span className={thin ? "eviq-thin" : undefined}>
                      {pt.count === 1 ? "1 sale" : `${pt.count} sales`}
                    </span>
                  )}
                  {pt.confidence && (
                    <span className={`eviq-dot eviq-${pt.confidence}`} title={`${pt.confidence} confidence`} />
                  )}
                  {pt.confidence && <span>{pt.confidence}</span>}
                </div>
                {thin && (
                  <div className="ph-grade-warn">
                    Too few sales to be a market price. Treat it as an anecdote.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="grader-empty muted small">
          <b>No {GRADER_LABEL[active] ?? active} sales data available to us.</b>{" "}
          {active === slabGrader
            ? `This card is a ${GRADER_LABEL[active]} ${slabGradeStr ?? ""}. The figure above is taken from the nearest PSA tier, which is a different grading scale.`
            : "Our sold-comp source publishes PSA sales only."}
        </p>
      )}
    </div>
  );
}


/* ── search by name ──────────────────────────────────────────────────────────
   Scanning answers "what is this card in front of me". Search answers "what is
   this worth" when it is not — a want list, a deal over the phone, a collection
   being valued off a spreadsheet.

   Search resolves to the same catalog identity a scan resolves to and prices it
   through the same chain, because a scan and a search that land on the same card
   must not quote two different figures for it. */

type SearchHit = {
  cardId: string; name: string; nameLocal: string | null;
  setId: string; setName: string; localId: string;
  rarity: string | null; imageUrl: string | null; game: string; score: number;
};

type PriceResult = {
  name: string; setName: string | null; number: string | null;
  grader: string | null; grade: number | null;
  rawUsd: number | null;
  byGrader: Record<string, Record<string, { price?: number | null; count?: number | null; confidence?: string | null }>> | null;
  sold: { price?: number | null; count?: number | null; confidence?: string | null } | null;
  liveAsk: {
    median: number; low: number | null; high: number | null; count: number;
    printing: string | null; staleCeilingDays: number | null;
  } | null;
  listings: Listing[];
};

const GRADE_CHOICES = ["10", "9.5", "9", "8.5", "8", "7", "6", "5"];

function SearchPanel() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [grader, setGrader] = useState("PSA");
  const [grade, setGrade] = useState("10");
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [pricing, setPricing] = useState(false);
  const [open, setOpen] = useState(false);

  const [why, setWhy] = useState<string | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setState("loading"); setPicked(null); setPrice(null); setWhy(null);

    // One retry, because the common failure here is not a broken search but a
    // server that happened to be restarting — a dev reload, or a hosted
    // instance waking from sleep. Reporting that as "unavailable" sends people
    // to debug a system that is about to work.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(`${API}/market/search?q=${encodeURIComponent(q)}&limit=24`, {
          signal: AbortSignal.timeout(25000),
        });
        if (!r.ok) {
          setWhy(`the search service answered ${r.status}`);
          setState("error");
          return;
        }
        const j = await r.json();
        setHits(j.results ?? []); setState("done");
        return;
      } catch (err) {
        const e = err as Error;
        if (attempt === 0) {
          await new Promise((res) => setTimeout(res, 900));
          continue;
        }
        setWhy(
          e.name === "TimeoutError"
            ? "the search service did not answer in time"
            : `could not reach the search service at ${API}`,
        );
        setState("error");
      }
    }
  }

  // The grader and grade are part of the question, so changing either asks it
  // again rather than leaving a stale figure on screen under a new label.
  useEffect(() => {
    if (!picked) return;
    let alive = true;
    setPricing(true); setPrice(null);
    const p = new URLSearchParams({ name: picked.name });
    if (picked.setName) p.set("set", picked.setName);
    if (picked.localId) p.set("number", picked.localId);
    if (grader !== "Ungraded") { p.set("grader", grader); p.set("grade", grade); }
    if (picked.nameLocal) p.set("lang", "ja");
    fetch(`${API}/market/price?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) { setPrice(j); setPricing(false); } })
      .catch(() => alive && setPricing(false));
    return () => { alive = false; };
  }, [picked, grader, grade]);

  const figure = price?.sold?.price ?? price?.liveAsk?.median ?? price?.rawUsd ?? null;
  const isSold = price?.sold?.price != null;
  const isAsk = !isSold && price?.liveAsk?.median != null;

  return (
    <section className={`search-panel ${open ? "open" : ""}`}>
      <button className="search-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="label-mono accent-text">Search by name</span>
        <span className="muted small">
          {open ? "hide" : "price a card without scanning it"}
        </span>
      </button>

      {open && (
        <div className="search-body">
          <form className="search-row" onSubmit={run}>
            <input
              className="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Card name, or a code like OP13-119"
              aria-label="Card name"
            />
            <button className="primary" type="submit" disabled={q.trim().length < 2 || state === "loading"}>
              {state === "loading" ? "Searching…" : "Search"}
            </button>
          </form>

          {state === "error" && (
            <p className="note">
              Search didn&apos;t run. {why ?? "The request failed"}. Try again; if it keeps
              failing the API may not be running.
            </p>
          )}
          {state === "done" && hits?.length === 0 && (
            <p className="note">
              Nothing matched “{q}” . Not in any catalogue we hold, and no listings for it
              either. Try the card&apos;s printed name, or its number.
            </p>
          )}
          {hits?.length === 1 && hits[0].cardId === "market" && (
            <p className="note">
              No catalogue we hold covers this card, so it is priced straight from what the
              market is doing with it. You identify the card, not us, so check the listing
              titles below match the copy you have.
            </p>
          )}

          {hits && hits.length > 0 && (
            <div className="search-results">
              {hits.map((h) => (
                <button
                  key={h.cardId}
                  className={`search-hit ${picked?.cardId === h.cardId ? "on" : ""}`}
                  onClick={() => setPicked(h)}
                >
                  {h.imageUrl
                    ? <img src={h.imageUrl} alt="" loading="lazy" />
                    : <span className="search-noimg" />}
                  <span className="search-hit-text">
                    <span className="search-hit-name">{h.name}</span>
                    {h.nameLocal && <span className="search-hit-local" lang="ja">{h.nameLocal}</span>}
                    <span className={`search-hit-meta${h.cardId === "market" ? " market" : ""}`}>
                      {h.cardId === "market"
                        ? [h.localId ? `#${h.localId}` : null, "priced from live listings"]
                            .filter(Boolean).join(" · ")
                        : [h.setName || h.setId, h.localId ? `#${h.localId}` : null, h.rarity]
                            .filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {picked && (
            <div className="search-price">
              <div className="search-price-head">
                <div className="search-picked">
                  {/* The catalog image where there is one. Where there is not —
                      a card no catalog of ours covers — a listing photo is the
                      only picture of it that exists, and seeing the card is how
                      you check we are pricing the right one. */}
                  {(picked.imageUrl ?? price?.listings?.find((l) => l.imageUrl)?.imageUrl) ? (
                    <img
                      className="search-picked-img"
                      src={picked.imageUrl ?? price!.listings.find((l) => l.imageUrl)!.imageUrl!}
                      alt={picked.name}
                    />
                  ) : (
                    <span className="search-picked-img placeholder" aria-hidden="true" />
                  )}
                  <div>
                    <div className="search-hit-name">{picked.name}</div>
                    <div className="muted small">
                      {[picked.setName, picked.localId ? `#${picked.localId}` : null]
                        .filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="search-grade">
                  <select value={grader} onChange={(e) => setGrader(e.target.value)} aria-label="Grading company">
                    {["Ungraded", "PSA", "BGS", "CGC", "SGC", "TAG", "ACE"].map((g) => (
                      <option key={g} value={g}>{g === "BGS" ? "BECKETT" : g}</option>
                    ))}
                  </select>
                  {grader !== "Ungraded" && (
                    <select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Grade">
                      {GRADE_CHOICES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {pricing && <p className="note">Pricing…</p>}

              {!pricing && figure != null && (
                <>
                  <div className="label-mono accent-text">
                    {isSold ? `LAST SOLD · ${grader} ${grade}`
                      : isAsk ? `CURRENT ASKING PRICE · ${grader === "Ungraded" ? "UNGRADED" : `${grader} ${grade}`}`
                      : "UNGRADED MARKET PRICE"}
                  </div>
                  <div className="ph-price">
                    <Money v={figure} unit="USD" showSource={false} />
                    <span className="ph-est-tag">{isSold ? "sold" : isAsk ? "asking" : "market"}</span>
                  </div>
                  <div className="muted small ph-sub">
                    {isSold && (
                      <>
                        {price!.sold!.count} completed sales
                        {price!.sold!.confidence ? ` · ${price!.sold!.confidence} confidence` : ""}
                      </>
                    )}
                    {isAsk && (
                      <>
                        {price!.liveAsk!.count} live listings
                        {price!.liveAsk!.printing ? ` · matched to ${price!.liveAsk!.printing}` : ""}
                        {price!.liveAsk!.staleCeilingDays
                          ? ` · held to an ask unsold ${price!.liveAsk!.staleCeilingDays} days`
                          : ""}
                      </>
                    )}
                    {!isSold && !isAsk && "market price for an ungraded copy"}
                  </div>
                  {price?.rawUsd != null && figure !== price.rawUsd && (
                    <div className="muted small ph-sub">
                      raw, ungraded <b style={{ color: "var(--text)" }}>
                        <Money v={price.rawUsd} unit="USD" showSource={false} />
                      </b>
                    </div>
                  )}
                </>
              )}

              {!pricing && figure == null && (
                <p className="note">
                  No price reaches us for a {grader === "Ungraded" ? "raw copy" : `${grader} ${grade}`} of
                  this card. Try another grade, or scan the card itself.
                </p>
              )}

              {!pricing && (price?.listings?.length ?? 0) > 0 && (
                <div className="search-listings">
                  <div className="label-mono">What these are</div>
                  {price!.listings.slice(0, 6).map((l) => (
                    <a key={l.url} className="search-listing" href={l.url} target="_blank" rel="noreferrer">
                      {l.imageUrl && <img src={l.imageUrl} alt="" loading="lazy" />}
                      <span className="search-listing-text">
                        <span className="search-listing-title">{l.title}</span>
                        <span className="search-listing-meta">
                          {[
                            l.grader && l.grade != null ? `${l.grader} ${l.grade}` : null,
                            l.printing,
                            l.ageDays != null
                              ? l.ageDays === 0 ? "listed today" : `listed ${l.ageDays}d ago`
                              : null,
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="search-listing-price">
                        {l.price != null && <Money v={l.price} unit={l.currency} showSource={false} />}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── the card, as the phone shows it ──────────────────────────────────────────
   Your photograph beside the catalogue's picture. The page is claiming these
   are the same card, and side by side that claim can be checked at a glance,
   which is the only check that catches a confident wrong match. Same order as
   the mobile result screen, so the two products answer a scan the same way. */

const isCatalogueId = (cardId?: string | null) =>
  Boolean(cardId && cardId !== "llm" && cardId !== "described" && !cardId.startsWith("sport-"));

function ScanHeader({ scan, photo }: { scan: Scan; photo: File | null }) {
  const id = scan.identification;
  const [src, setSrc] = useState<string | null>(null);
  const [mineFailed, setMineFailed] = useState(false);
  useEffect(() => {
    setMineFailed(false);
    if (!photo) { setSrc(null); return; }
    const url = URL.createObjectURL(photo);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const mine = src ?? `${API}/storage/${scan.id}/front_warped.png`;
  const catalogued = isCatalogueId(id?.cardId);
  const unconfirmed = !catalogued || id?.printingConfirmed === false;

  return (
    <section className="scan-head" aria-label="Your card">
      <div className="match-compare">
        <figure>
          {mineFailed ? (
            <div className="match-empty">No photo</div>
          ) : (
            <img src={mine} alt="Your photo of the card" onError={() => setMineFailed(true)} />
          )}
          <figcaption>Your picture</figcaption>
        </figure>
        <figure>
          {id?.imageUrl ? (
            <img className="is-catalogue" src={id.imageUrl} alt={`Catalogue picture of ${id.name}`} loading="lazy" />
          ) : (
            <div className="match-empty">No catalogue picture</div>
          )}
          <figcaption>
            Your match{catalogued && id?.matchScore != null ? ` · ${Math.round(id.matchScore * 100)}%` : ""}
          </figcaption>
        </figure>
      </div>

      {/* Why there is no value, said where the match is shown. A blank price
          with no reason reads as a broken page. */}
      {id && unconfirmed && (
        <div className="unconfirmed-note" role="note">
          <span className="unconfirmed-icon" aria-hidden="true">!</span>
          <span>
            {id.game === "sports"
              ? "Sports cards aren't in a catalogue we can check yet, so no value is asserted for this one. What sellers are asking is shown below as a guide."
              : id.cardId === "described"
                ? "No catalogue matched this card, so the name was read off it. No value is asserted. Search for it by name to find the exact card."
                : id.unconfirmedReason === "name-not-on-card"
                  ? "We couldn't find this name printed on your card, so it's a best guess from the picture. Check it before relying on it. No value is asserted."
                  : "We couldn't read the card number or set code, so we can't tell which printing this is. Printings can differ in price by hundreds of dollars, so no value is asserted. What sellers are asking is shown below as a guide."}
          </span>
        </div>
      )}

      <div className="scan-id">
        <h2 className="scan-name">{id?.name ?? "Unidentified card"}</h2>
        {id?.nameLocal && id.nameLocal !== id.name && (
          <div className="ph-name-local" lang="ja">{id.nameLocal}</div>
        )}
        <div className="muted small">
          {[
            // the set code identifies the set in any language; the local
            // name alone tells an English reader nothing
            id?.setId && id.setId !== id.setName ? `${id.setId} · ${id.setName}` : id?.setName,
            id?.localId ? `#${id.localId}` : null,
            id?.rarity,
          ]
            .filter(Boolean)
            .join(" · ") || "no catalogue match"}
        </div>
        <div className="scan-chips">
          <span className={`scan-chip${scan.slab ? " is-slab" : ""}`}>
            {scan.slab ? `Graded by ${scan.slab.company} · ${scan.slab.gradeText}` : "Ungraded"}
          </span>
          {scan.slab?.certNumber && <span className="scan-chip">Cert {scan.slab.certNumber}</span>}
          {id?.game && GAME_LABELS[id.game] && <span className="scan-chip">{GAME_LABELS[id.game]}</span>}
        </div>
      </div>
    </section>
  );
}

/* ── live asks, fetched once ──────────────────────────────────────────────────
   The price cards and the Asking Now panel read the SAME call. When each
   fetched its own, the phone offered a "choice" between our valuation and
   itself while the actual asking price sat two scrolls away. Kept off the scan
   response so it does not add latency to the number people are waiting for. */

type Listing = {
  title: string; price: number | null; currency: string; condition: string | null;
  imageUrl: string | null; url: string; seller: string | null;
  sellerFeedbackPct?: number | null; bestOffer?: boolean;
  grader: string | null; grade: number | null;
  printing: string | null;
  ageDays?: number | null;
  printingMatch?: "match" | "conflict" | "unknown";
};

type Asks = {
  listings: Listing[]; total: number; matched?: number; trimmed?: number;
  filteredToGrade: boolean;
  medianAsk: number | null; askLow: number | null; askHigh: number | null;
  printing?: string | null; filteredToPrinting?: boolean;
  staleCeilingDays?: number | null; cappedByStale?: boolean;
  /** set when the server refuses a middle figure for this entry */
  unpriceable?: string;
};
type AsksState = { data: Asks | null; state: "loading" | "done" | "error" };

function useLiveAsks(scan: Scan, enabled: boolean): AsksState {
  const id = scan.identification;
  const v = scan.valuation;
  const [data, setData] = useState<Asks | null>(null);
  const [state, setState] = useState<AsksState["state"]>("loading");

  useEffect(() => {
    if (!enabled || !id?.name) { setData(null); setState("done"); return; }
    setState("loading");
    const q = new URLSearchParams({ name: id.name });
    if (id.setName && !/^unknown/i.test(id.setName)) q.set("set", id.setName);
    if (id.localId) q.set("number", id.localId);
    if (v?.slabGrader) q.set("grader", v.slabGrader);
    if (v?.slabGrade != null) q.set("grade", String(v.slabGrade));
    // Narrow to the same printing the valuation used. Without this the panel
    // and the figure above it disagree, and nothing on screen explains why.
    if (v?.liveAsk?.printing) q.set("printing", v.liveAsk.printing);
    // The game and id let the server recognise a sports entry and refuse a
    // median across a player's base cards, parallels and one-of-ones.
    if (id.game) q.set("game", id.game);
    if (isCatalogueId(id.cardId)) q.set("cardId", id.cardId);
    if (scan.origin?.japaneseTextDetected) q.set("ja", "1");
    else if (scan.origin?.language === "en") q.set("lang", "en");
    let alive = true;
    fetch(`${API}/market/listings?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!alive) return; setData(j); setState("done"); })
      .catch(() => { if (alive) { setData(null); setState("error"); } });
    return () => { alive = false; };
  }, [enabled, id?.name, id?.setName, id?.localId, id?.game, id?.cardId, v?.slabGrader,
      v?.slabGrade, v?.liveAsk?.printing, scan.origin?.japaneseTextDetected, scan.origin?.language]);

  return { data, state };
}

/** Whether the middle of the asks describes THIS card, and if not, why.
 *
 *  A median is only a price for the card when the listings are all that card.
 *  When we could not prove the printing, the listings for the name include the
 *  other printings; for a sports player they include every parallel. The rows
 *  are still real asks and still shown, as a spread rather than a figure. */
function asksMedianTrust(scan: Scan, data: Asks | null): { ok: boolean; why: string } {
  const id = scan.identification;
  if (data?.unpriceable === "player-in-set" || id?.game === "sports") return { ok: false, why: "sports" };
  if (data?.unpriceable) return { ok: false, why: "catalogue" };
  if (!id || !isCatalogueId(id.cardId) || id.printingConfirmed === false) return { ok: false, why: "unconfirmed" };
  if (scan.valuation?.identificationSuspect) return { ok: false, why: "suspect" };
  if (scan.slab && !Number.isFinite(slabGradeNum(scan))) return { ok: false, why: "grade" };
  return { ok: true, why: "thin" };
}

const RANGE_WHY: Record<string, string> = {
  sports:
    "Listings for a player in a set mix base cards, parallels and numbered cards, so this is the spread of what is listed rather than a middle figure that would describe none of them.",
  unconfirmed:
    "We couldn't confirm which printing this is, so these listings can include other printings of the same card. Use the spread as a guide, not as this card's price.",
  suspect:
    "More than one printing shares this card number, so these listings can mix them. Check the printing before relying on the spread.",
  grade: "The grade on the label couldn't be read, so these listings span every grade.",
  catalogue:
    "Listing titles can't reliably tell this edition apart from others, so there is no middle figure, only the spread.",
  thin: "Too few listings match this exact card for a middle figure, so this is the spread of what is listed.",
};

/** Lowest and highest live ask, in US dollars, across the rows returned. */
function listedRange(data: Asks, fx: FxTable): { low: number; high: number; count: number } | null {
  const usd = data.listings
    .map((l) => (l.price == null ? null : convert(l.price, l.currency || "USD", "USD", fx)))
    .filter((n): n is number => n != null && n > 0);
  if (usd.length === 0) return null;
  return { low: Math.min(...usd), high: Math.max(...usd), count: usd.length };
}

const monthsOf = (days: number) => (days >= 60 ? `${Math.round(days / 30)} months` : `${days} days`);

const dayOf = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/* ── the price cards ──────────────────────────────────────────────────────────
   Up to three answers to different questions, side by side, as on the phone:

     what it sold for      completed sales of this card at this grade
     what it's worth       our valuation, from sales or the catalogue
     what people are asking  the live market, which reads high

   A card with no value used to show "n/a" here while real asks for it sat in a
   panel further down. An ask is not a value and is never labelled as one, but
   it is the closest honest signal there is, so it takes the empty slot. */

type PriceSides = {
  ours: number | null;
  sold: { amount: number; count: number | null; low: number | null; high: number | null; asOf: string | null } | null;
  asks:
    | {
        kind: "median"; amount: number; count: number | null; total: number | null;
        low: number | null; high: number | null; cappedByStale: boolean;
        staleCeilingDays: number | null; fromScan: boolean;
      }
    | { kind: "range"; low: number; high: number; count: number; why: string }
    | null;
  any: boolean;
  settled: boolean;
};

function usePriceSides(scan: Scan, pv: PriceView, asks: AsksState): PriceSides {
  const { fx } = useCurrency();
  const v = scan.valuation;
  const n = slabGradeNum(scan);
  const gradeKey = Number.isFinite(n) ? String(n).replace(/\.0$/, "") : null;
  const row = scan.slab && gradeKey ? v?.pricesByGrader?.[scan.slab.company]?.[gradeKey] ?? null : null;

  // An identity we could not prove carries no value, even from a response
  // written before the server learned to withhold one.
  const provable = isCatalogueId(scan.identification?.cardId) &&
    scan.identification?.printingConfirmed !== false;
  const ours = provable && pv.headline != null && !pv.headlineIsAsk ? pv.headline : null;

  // The sale median is the EVIDENCE for our valuation. Where the two agree
  // they are one claim, so the sales card appears only when they differ.
  const soldAmount = row ? row.median ?? row.price : null;
  const sold =
    ours != null && row && soldAmount != null &&
    Math.abs(ours - soldAmount) / Math.max(soldAmount, 1) > 0.02
      ? { amount: soldAmount, count: row.count ?? null, low: row.low ?? null, high: row.high ?? null, asOf: row.asOf ?? null }
      : null;

  const trust = asksMedianTrust(scan, asks.data);
  let askSide: PriceSides["asks"] = null;
  if (pv.headlineIsAsk && pv.headline != null) {
    // the valuation chain itself settled on the asking market
    askSide = {
      kind: "median", amount: pv.headline,
      count: pv.ask?.count ?? pv.slabPrice?.sampleSize ?? null, total: null,
      low: pv.ask?.low ?? null, high: pv.ask?.high ?? null,
      cappedByStale: Boolean(pv.ask?.cappedByStale),
      staleCeilingDays: pv.ask?.staleCeilingDays ?? null, fromScan: true,
    };
  } else if (trust.ok && asks.data?.medianAsk != null) {
    const d = asks.data;
    // a figure and itself is not a choice
    if (ours == null || Math.abs(ours - d.medianAsk!) >= 0.01) {
      askSide = {
        kind: "median", amount: d.medianAsk!, count: d.matched ?? d.listings.length, total: d.total,
        low: d.askLow, high: d.askHigh, cappedByStale: Boolean(d.cappedByStale),
        staleCeilingDays: d.staleCeilingDays ?? null, fromScan: false,
      };
    }
  } else if (ours == null && asks.data) {
    const r = listedRange(asks.data, fx);
    if (r) askSide = { kind: "range", ...r, why: RANGE_WHY[trust.why] ?? RANGE_WHY.thin };
  }

  return {
    ours, sold, asks: askSide,
    any: ours != null || sold != null || askSide != null,
    settled: asks.state !== "loading",
  };
}

/** Why the valuation chain fell back to the asks, in the reader's terms. */
function askFallbackWhy(scan: Scan, pv: PriceView): string {
  const a = pv.ask;
  const lead = a?.raw
    ? `This is the ${a.printing ?? "special"} printing, which the catalogue price does not cover. That quotes the base print of the same card number.`
    : pv.slabPrice?.basis === "ask-over-suspect-sale"
      ? "We do hold completed sales at this grade, but they price it below the grade beneath it. That cannot be right, so this uses the live market for this exact grader and grade instead."
      : `We hold no completed sales for a ${[a?.grader ?? scan.slab?.company, a?.grade].filter((x) => x != null).join(" ")}${a?.printing ? ` ${a.printing}` : ""} copy of this card.`;
  return `${lead} This is what sellers are asking today, not what one sold for. Sold prices usually land below the asks.`;
}

function PriceSideCard({
  title, sub, amount, range, lead, badge, why, facts = [], warn,
}: {
  title: string;
  sub?: ReactNode;
  amount: ReactNode;
  range?: boolean;
  lead?: boolean;
  badge?: ReactNode;
  why?: ReactNode;
  facts?: ([string, ReactNode] | null | false)[];
  warn?: ReactNode;
}) {
  const rows = facts.filter((f): f is [string, ReactNode] => Boolean(f));
  return (
    <div className={`price-side${lead ? " is-lead" : ""}`}>
      <div className="price-side-title">{title}</div>
      {sub && <div className="price-side-sub">{sub}</div>}
      <div className={`price-side-amount${range ? " is-range" : ""}`}>{amount}</div>
      {badge && <div className="ph-prov">{badge}</div>}
      {why && <p className="price-side-why">{why}</p>}
      {rows.length > 0 && (
        <dl className="price-side-facts">
          {rows.map(([k, val]) => (
            <Fragment key={k}>
              <dt>{k}</dt>
              <dd>{val}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {warn && <div className="price-side-warn">{warn}</div>}
    </div>
  );
}

function PriceChoice({ scan, pv, sides }: { scan: Scan; pv: PriceView; sides: PriceSides }) {
  const sp = scan.valuation?.slabPrice ?? null;
  const count = [sides.sold, sides.ours, sides.asks].filter((x) => x != null).length;
  if (count === 0) {
    return sides.settled ? null : (
      <p className="note ph-note">Checking what sellers are asking for this card…</p>
    );
  }
  const a = sides.asks;
  const usd = (x: number | null | undefined) => <Money v={x} showSource={false} />;

  return (
    <div className="price-choice">
      <div className="label-mono ph-choice-label">
        {count > 1 ? "Where this number comes from" : "What this card is worth"}
      </div>
      <div className="price-sides">
        {sides.sold && (
          <PriceSideCard
            title="What it sold for"
            sub={
              sides.sold.count
                ? `Middle of ${sides.sold.count} completed sale${sides.sold.count === 1 ? "" : "s"} at this grade`
                : "Completed sales at this grade"
            }
            amount={usd(sides.sold.amount)}
            badge={<span className="badge pass">completed sales</span>}
            why="The middle price copies of this exact card and grade actually changed hands for, unweighted, exactly what the sales say."
            facts={[
              sides.sold.count != null && ["Sales counted", String(sides.sold.count)],
              sides.sold.low != null && sides.sold.high != null && [
                "Range", <>{usd(sides.sold.low)} – {usd(sides.sold.high)}</>,
              ],
              Boolean(dayOf(sides.sold.asOf)) && ["As of", dayOf(sides.sold.asOf)],
            ]}
          />
        )}

        {sides.ours != null && (
          <PriceSideCard
            lead
            title="What it's worth"
            sub={pv.headlineLabel}
            amount={
              <>
                <Money v={sides.ours} unit={pv.headlineUnit} showSource={false} />
                <span className="ph-est-tag">est.</span>
              </>
            }
            badge={
              <>
                <span className={`badge ${pv.verified ? "pass" : "warn"}`}>
                  {pv.verified ? "verified sales" : "estimated"}
                </span>
                <span className="muted small">
                  {pv.source ? SOURCE_LABEL[pv.source] ?? pv.source : "our valuation"}
                </span>
              </>
            }
            why={sp?.explain && sp.basis !== "observed" ? sp.explain : null}
            facts={[
              sp?.sampleSize != null && ["Sales counted", String(sp.sampleSize)],
              sp?.low != null && sp?.high != null && ["Range", <>{usd(sp.low)} – {usd(sp.high)}</>],
              Boolean(sp?.confidence) && ["Confidence", String(sp!.confidence)],
              pv.raw != null && pv.headline !== pv.raw && [
                "Raw copy", <Money key="raw" v={pv.raw} unit={pv.rawUnit} showSource={false} />,
              ],
              pv.headline != null && pv.headlineUnit !== "USD" && [
                "Quoted in", pv.headlineUnit,
              ],
            ]}
          />
        )}

        {a?.kind === "median" && (
          <PriceSideCard
            lead={sides.ours == null}
            title="What people are asking"
            sub={
              a.fromScan
                ? pv.headlineLabel
                : a.cappedByStale
                  ? "Capped to the cheapest ask nobody has taken"
                  : "Middle of live listings elsewhere"
            }
            amount={
              <>
                {usd(a.amount)}
                <span className="ph-est-tag">asking</span>
              </>
            }
            badge={<span className="badge warn">asking prices</span>}
            why={
              a.fromScan
                ? askFallbackWhy(scan, pv)
                : "The middle of what sellers want today, not what anyone has paid. Asks run high, because the copies priced at market sell and leave."
            }
            facts={[
              a.count != null && [
                "From",
                a.total != null && a.total > a.count
                  ? `${a.count} of ${a.total} listings`
                  : `${a.count} listing${a.count === 1 ? "" : "s"}`,
              ],
              a.low != null && a.high != null && a.low !== a.high && [
                "Lowest / highest", <>{usd(a.low)} – {usd(a.high)}</>,
              ],
            ]}
            warn={
              a.cappedByStale && a.staleCeilingDays != null
                ? `This is the cheapest ask still standing after ${monthsOf(a.staleCeilingDays)} unsold, so it caps the market rather than describing it. Nobody has paid it.`
                : null
            }
          />
        )}

        {a?.kind === "range" && (
          <PriceSideCard
            lead
            range
            title="What people are asking"
            sub={`Spread of ${a.count} live listing${a.count === 1 ? "" : "s"} elsewhere`}
            amount={
              a.low === a.high ? (
                <>
                  {usd(a.low)}
                  <span className="ph-est-tag">asking</span>
                </>
              ) : (
                <>
                  {usd(a.low)} – {usd(a.high)}
                  <span className="ph-est-tag">asking</span>
                </>
              )
            }
            badge={<span className="badge warn">asking prices, not a value</span>}
            why={a.why}
          />
        )}
      </div>
    </div>
  );
}

function PriceHero({ scan, asks }: { scan: Scan; asks: AsksState }) {
  const pv = priceView(scan);
  const { code } = useCurrency();
  const { q: quota } = useQuota();
  const sides = usePriceSides(scan, pv, asks);
  const provable = isCatalogueId(scan.identification?.cardId) &&
    scan.identification?.printingConfirmed !== false;
  const hasAny = provable && (pv.headline != null || pv.grades.some((x) => x.value != null));
  const slabNoSales = Boolean(scan.slab) && !pv.slabGradeUnknown && pv.headline == null &&
    !scan.valuation?.identificationSuspect;

  return (
    <section className="price-hero" aria-label="Valuation">
      <div className="ph-top">
        <div className="label-mono accent-text">
          {scan.slab ? `${scan.slab.company} ${scan.slab.gradeText}` : "Ungraded"}
        </div>
        <CurrencyPicker />
      </div>

      {pv.slabGradeUnknown && (
        <p className="muted small ph-note">
          This is a <b>{scan.slab?.company}</b> slab, but the grade on the label
          couldn&apos;t be read from this photo, so we won&apos;t quote a value for it.
          A raw price would understate a graded card badly. Pick the grade below to
          see what it sells for, or re-shoot with the full label in focus.
        </p>
      )}
      {slabNoSales && (
        <p className="muted small ph-note">
          This is a <b>{scan.slab!.company} {scan.slab!.gradeText}</b>, and we hold no
          completed sales for it, so there is no sale price to show.
          {sides.asks ? " What sellers are asking for this grade is shown instead, labelled as asks." : ""}
        </p>
      )}

      {/* The backend works this out and until now nobody could see it. A raw
          price of $1.70 under a graded market of $145 does not mean a bargain —
          it means the raw figure belongs to a different card that shares this
          collector number. */}
      {scan.valuation?.identificationSuspect && (
        <div className="panel" style={{ borderColor: "var(--amber)", margin: "14px 0 0" }}>
          <span className="badge warn">check the printing</span>
          <p className="muted small" style={{ margin: "6px 0 0" }}>
            {scan.valuation.identificationSuspect}
          </p>
        </div>
      )}
      {scan.valuation?.marketNote && (
        <div className="panel" style={{ borderColor: "var(--amber)", margin: "14px 0 0" }}>
          <span className="badge warn">asks and sales disagree</span>
          <p className="muted small" style={{ margin: "6px 0 0" }}>
            {scan.valuation.marketNote}
          </p>
        </div>
      )}

      <PriceChoice scan={scan} pv={pv} sides={sides} />

      {/* Neither source had anything. Say so rather than showing a dash and
          letting it read as "worthless". */}
      {!sides.any && sides.settled && (
        <div className="ph-note">
          <QuotaBanner scan={scan} q={quota} />
          <div className="price-none-note">
            No sale and no live listing for this card at this grade yet, so we are not
            putting a number on it. A missing price is not a low one.
          </div>
        </div>
      )}

      {pv.headlineIsAsk && (pv.ask?.otherPrintings?.length ?? 0) > 0 && (
        <details className="printing-note">
          <summary>
            {pv.ask!.otherPrintings!.length} other printing
            {pv.ask!.otherPrintings!.length === 1 ? "" : "s"} of this card number
            {", priced separately rather than averaged in"}
          </summary>
          <ul>
            {pv.ask!.otherPrintings!.map((o) => (
              <li key={o.name}>
                <span>{o.name}</span>
                <span className="mono">
                  <Money v={o.low} unit="USD" showSource={false} />
                  {o.high !== o.low && (
                    <>
                      {" – "}
                      <Money v={o.high} unit="USD" showSource={false} />
                    </>
                  )}
                  <span className="muted"> · {o.count}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="muted">
            A card number is not a product. These carry the same number as yours
            but are different cards at different prices, so they are excluded from
            the figure above rather than averaged into it.
          </p>
        </details>
      )}

      {hasAny && !slabNoSales && <GraderTabs scan={scan} pv={pv} />}

      {pv.crossGrader && (
        <p className="ph-crossnote muted small">
          Sale comps available to us are <b>PSA</b> sales. This card is
          certified by <b>{pv.slabCompany}</b>, so the figure above is the closest PSA
          tier rather than a recorded sale of a {pv.slabCompany} {scan.slab?.gradeText}.
          Beckett and PSA grades are not interchangeable, so check the {pv.slabCompany} sold
          listings below before pricing to sell.
        </p>
      )}

      <div className="ph-method">
        <div className="ph-method-title label-mono">How this number was reached</div>
        <ol className="ph-method-list">
          {/* Say what actually happened. This line used to read "Identified the
              exact printing" on every scan — including one that identified
              nothing and named the card "Pps" from a logo fragment. */}
          <li>
            {scan.identification?.cardId === "described" ? (
              <>
                <b>Not identified.</b> No catalogue matched, so we only read
                {` “${scan.identification.name}” `}off the card. Search for it by name instead.
              </>
            ) : scan.identification?.cardId === "llm" ? (
              <>
                <b>Named by AI vision</b>{scan.identification.setName ? ` · ${scan.identification.setName}` : ""}.
                Not confirmed against a catalogue, so no printing or value is asserted.
              </>
            ) : scan.identification?.printingConfirmed === false ? (
              <>
                <b>Named the card</b>, but its printing could not be proven from the card
                number or the picture, so no value is asserted for it.
              </>
            ) : (
              <>
                <b>Identified</b> the exact printing
                {scan.identification?.setName ? ` · ${scan.identification.setName}` : ""}
                {scan.identification?.localId ? ` #${scan.identification.localId}` : ""}.
              </>
            )}
          </li>
          {scan.slab ? (
            <li>
              <b>Read the grading label:</b> {scan.slab.company} {scan.slab.gradeText}
              {scan.slab.certNumber ? `, cert ${scan.slab.certNumber}` : ""}. We do not
              grade a card that is already certified.
            </li>
          ) : (
            <li>
              <b>No grading label found.</b> Priced as a raw, ungraded copy. We
              don&apos;t judge this card&apos;s condition, so the figure is the market
              price for the card, not for this particular copy.
            </li>
          )}
          <li>
            {sides.ours != null ? (
              <>
                <b>Priced</b> from{" "}
                {pv.verified
                  ? "completed sales of this card at this grade"
                  : "a calculated estimate, not recorded sales"}
                {pv.crossGrader
                  ? `, using the nearest PSA tier because no ${pv.slabCompany} sales data is available to us`
                  : ""}
                .
              </>
            ) : sides.asks ? (
              <>
                <b>No sale price.</b> What is shown is what sellers are asking on eBay
                today, labelled as asks. Nobody has paid these.
              </>
            ) : (
              <>
                <b>Not priced.</b> No sale and no live listing reached us for this card.
              </>
            )}
          </li>
        </ol>
        <p className="muted small" style={{ margin: "8px 0 0" }}>
          Every figure here is an <b>estimate of market value</b> or a live ask, not an
          offer or an appraisal. Confirm against the listings below before buying or selling.
        </p>
      </div>

      <div className="ph-foot muted small">
        Prices sourced in USD{scan.valuation?.cardmarket ? " and EUR" : ""}, converted to{" "}
        {code} at ECB reference rates.
        {scan.valuation?.updatedAt &&
          ` Feed updated ${new Date(scan.valuation.updatedAt).toLocaleDateString()}.`}
      </div>
    </section>
  );
}

/* ── confirmed sales ──────────────────────────────────────────────────────────
   What people actually paid, itemised where the ledger can. A completed sale
   is evidence; an ask is a hope. They are kept in separate panels on purpose. */

type SaleRow = {
  sale_id: string; price: number | string; currency: string;
  sold_at: string; source: string; source_url: string | null;
  grader: string | null; grade: string | null;
};
type SalesAnswer = {
  sales: SaleRow[]; itemised: number; known: number | null;
  lastSaleAt: string | null; note: string | null;
  aggregate?: { median: number | null; low: number | null; high: number | null } | null;
  error?: string;
};

function GraderBadge({ grader, grade }: { grader?: string | null; grade?: string | number | null }) {
  return (
    <span className="grader-badge">
      {grader ? `${grader}${grade != null && grade !== "" ? ` ${grade}` : ""}` : "RAW"}
    </span>
  );
}

function ConfirmedSales({ scan }: { scan: Scan }) {
  const id = scan.identification;
  const v = scan.valuation;
  const catalogued = isCatalogueId(id?.cardId) && id?.printingConfirmed !== false;
  const [sales, setSales] = useState<SalesAnswer | null | undefined>(undefined);

  useEffect(() => {
    if (!catalogued || !id) { setSales(null); return; }
    setSales(undefined);
    const q = new URLSearchParams({ cardId: id.cardId, name: id.name });
    if (v?.slabGrader) q.set("grader", v.slabGrader);
    if (v?.slabGrade != null) q.set("grade", String(v.slabGrade));
    if (id.setName) q.set("set", id.setName);
    if (id.localId) q.set("number", id.localId);
    let alive = true;
    fetch(`${API}/market/sales?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: SalesAnswer | null) => { if (alive) setSales(j && !j.error ? j : null); })
      .catch(() => { if (alive) setSales(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogued, id?.cardId, id?.name, id?.setName, id?.localId, v?.slabGrader, v?.slabGrade]);

  // An older API build has no ledger. That is not "never sold", so say nothing.
  if (!catalogued || sales === null) return null;

  return (
    <div className="panel">
      <h3 className="section-title">Confirmed Sales</h3>
      <p className="note" style={{ margin: "4px 0 0" }}>
        What people actually paid, most recent first.
      </p>
      {sales === undefined ? (
        <p className="note" style={{ marginTop: 12 }}>Loading sales…</p>
      ) : sales.sales.length > 0 ? (
        <div className="sale-rows">
          {sales.sales.slice(0, 10).map((s) => {
            const body = (
              <>
                <GraderBadge grader={s.grader} grade={s.grade} />
                <div className="sale-row-body">
                  <div className="sale-row-price">
                    <Money v={Number(s.price)} unit={s.currency || "USD"} showSource={false} />
                  </div>
                  <div className="muted small">
                    {[dayOf(s.sold_at), s.source].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </>
            );
            return s.source_url?.startsWith("http") ? (
              <a className="sale-row" key={s.sale_id} href={s.source_url} target="_blank" rel="noreferrer">
                {body}
                <span className="muted small" aria-hidden="true">↗</span>
              </a>
            ) : (
              <div className="sale-row" key={s.sale_id}>{body}</div>
            );
          })}
          {sales.note && <p className="muted small sale-note">{sales.note}</p>}
        </div>
      ) : sales.known && sales.known > 0 ? (
        // We have the sales, we just cannot list them one by one. "No sale on
        // record" here would contradict the valuation built from exactly these.
        <div className="sale-rows">
          <div className="sale-row">
            <div className="sale-row-body">
              <div className="sale-row-price">
                {sales.known} completed sale{sales.known === 1 ? "" : "s"} at this grade
              </div>
              {sales.aggregate?.median != null && (
                <div className="muted small">
                  Middle price <Money v={sales.aggregate.median} showSource={false} />
                  {sales.aggregate.low != null && sales.aggregate.high != null && (
                    <>
                      {" · ranged "}
                      <Money v={sales.aggregate.low} showSource={false} /> to{" "}
                      <Money v={sales.aggregate.high} showSource={false} />
                    </>
                  )}
                </div>
              )}
              {sales.lastSaleAt && (
                <div className="muted small">Last one sold {dayOf(sales.lastSaleAt)}</div>
              )}
            </div>
          </div>
          <p className="muted small sale-note">
            {sales.note ??
              "Our price source reports totals rather than individual sales, so we can show what they add up to but not list them one by one."}
          </p>
        </div>
      ) : (
        <p className="note" style={{ marginTop: 12 }}>
          No sale on record for this exact card and grade.
        </p>
      )}
    </div>
  );
}

/* ── asking now ───────────────────────────────────────────────────────────────
   Live listings elsewhere. These are ASKS, not sales: a card listed at $30,000
   for eight months is not a $30,000 card. */

function AskStat({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`ask-stat${strong ? " is-strong" : ""}`}>
      <div className="label-mono">{label}</div>
      <div className="ask-stat-value">{value}</div>
    </div>
  );
}

function AskingNow({ scan, asks }: { scan: Scan; asks: AsksState }) {
  const { fx } = useCurrency();
  const { data, state } = asks;
  const v = scan.valuation;
  const trust = asksMedianTrust(scan, data);
  const range = data ? listedRange(data, fx) : null;
  const listings = data?.listings ?? [];
  const median = trust.ok ? data?.medianAsk ?? null : null;
  const label = v?.slabGrader && v?.slabGrade != null
    ? `${v.slabGrader} ${String(v.slabGrade).replace(/\.0$/, "")}`
    : null;
  const usd = (x: number | null | undefined) => (x == null ? "—" : <Money v={x} showSource={false} />);

  return (
    <div className="panel">
      <h3 className="section-title">Asking Now</h3>
      <p className="note" style={{ margin: "4px 0 0" }}>
        Live listings on eBay{data?.filteredToGrade && label ? <> for <b>{label}</b> copies</> : null}
        {data?.filteredToPrinting && data.printing ? <> of the <b>{data.printing}</b> printing</> : null}.
        Asking prices, not sales. Sold prices usually land below the asks.
      </p>

      {state === "loading" ? (
        <p className="note" style={{ marginTop: 12 }}>Looking for live listings…</p>
      ) : listings.length === 0 ? (
        <p className="note" style={{ marginTop: 12 }}>
          Nothing listed for this card right now. For a scarce card that is normal, and it
          is worth knowing before you price yours.
        </p>
      ) : (
        <>
          <div className="ask-stats">
            {median != null ? (
              <>
                {/* Only a median when it IS one. Once the stale ceiling has
                    pulled it down to the cheapest long-unsold ask, calling it a
                    median over pricier listings on the same page is false. */}
                <AskStat strong label={data?.cappedByStale ? "Ceiling" : "Median ask"} value={usd(median)} />
                <AskStat label="Lowest" value={usd(data?.askLow ?? range?.low)} />
                <AskStat label="Highest" value={usd(data?.askHigh ?? range?.high)} />
              </>
            ) : (
              <>
                <AskStat strong label="Lowest" value={usd(range?.low)} />
                <AskStat label="Highest" value={usd(range?.high)} />
                <AskStat label="Listed" value={String(listings.length)} />
              </>
            )}
          </div>
          <p className="muted small" style={{ margin: "8px 0 0" }}>
            {data?.matched ?? listings.length} of {data?.total ?? listings.length} listings matched this card
            {data?.trimmed ? ` · ${data.trimmed} outliers set aside` : ""}
            {median == null ? " · no middle figure for this card, only the spread" : ""}
          </p>
          {median != null && data?.cappedByStale && data.staleCeilingDays != null && (
            <p className="price-side-warn">
              The figure is the cheapest ask still standing after {monthsOf(data.staleCeilingDays)} unsold,
              so it caps the market rather than describing it. Nobody paid this; somebody failed to get it.
            </p>
          )}

          <div className="listings">
            {listings.slice(0, 8).map((l) => (
              <a className="listing" key={l.url} href={l.url} target="_blank" rel="noreferrer">
                {l.imageUrl ? (
                  <img src={l.imageUrl} alt="" loading="lazy" />
                ) : (
                  <div className="listing-noimg" />
                )}
                <div className="listing-body">
                  <div className="listing-price">
                    <Money v={l.price} unit={l.currency} showSource={false} />
                    {l.bestOffer && <span className="listing-offers">offers</span>}
                  </div>
                  <div className="listing-title">{l.title}</div>
                  <div className="listing-meta">
                    {/* The company is on the row. Two listings at one price are
                        different objects when one is a BGS 9.5 and one a PSA 9. */}
                    <span className="listing-grade">
                      {l.grader ? `${l.grader}${l.grade != null ? ` ${l.grade}` : ""}` : "RAW"}
                    </span>
                    {l.printing && <span className="listing-printing">{l.printing}</span>}
                    {l.ageDays != null && (
                      <span className={l.ageDays >= 60 ? "listing-age stale" : "listing-age"}>
                        {l.ageDays === 0
                          ? "listed today"
                          : `listed ${l.ageDays} day${l.ageDays === 1 ? "" : "s"} ago`}
                      </span>
                    )}
                    {l.seller && (
                      <span>
                        {l.seller}
                        {l.sellerFeedbackPct != null ? ` · ${l.sellerFeedbackPct}%` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Result({ scan, photo }: { scan: Scan; photo: File | null }) {
  const m = scan.measurement;
  const rejected = scan.status === "rejected" && Boolean(scan.rejection);
  const asks = useLiveAsks(scan, !rejected);

  // A rejected photo gets ONE answer: the rejection.
  //
  // It used to render the full result and put the rejection notice near the
  // bottom, under a price. On a blurry PSA slab that produced "No grading
  // label found — priced as a raw, ungraded copy" over a $94,000 Championship
  // Finalist card, with the actual finding — "this looks like a graded card
  // but the label couldn't be read" — a page-scroll below it.
  //
  // The system knew it had failed and said so. Printing a number anyway, from
  // an identification it had already declined to trust, is the worst thing
  // this page can do: it is wrong, confident, and buries its own retraction.
  if (scan.status === "rejected" && scan.rejection) {
    return (
      <div className="panel" style={{ borderColor: "var(--warn)" }}>
        <span className="badge warn">scan failed, no charge</span>
        <h3 style={{ marginBottom: 4 }}>{scan.rejection.userMessage}</h3>
        <p className="muted" style={{ margin: 0 }}>{scan.rejection.retryHint}</p>
        {scan.identification?.name && (
          <p className="muted small" style={{ marginTop: 12 }}>
            We think this is <b>{scan.identification.name}</b>, but we are not pricing it
            from a photo we could not read. A grade we cannot see is the difference
            between a few dollars and a few thousand.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <ScanHeader scan={scan} photo={photo} />
      <PriceHero scan={scan} asks={asks} />
      <ConfirmedSales scan={scan} />
      <AskingNow scan={scan} asks={asks} />
      {scan.slab && (
        <div className="panel" style={{ borderColor: "var(--green)" }}>
          <span className="badge pass" style={{ fontSize: 16, padding: "6px 16px" }}>
            {scan.slab.company} CERTIFIED · {scan.slab.gradeText}
          </span>
          {scan.slab.certNumber && (
            <span className="muted" style={{ marginLeft: 10 }}>
              cert #{scan.slab.certNumber}
            </span>
          )}
          <p className="muted" style={{ margin: "8px 0 0" }}>
            This card is already professionally graded, so we don&apos;t grade it ourselves.
            a condition opinion formed through the case would add nothing to the certified
            grade on the label. We read the label and value the card at that grade.{" "}
            {scan.slab.verifyUrl && (
              <a href={scan.slab.verifyUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                Verify this cert on {scan.slab.company}&apos;s registry →
              </a>
            )}
          </p>
        </div>
      )}
      <IdentityPanel scan={scan} />
      {/* "should you grade this?" is a question about a raw card. For one
          already in a slab there is no decision to make, and showing a
          grade/don't-grade verdict beside someone else's certification reads
          as us second-guessing it. The slab banner above already says the
          label grade stands. */}
      {!scan.slab && <RecommendationPanel scan={scan} />}

      {(
        m && (
          <div className="result-grid">
            <Viewer scan={scan} />
            <div>
              <div className="panel">
                {m.centering.front.measurable ? (
                  m.centering.passesAt.psa10 ? (
                    <span className="badge pass">passes PSA 10 centering</span>
                  ) : m.centering.passesAt.psa9 ? (
                    <span className="badge warn">PSA 9 centering, misses 10</span>
                  ) : (
                    <span className="badge fail">fails PSA 9 centering</span>
                  )
                ) : (
                  <span className="badge warn">centering not measurable</span>
                )}
                <div style={{ marginTop: 12 }}>
                  <CenteringBlock title="Front" c={m.centering.front} />
                  {m.centering.back && <CenteringBlock title="Back" c={m.centering.back} />}
                </div>
                <div className="muted small">
                  Measured from the printed border, not estimated. Confidence{" "}
                  {(m.confidence.centering * 100).toFixed(0)}%
                </div>
                <div className="confbar">
                  <div style={{ width: `${m.confidence.centering * 100}%` }} />
                </div>
              </div>
              {scan.backRejection && (
                <div className="panel">
                  <span className="badge warn">back photo not usable</span>
                  <p className="muted">
                    {scan.backRejection.userMessage} {scan.backRejection.retryHint}
                  </p>
                </div>
              )}
              <ValuationPanel scan={scan} />
            </div>
          </div>
        )
      )}
      {(scan.status === "rejected" || !m) && <ValuationPanel scan={scan} />}
      <EbayComps scan={scan} />
      {scan.related && scan.related.length > 0 && (
        <div className="panel">
          <div className="muted" style={{ marginBottom: 10 }}>
            More from {scan.identification?.setName ?? "this set"}{" "}
            <span className="small">(live market prices)</span>
          </div>
          <div className="related-grid">
            {scan.related.map((c) => (
              <div className="related-card" key={c.localId + c.name}>
                {c.imageUrl && <img src={c.imageUrl} alt={c.name} loading="lazy" />}
                <div className="related-name">{c.name}</div>
                <div className="muted small">#{c.localId}</div>
                <div className="related-price">
                  {c.price != null ? `$${c.price.toFixed(2)}` : "n/a"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Pull an image out of a clipboard payload, if there is one.
 *
 *  A screenshot arrives as a `file` item with no usable name, so it is given
 *  one — some servers reject a multipart part with an empty filename, and a
 *  real extension keeps the mime type honest downstream.
 */
function imageFromClipboard(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const f = item.getAsFile();
    if (!f) continue;
    if (f.name && f.name !== "image.png") return f;
    const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
    return new File([f], `pasted-${Date.now()}.${ext}`, { type: f.type });
  }
  return null;
}

function HomeInner() {
  const { q: quota, reload: reloadQuota } = useQuota();

  // The API sleeps when idle on its current hosting tier, and waking it takes
  // around a minute. Without this, the first scan of the day looks like a hang:
  // the user picks a photo, presses Scan, and waits with no idea why. Pinging a
  // cheap endpoint the moment the page opens means the instance is usually
  // awake by the time they have chosen a card. Fire-and-forget — a failed warm
  // -up changes nothing.
  useEffect(() => {
    fetch(`${API}/market/fx`, { cache: "no-store" }).catch(() => {});
  }, []);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  // the photo that produced the result on screen, not whatever is in the slot now
  const [scannedPhoto, setScannedPhoto] = useState<File | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => (s + 1) % SCAN_STEPS.length), 900);
    return () => clearInterval(t);
  }, [busy]);

  // Paste a screenshot straight in. The listener sits on the document rather
  // than a slot: on a fresh page nothing is focused, so a slot-level handler
  // would never fire until something was clicked first. Front fills before
  // back, matching the order they are asked for.
  const [pastedInto, setPastedInto] = useState<string | null>(null);
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (busy) return;
      const f = imageFromClipboard(e.clipboardData);
      if (!f) return;
      e.preventDefault();
      if (!front) {
        setFront(f);
        setPastedInto("front");
      } else {
        setBack(f);
        setPastedInto("back");
      }
      setScan(null);
      setError(null);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [busy, front]);

  useEffect(() => {
    if (!pastedInto) return;
    const t = setTimeout(() => setPastedInto(null), 2200);
    return () => clearTimeout(t);
  }, [pastedInto]);

  async function runScan() {
    if (!front) return;
    setBusy(true);
    setError(null);
    setScan(null);
    try {
      const form = new FormData();
      form.append("front", front);
      if (back) form.append("back", back);
      const res = await fetch(`${API}/scans`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setScan(await res.json());
      setScannedPhoto(front);
      reloadQuota();
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="topbar">
        <span className="wordmark">GRAILCARD</span>
        <MarketTicker />
        <div className="topbar-tools">
          <QuotaChip q={quota} />
          <CurrencyPicker />
          <ThemeToggle />
        </div>
      </div>
      <div className="capture-head">
        <h1>Place the card. We do the measuring.</h1>
        <p className="tagline">
          Centering is measured, not guessed. Bad photos get rejected rather than graded.
        </p>
      </div>

      <div className="slots">
        <CaptureSlot label="Front" required file={front} onPick={setFront} scanning={busy} />
        <CaptureSlot label="Back" file={back} onPick={setBack} scanning={busy} />
      </div>
      <p className="paste-hint muted small">
        {pastedInto ? (
          <span className="paste-ok">Pasted into the {pastedInto} slot.</span>
        ) : (
          <>
            You can paste a screenshot straight in. Press <kbd>⌘</kbd><kbd>V</kbd>{" "}
            anywhere on this page. To put a screenshot on the clipboard on a Mac use{" "}
            <kbd>⌘</kbd><kbd>⌃</kbd><kbd>⇧</kbd><kbd>4</kbd>, where adding Control sends it
            to the clipboard instead of saving a file.
          </>
        )}
      </p>
      <div className="scan-status">
        {busy ? SCAN_STEPS[step] : ""}
        {busy && step >= SCAN_STEPS.length - 1 && (
          <span className="muted small"> · first scan after a quiet spell takes longer while the server wakes</span>
        )}
      </div>
      <div className="scan-actions" style={{ marginBottom: 16 }}>
        <button className="primary" disabled={!front || busy} onClick={runScan}>
          {busy ? "Scanning…" : "Scan card"}
        </button>
      </div>

      <SearchPanel />

      {error && (
        <div className="panel">
          <span className="badge fail">error</span> {error}
        </div>
      )}

      {scan && <Result scan={scan} photo={scannedPhoto} />}
      <NewsLine />
    </main>
  );
}

export default function Home() {
  return (
    <CurrencyProvider>
      <HomeInner />
    </CurrencyProvider>
  );
}
