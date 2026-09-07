"use client";

import type { AdminCase, CaseMessage } from "./api";
import type { Conflict, Game, Grader } from "./data";

/**
 * A case, in the shape the conduct board draws.
 *
 * The API answers with two parties and a thread; the board wants a buyer and a
 * seller, a claim from each, evidence, and a dated history. Both describe the
 * same case — the difference is that the store records who raised it and which
 * side they were on, while the board is laid out around the two roles.
 *
 * The translation lives here rather than in the page so there is one place
 * that knows the store's `raiser_role` decides who is "the seller" on screen,
 * and one place to change when the console starts holding cases of its own.
 */

const GRADERS: Grader[] = ["PSA", "BGS", "CGC", "SGC", "TAG", "Raw"];

export function toConflict(c: AdminCase, thread: CaseMessage[] = []): Conflict {
  /* Which role each party held. The raiser's own role is recorded; the other
     party held the opposite one, because a dispute has exactly two sides. */
  const raiserIsBuyer = c.raiserRole !== "seller";
  const buyer = raiserIsBuyer ? c.raisedBy : c.against;
  const seller = raiserIsBuyer ? c.against : c.raisedBy;

  const party = (p: AdminCase["raisedBy"]) => ({
    handle: p.handle,
    name: p.name,
    initials: p.initials,
    joined: p.joined ? p.joined.slice(0, 10) : "Unknown",
    /* Counted by the API over `disputes`, this case excluded. The board raises
       a warning above four, so this must be a real number or the warning is. */
    disputes: p.priorCases,
  });

  /* The raiser's claim is the detail they filed with the case. The other
     side's is their first reply on the thread; silence is said out loud
     rather than left as an empty quotation mark. */
  const answer = thread.find((m) => m.byId === c.against.id && m.body)?.body;
  const raiserClaim = c.detail || "No detail was filed with the report.";
  const otherClaim = answer || "No answer from this side yet.";

  return {
    id: c.id,
    kind: c.kind,
    status: c.status,
    opened: c.opened,
    amount: c.amount,
    against: raiserIsBuyer ? "seller" : "buyer",
    listing: {
      id: c.listing?.id ?? "",
      card: c.listing?.card ?? "Listing removed",
      setLine: c.listing?.setLine ?? "",
      grader: (GRADERS.find((g) => g === c.listing?.grader) ?? "Raw") as Grader,
      grade: c.listing?.grade ?? "None",
      /* The board never branches on the game — it draws the card art — so a
         placeholder here is a label, not a decision. */
      game: "Pokémon" as Game,
      art: c.listing?.art,
    },
    buyer: party(buyer),
    seller: party(seller),
    buyerClaim: raiserIsBuyer ? raiserClaim : otherClaim,
    sellerClaim: raiserIsBuyer ? otherClaim : raiserClaim,
    evidence: thread.flatMap((m) =>
      m.photos.map((_, i) => ({
        label: `Photograph ${i + 1} from ${m.by}`,
        from: (m.byId === buyer.id ? "buyer" : "seller") as "buyer" | "seller",
        kind: "photo" as const,
      })),
    ),
    timeline: thread.map((m) => ({
      at: m.at,
      by: m.by,
      side: (m.byId === buyer.id
        ? "buyer"
        : m.byId === seller.id
          ? "seller"
          : m.kind === "status"
            ? "admin"
            : "system") as "buyer" | "seller" | "admin" | "system",
      text: m.body ?? "",
    })),
    ageHours: c.ageHours,
  };
}
