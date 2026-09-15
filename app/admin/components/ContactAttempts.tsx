"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  closeContactReview,
  fetchMemberContact,
  type ContactAttempt,
  type MemberContact,
} from "../lib/api";
import { shortDate } from "../lib/data";
import { Badge, Card, CardBody, CardHead, Loading, Modal, Note } from "./ui";
import { IconCheck, IconEye, IconEyeOff } from "./icons";

/**
 * What this member has tried to take off the platform.
 *
 * Every masked phone number, email, link and number split across messages is
 * held against the account on the API. The card says in so many words what
 * the count is and is not: the rules catch common patterns, not everything —
 * a photograph of a handwritten number or "same name on insta" gets through —
 * so a zero is "nothing caught", never "clean".
 */

const FLAG_LABEL: Record<string, string> = {
  phone: "Phone number",
  email: "Email",
  link: "Link",
  "split-contact": "Number split over messages",
  "off-platform": "Names another app",
  handle: "Social handle",
  "mail-provider": "Mail provider",
};

const SOURCE_LABEL: Record<ContactAttempt["source"], string> = {
  message: "Chat",
  post: "Community post",
  comment: "Community comment",
};

export function ContactAttempts({ memberId, canAct }: { memberId: string; canAct: boolean }) {
  const [data, setData] = useState<MemberContact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMemberContact(memberId)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [memberId]);

  async function close() {
    if (note.trim().length < 4 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await closeContactReview(memberId, note.trim());
      setData(r);
      setClosing(false);
      setNote("");
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const s = data?.summary;

  return (
    <Card>
      <CardHead
        title="Contact-sharing attempts"
        sub={`Phone numbers, emails and links the masking rules caught, last ${s?.windowDays ?? 30} days`}
        right={
          <>
            {data?.canReadTyped && data.attempts.length > 0 ? (
              <button
                type="button"
                className="gm-btn gm-btn--sm gm-btn--ghost"
                onClick={() => setReveal((v) => !v)}
                aria-pressed={reveal}
              >
                {reveal ? <IconEyeOff /> : <IconEye />}
                {reveal ? "Hide what was typed" : "Show what was typed"}
              </button>
            ) : null}
            {s?.reviewOpen && canAct && data?.canClose ? (
              <button type="button" className="gm-btn gm-btn--sm" onClick={() => setClosing(true)}>
                <IconCheck />
                Close review
              </button>
            ) : null}
          </>
        }
      />
      <CardBody>
        {error ? (
          <Note tone="bad">
            <b>Could not read the record.</b> {error}
          </Note>
        ) : !data || !s ? (
          <Loading small label="Reading attempts…" />
        ) : (
          <>
            <div className="gm-row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <Badge tone={s.recentContact === 0 ? "ok" : s.recentContact >= s.limit && s.limit > 0 ? "bad" : "warn"}>
                {s.recentContact} contact detail{s.recentContact === 1 ? "" : "s"} caught
              </Badge>
              {s.recentAll > s.recentContact ? (
                <Badge tone="info">
                  {s.recentAll - s.recentContact} mention{s.recentAll - s.recentContact === 1 ? "" : "s"} of another app
                </Badge>
              ) : null}
              {s.reviewOpen ? (
                <Badge tone="bad">Review open since {shortDate(s.reviewOpenedAt!)}</Badge>
              ) : s.reviewClosedAt ? (
                <Badge tone="idle">
                  Last review closed {shortDate(s.reviewClosedAt)}
                  {s.reviewClosedBy ? ` by ${s.reviewClosedBy}` : ""}
                </Badge>
              ) : null}
              <span className="gm-sm gm-muted">
                {s.limit > 0
                  ? `A review opens at ${s.limit} in ${s.windowDays} days.`
                  : "The automatic review is switched off."}{" "}
                {s.total} recorded in total.
              </span>
            </div>

            <p className="gm-sm gm-muted" style={{ marginTop: 0 }}>
              These are what the rules caught. They catch common patterns, not every attempt — a
              photo of a written number gets through — so a count of zero does not mean this member has
              never shared a contact detail.
            </p>

            {data.attempts.length === 0 ? (
              <span className="gm-sm gm-muted">Nothing caught on this account.</span>
            ) : (
              <div className="gm-tablewrap">
                <table className="gm-table gm-table--left gm-table--tight">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Where</th>
                      <th>Caught</th>
                      <th>{reveal ? "What was typed" : "What others saw"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attempts.map((a) => (
                      <tr key={a.id}>
                        <td className="gm-mono" style={{ whiteSpace: "nowrap" }}>
                          {shortDate(a.at)}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {SOURCE_LABEL[a.source]}
                          {!a.masked && a.contact ? (
                            <div className="gm-sm gm-muted">Not masked — masking was off</div>
                          ) : null}
                        </td>
                        <td>
                          <div className="gm-row" style={{ gap: 4, flexWrap: "wrap" }}>
                            {a.flags.map((f) => (
                              <Badge key={f} tone={a.contact ? "warn" : "info"}>
                                {FLAG_LABEL[f] ?? f}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td style={{ maxWidth: 420, wordBreak: "break-word" }}>
                          {/* Unmasked text was stored as typed, so there is no
                              separate original to reveal — the shown text is it. */}
                          {(reveal ? a.typed ?? a.shown : a.shown) ?? (
                            <span className="gm-muted">The text is no longer available.</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardBody>

      <Modal
        open={closing}
        onClose={() => setClosing(false)}
        title="Close the contact-sharing review"
        sub="Closing says the evidence was looked at. A restriction, if one is warranted, is a separate action with its own reason."
        footer={
          <>
            <button type="button" className="gm-btn" onClick={() => setClosing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="gm-btn gm-btn--primary"
              disabled={note.trim().length < 4 || saving}
              onClick={close}
            >
              <IconCheck />
              {saving ? "Closing…" : "Close review"}
            </button>
          </>
        }
      >
        {saveError ? (
          <Note tone="bad">
            <b>Not closed.</b> {saveError}
          </Note>
        ) : null}
        <div className="gm-field">
          <label className="gm-label" htmlFor="gm-contact-note">
            What you found
          </label>
          <textarea
            id="gm-contact-note"
            className="gm-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Warned in chat, certificate numbers rather than a phone number, restricted separately…"
          />
          <span className="gm-hint">
            Goes on the audit log. The count starts again from now, so a member who keeps trying
            opens a new review.
          </span>
        </div>
      </Modal>
    </Card>
  );
}
