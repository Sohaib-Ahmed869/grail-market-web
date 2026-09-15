"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  CATALOG_EDITIONS,
  CATALOG_FINISHES,
  CATALOG_LANGUAGES,
  createCatalogCard,
  deleteCatalogCard,
  fetchCatalog,
  fetchCatalogCard,
  updateCatalogCard,
  type CatalogCard,
  type CatalogEdit,
  type CatalogReferences,
} from "../lib/api";
import { shortDate } from "../lib/data";
import {
  Badge,
  Card,
  CardHead,
  Empty,
  Loading,
  Modal,
  Note,
  PageHead,
  Pagination,
  Select,
  Toast,
} from "../components/ui";
import { IconCard, IconCheck, IconSearch, IconX } from "../components/icons";
import { Gate } from "../components/Gate";

/**
 * The card catalogue — the row every price, listing and collection entry is
 * keyed on.
 *
 * The API has had search, add, correct and remove for these rows since the
 * catalogue store was written, and nothing on the console used them, so a
 * misnamed card or a wrong set number could only be fixed in the database.
 * Every change made here is written to the audit log with the fields that
 * moved, and a card a member's listing or collection points at cannot be
 * removed — the API refuses it, and the button says why before you press it.
 */

const PAGE = 50;

const GAMES = [
  { value: "all", label: "Every game" },
  { value: "pokemon", label: "Pokémon" },
  { value: "onepiece", label: "One Piece" },
  { value: "mtg", label: "Magic" },
  { value: "yugioh", label: "Yu-Gi-Oh!" },
  { value: "lorcana", label: "Lorcana" },
  { value: "other", label: "Other" },
];

/** A catalogue price in US dollars, with cents below ten. The console's
 *  `money` rounds to whole dollars, which prints a 24-cent card as $0 — the
 *  defect that once put A$0 on the card page. */
const usd = (n: number) =>
  `US${n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n < 10 ? 2 : 0,
    maximumFractionDigits: n < 10 ? 2 : 0,
  })}`;

const blankOr = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function useDebounced(value: string, ms: number) {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return held;
}

type Draft = {
  catalogId: string;
  name: string;
  game: string;
  setName: string;
  cardNumber: string;
  language: string;
  edition: string;
  finish: string;
};

const draftOf = (c?: CatalogCard): Draft => ({
  catalogId: c?.catalogId ?? "",
  name: c?.name ?? "",
  game: c?.game ?? "",
  setName: c?.setName ?? "",
  cardNumber: c?.cardNumber ?? "",
  language: c?.language ?? "",
  edition: c?.edition ?? "",
  finish: c?.finish ?? "",
});

