"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES, GRADERS, LANGUAGES, SORTS, type Filters } from "../lib/market";

/**
 * The marketplace filters, as one form.
 *
 * Grouped sections with radio choices and one apply button — the same sheet
 * the app uses, because a wall of tags reads as decoration and the client
 * asked for structured filters. A sidebar on a wide screen; a sheet that
 * slides up on a narrow one.
 *
 * Submitting writes the choices into the URL and lets the server render the
 * page, so every filtered view is a link somebody can send. Empty fields are
 * left out of the URL rather than sent as `?game=`.
 */
export default function FilterPanel({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    for (const [k, v] of data.entries()) {
      const s = String(v).trim();
      if (s) p.set(k, s);
    }
    setOpen(false);
    router.push(`/market${p.size ? `?${p}` : ""}`);
  };

  const radio = (name: string, value: string, label: string, current?: string) => (
    <label className="gs-radio" key={`${name}:${value}`}>
      <input type="radio" name={name} value={value} defaultChecked={(current ?? "") === value} />
      {label}
    </label>
  );

  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "q" && v).length;

  return (
    <>
      <button type="button" className="gs-btn gs-btn-quiet gs-filters-toggle" onClick={() => setOpen(true)}>
        Sort &amp; filter{activeCount ? ` · ${activeCount}` : ""}
      </button>
      {open && <div className="gs-scrim" onClick={() => setOpen(false)} />}

      <form className="gs-filters" data-open={open} onSubmit={submit} aria-label="Filters">
        <div className="gs-group">
          <p className="gs-group-title">Sort by</p>
          {SORTS.map((s) => radio("sort", s.id, s.label, filters.sort))}
        </div>

        <div className="gs-group">
          <label className="gs-group-title" htmlFor="gs-game">Game</label>
          <select id="gs-game" name="game" className="gs-field" defaultValue={filters.game ?? ""}>
            <option value="">Any game</option>
            {GAMES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>

        <div className="gs-group">
          <p className="gs-group-title">Condition</p>
          {radio("graded", "", "Graded or raw", filters.graded)}
          {radio("graded", "true", "Graded only", filters.graded)}
          {radio("graded", "false", "Raw only", filters.graded)}
        </div>

        <div className="gs-group">
          <label className="gs-group-title" htmlFor="gs-grader">Grading company</label>
          <select id="gs-grader" name="grader" className="gs-field" defaultValue={filters.grader ?? ""}>
            <option value="">Any company</option>
            {GRADERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <div style={{ marginTop: 8 }}>
            <input name="grade" className="gs-field" placeholder="Grade, e.g. 10" defaultValue={filters.grade ?? ""} inputMode="decimal" aria-label="Grade" />
          </div>
        </div>

        <div className="gs-group">
          <p className="gs-group-title">Language</p>
          {LANGUAGES.map((l) => radio("language", l.id, l.label, filters.language))}
        </div>

        <div className="gs-group">
          <p className="gs-group-title">Set and number</p>
          <input name="set" className="gs-field" placeholder="Set name" defaultValue={filters.set ?? ""} aria-label="Set name" />
          <div style={{ marginTop: 8 }}>
            <input name="number" className="gs-field" placeholder="Card number" defaultValue={filters.number ?? ""} aria-label="Card number" />
          </div>
        </div>

        <div className="gs-group">
          <p className="gs-group-title">Price (A$)</p>
          <div className="gs-row2">
            <input name="min" className="gs-field" placeholder="Min" defaultValue={filters.min ?? ""} inputMode="decimal" aria-label="Minimum price" />
            <input name="max" className="gs-field" placeholder="Max" defaultValue={filters.max ?? ""} inputMode="decimal" aria-label="Maximum price" />
          </div>
        </div>

        <div className="gs-filter-actions">
          <a className="gs-btn gs-btn-quiet" href={filters.q ? `/market?q=${encodeURIComponent(filters.q)}` : "/market"}>Reset</a>
          <button type="submit" className="gs-btn gs-btn-primary">Show results</button>
        </div>
      </form>
    </>
  );
}
