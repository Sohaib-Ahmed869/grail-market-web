/**
 * Pulls the card art the admin dashboard shows into `public/cards/`.
 *
 * The images are fetched ONCE and committed, not loaded at runtime. Hotlinking
 * would make an internal console depend on someone else's uptime and rate
 * limit for a decorative fan of cards, which is a bad trade.
 *
 * Sources, all open and keyless:
 *   - TCGdex     https://api.tcgdex.net    — Pokémon (backend already uses it)
 *   - Scryfall   https://api.scryfall.com  — Magic
 *   - YGOPRODeck https://db.ygoprodeck.com — Yu-Gi-Oh!
 *
 * One Piece and sports cards have no keyless source: apitcg.com (the other
 * host the backend talks to) requires a registered key, and the repo rule is
 * no paid dependency without asking. Those two fall back to the drawn slab.
 *
 * These are publishers' card images (© Nintendo/TPC, Wizards of the Coast,
 * Shueisha, Konami). They stand in for seller photographs during development.
 * Before this ships anywhere public, replace them with real listing photos —
 * which is what the product uses anyway.
 *
 *   node scripts/fetch-card-art.mjs
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "cards");

/* Both Scryfall's API and its image CDN reject a request with no User-Agent,
   and answer 400 rather than 403 — so send it on every call, image included. */
const HEADERS = { "User-Agent": "GrailMarketAdmin/1.0 (development placeholder art)" };

/** TCGdex returns a base URL; the quality and extension are appended. */
const tcgdex = (id) => async () => {
  const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${id}`);
  if (!r.ok) throw new Error(`tcgdex ${id}: ${r.status}`);
  const card = await r.json();
  if (!card.image) throw new Error(`tcgdex ${id}: no image on record`);
  return { url: `${card.image}/high.png`, name: card.name };
};

/* Scryfall rejects requests without a User-Agent and Accept — a bare fetch
   gets a 400, not a 403, which is a confusing way to find that out. */
const scryfall = (name) => async () => {
  const r = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`, {
    headers: { ...HEADERS, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`scryfall ${name}: ${r.status}`);
  const card = await r.json();
  const url = card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
  if (!url) throw new Error(`scryfall ${name}: no image on record`);
  return { url, name: card.name };
};

const ygoprodeck = (name) => async () => {
  const r = await fetch(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`
  );
  if (!r.ok) throw new Error(`ygoprodeck ${name}: ${r.status}`);
  const card = (await r.json()).data?.[0];
  const url = card?.card_images?.[0]?.image_url;
  if (!url) throw new Error(`ygoprodeck ${name}: no image on record`);
  return { url, name: card.name };
};

/* Slug → resolver. The slug is what the pages reference, so a card can be
   swapped here without touching any component. */
const WANTED = {
  "pokemon-charizard": tcgdex("base1-4"),
  "pokemon-blastoise": tcgdex("base1-2"),
  "pokemon-pikachu": tcgdex("base1-58"),
  "magic-black-lotus": scryfall("Black Lotus"),
  "magic-mox-sapphire": scryfall("Mox Sapphire"),
  "pokemon-lugia": tcgdex("neo1-9"),
  "pokemon-umbreon": tcgdex("swsh7-215"),
  "magic-mox-emerald": scryfall("Mox Emerald"),
  "yugioh-blue-eyes": ygoprodeck("Blue-Eyes White Dragon"),
  "yugioh-dark-magician-girl": ygoprodeck("Dark Magician Girl"),
};

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const force = process.argv.includes("--force");
  const results = [];

  for (const [slug, resolve] of Object.entries(WANTED)) {
    const dest = join(OUT, `${slug}.png`);

    if (!force && (await exists(dest))) {
      results.push([slug, "cached"]);
      continue;
    }

    try {
      const { url, name } = await resolve();
      const img = await fetch(url, { headers: HEADERS });
      if (!img.ok) throw new Error(`image ${img.status}`);
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 2000) throw new Error(`suspiciously small (${buf.length}b)`);
      await writeFile(dest, buf);
      results.push([slug, `${name} · ${(buf.length / 1024).toFixed(0)}kb`]);
    } catch (err) {
      /* One card failing must not take the rest down — the dashboard falls
         back to the drawn slab for anything missing. */
      results.push([slug, `FAILED — ${err.message}`]);
    }

    await new Promise((r) => setTimeout(r, 120)); // be polite to both APIs
  }

  const failed = results.filter(([, s]) => s.startsWith("FAILED"));
  for (const [slug, status] of results) console.log(`  ${slug.padEnd(22)} ${status}`);
  console.log(`\n${results.length - failed.length}/${results.length} available in public/cards/`);
  if (failed.length) process.exitCode = 1;
}

main();