function CatalogPage() {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("all");
  const [page, setPage] = useState(1);
  const search = useDebounced(query, 300);

  const [rows, setRows] = useState<CatalogCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [editing, setEditing] = useState<CatalogCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [refs, setRefs] = useState<CatalogReferences | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => setPage(1), [search, game]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchCatalog({ search, game, limit: PAGE, offset: (page - 1) * PAGE })
      .then((r) => {
        if (!live) return;
        setRows(r.cards);
        setTotal(r.total);
        setLoadError(null);
      })
      .catch((e) => live && setLoadError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [search, game, page, reload]);

  function openEdit(c: CatalogCard) {
    setEditing(c);
    setCreating(false);
    setDraft(draftOf(c));
    setRefs(null);
    setFormError(null);
    setConfirmDelete(false);
    fetchCatalogCard(c.catalogId)
      .then((r) => {
        setRefs(r.references);
        setEditing(r.card);
      })
      .catch(() => setRefs(null));
  }

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setDraft(draftOf());
    setRefs(null);
    setFormError(null);
  }

  function closeForm() {
    setEditing(null);
    setCreating(false);
    setConfirmDelete(false);
  }

  /** Only the fields that actually changed are sent, so the audit entry
   *  names what moved rather than every field on the row. */
  function patchFrom(before: CatalogCard | null): CatalogEdit {
    const next: CatalogEdit = {
      name: draft.name.trim(),
      game: blankOr(draft.game),
      setName: blankOr(draft.setName),
      cardNumber: blankOr(draft.cardNumber),
      language: blankOr(draft.language),
      edition: blankOr(draft.edition),
      finish: blankOr(draft.finish),
    };
    if (!before) return next;
    const out: CatalogEdit = {};
    (Object.keys(next) as (keyof CatalogEdit)[]).forEach((k) => {
      if ((next[k] ?? null) !== (before[k] ?? null)) (out as any)[k] = next[k];
    });
    return out;
  }

  async function save() {
    if (saving) return;
    if (!draft.name.trim()) {
      setFormError("A card needs a name.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (creating) {
        if (!draft.catalogId.trim()) {
          setFormError("A new card needs a catalogue id.");
          setSaving(false);
          return;
        }
        const r = await createCatalogCard({
          ...patchFrom(null),
          catalogId: draft.catalogId.trim(),
          name: draft.name.trim(),
        });
        setToast({ title: "Card added", body: `${r.card.name} · ${r.card.catalogId}` });
      } else if (editing) {
        const patch = patchFrom(editing);
        if (Object.keys(patch).length === 0) {
          setFormError("Nothing has changed.");
          setSaving(false);
          return;
        }
        const r = await updateCatalogCard(editing.catalogId, patch);
        setToast({
          title: "Card corrected",
          body: `${r.card.name}: ${Object.keys(patch).join(", ")} changed. Logged to the audit trail.`,
        });
      }
      closeForm();
      setReload((n) => n + 1);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing || saving) return;
    setSaving(true);
    try {
      await deleteCatalogCard(editing.catalogId);
      setToast({ title: "Card removed", body: `${editing.name} · ${editing.catalogId}` });
      closeForm();
      setReload((n) => n + 1);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const blocked = refs ? refs.listings + refs.collection > 0 : true;
  const field = (k: keyof Draft, label: string, placeholder?: string) => (
    <div className="gm-field">
      <label className="gm-label" htmlFor={`cat-${k}`}>
        {label}
      </label>
      <input
        id={`cat-${k}`}
        className="gm-input"
        value={draft[k]}
        placeholder={placeholder}
        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
      />
    </div>
  );
  const axis = (k: "language" | "edition" | "finish", label: string, values: readonly string[]) => (
    <div className="gm-field">
      <label className="gm-label" htmlFor={`cat-${k}`}>
        {label}
      </label>
      <Select
        id={`cat-${k}`}
        value={draft[k]}
        onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
        options={[{ value: "", label: "Not set" }, ...values.map((v) => ({ value: v, label: v }))]}
      />
    </div>
  );

  return (
    <>
      <PageHead
        title="Card catalogue"
        sub="The rows every price, listing and collection entry hangs off. Corrections are logged with what changed."
        right={
          <button type="button" className="gm-btn gm-btn--primary" onClick={openCreate}>
            <IconCheck />
            Add a card
          </button>
        }
      />

      <div className="gm-stack">
        {loadError ? (
          <Note tone="bad">
            <b>The catalogue could not be read.</b> {loadError}
          </Note>
        ) : null}

        <Card>
          <CardHead
            title={`${total.toLocaleString()} card${total === 1 ? "" : "s"}`}
            sub="Search by name, card number or catalogue id"
            left={
              <div className="gm-search" style={{ width: 260 }}>
                <IconSearch />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Charizard, 4/102, base1-4…"
                  aria-label="Search the catalogue"
                />
              </div>
            }
            right={<Select value={game} onChange={setGame} options={GAMES} ariaLabel="Game" width={160} />}
          />

          {loading ? (
            <Loading label="Reading the catalogue…" />
          ) : rows.length === 0 ? (
            <Empty
              icon={<IconCard />}
              title="No card matches"
              body="Only cards somebody has scanned, listed, held or watched are in this table."
            />
          ) : (
            <div className="gm-tablewrap">
              <table className="gm-table gm-table--left gm-table--tight">
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Game</th>
                    <th>Language · edition · finish</th>
                    <th>Raw price</th>
                    <th>Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.catalogId} onClick={() => openEdit(c)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="gm-cell2">
                          <b>{c.name}</b>
                          <span>
                            {[c.setName, c.cardNumber ? `#${c.cardNumber}` : null].filter(Boolean).join(" · ") ||
                              "No set recorded"}{" "}
                            · <span className="gm-mono">{c.catalogId}</span>
                          </span>
                        </div>
                      </td>
                      <td className="gm-sm">{c.game ?? <span className="gm-muted">—</span>}</td>
                      <td>
                        <div className="gm-row" style={{ gap: 4, flexWrap: "wrap" }}>
                          {[c.language, c.edition, c.finish].every((x) => !x) ? (
                            <span className="gm-sm gm-muted">Not set</span>
                          ) : (
                            [c.language, c.edition, c.finish]
                              .filter(Boolean)
                              .map((x) => (
                                <Badge key={x!} tone="navy">
                                  {x}
                                </Badge>
                              ))
                          )}
                        </div>
                      </td>
                      <td className="gm-sm gm-nowrap">
                        {c.rawUsd != null ? usd(c.rawUsd) : <span className="gm-muted">—</span>}
                      </td>
                      <td className="gm-sm gm-muted gm-nowrap">
                        {c.seenCount}× {c.lastSeenAt ? `· ${shortDate(c.lastSeenAt)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} />
        </Card>
      </div>

      <Modal
        open={creating || editing != null}
        onClose={closeForm}
        title={creating ? "Add a card" : `Correct ${editing?.name ?? "card"}`}
        sub={
          creating
            ? "A new row for a card the scanner or the sources do not know yet."
            : "Every price for this card is keyed on this row. Only what you change is saved, and the audit log records it."
        }
        footer={
          <>
            {!creating && editing ? (
              confirmDelete ? (
                <button
                  type="button"
                  className="gm-btn gm-btn--danger"
                  disabled={saving || blocked}
                  onClick={remove}
                  style={{ marginRight: "auto" }}
                >
                  <IconX />
                  Yes, remove it
                </button>
              ) : (
                <button
                  type="button"
                  className="gm-btn"
                  disabled={saving || blocked}
                  onClick={() => setConfirmDelete(true)}
                  style={{ marginRight: "auto" }}
                  title={
                    refs && blocked
                      ? "A member's listing or collection points at this card."
                      : undefined
                  }
                >
                  <IconX />
                  Remove
                </button>
              )
            ) : null}
            <button type="button" className="gm-btn" onClick={closeForm}>
              Cancel
            </button>
            <button type="button" className="gm-btn gm-btn--primary" disabled={saving} onClick={save}>
              <IconCheck />
              {saving ? "Saving…" : creating ? "Add card" : "Save correction"}
            </button>
          </>
        }
      >
        {formError ? (
          <Note tone="bad">
            <b>Not saved.</b> {formError}
          </Note>
        ) : null}

        {!creating && refs ? (
          <Note tone={blocked ? "warn" : "info"}>
            <b>What points at this card:</b> {refs.listings} listing{refs.listings === 1 ? "" : "s"},{" "}
            {refs.collection} collection entr{refs.collection === 1 ? "y" : "ies"}, {refs.prices} stored
            price{refs.prices === 1 ? "" : "s"}.
            {blocked
              ? " It cannot be removed while a member's listing or collection uses it."
              : " Stored prices are rebuilt, so they do not stop a removal."}
          </Note>
        ) : null}

        {creating ? field("catalogId", "Catalogue id", "e.g. base1-4") : null}
        {field("name", "Name")}
        {field("game", "Game", "pokemon, onepiece, mtg…")}
        {field("setName", "Set")}
        {field("cardNumber", "Card number", "e.g. 4/102 or OP13-119")}
        {axis("language", "Language", CATALOG_LANGUAGES)}
        {axis("edition", "Edition", CATALOG_EDITIONS)}
        {axis("finish", "Finish", CATALOG_FINISHES)}
      </Modal>

      {toast ? <Toast title={toast.title} body={toast.body} onDone={() => setToast(null)} /> : null}
    </>
  );
}

export default function GatedCatalogPage() {
  return (
    <Gate need="catalog.write">
      <CatalogPage />
    </Gate>
  );
}
