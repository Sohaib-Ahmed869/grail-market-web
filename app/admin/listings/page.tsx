"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { listings, money, num, shortDate, type Listing, type ListingStatus } from "../lib/data";
import {
  Avatar,
  Card,
  CardHead,
  Empty,
  ListingBadge,
  PageHead,
  PillTabs,
  Slab,
  Tier,
  GameChip,
  CardTile,
  ViewToggle,
} from "../components/ui";
import {
  IconAlert,
  IconArrowRight,
  IconDollar,
  IconDownload,
  IconExternal,
  IconEye,
  IconListing,
  IconSearch,
  IconShield,
  IconInbox,
  IconBan,
  IconClock,
} from "../components/icons";

type Filter = "all" | ListingStatus;

const FILTERS: { key: Filter; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <IconInbox /> },
  { key: "queued", label: "Queued", icon: <IconClock /> },
  { key: "live", label: "Live", icon: <IconEye /> },
  { key: "sold", label: "Sold", icon: <IconDollar /> },
  { key: "paused", label: "Paused", icon: <IconAlert /> },
  { key: "withdrawn", label: "Withdrawn", icon: <IconBan /> },
];

export default function ListingsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "gallery">("gallery");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: listings.length };
    for (const l of listings) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l: Listing) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (!q) return true;
      return (
        l.card.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.seller.handle.toLowerCase().includes(q)
      );
    });
  }, [filter, query]);

  const live = listings.filter((l) => l.status === "live");
  const liveValue = live.reduce((s, l) => s + l.price, 0);
  const queued = listings.filter((l) => l.status === "queued");

  return (
    <>
      <PageHead
        title="Listing queue"
        sub="What has cleared verification and is on its way to the market — plus everything already trading."
        right={
          <>
            <button type="button" className="gm-btn">
              <IconDownload />
              Export
            </button>
            <Link href="/admin/verification" className="gm-btn gm-btn--primary">
              <IconShield />
              Verification queue
              <IconArrowRight />
            </Link>
          </>
        }
      />

      <div className="gm-stack">
        <p className="gm-row gm-sm gm-muted" style={{ gap: 14, margin: 0 }}>
          <span>
            <b className="gm-strong">{queued.length}</b> queued for release
          </span>
          <span>
            <b className="gm-strong">{live.length}</b> live · {money(liveValue)} on the market
          </span>
          <span className="gm-dim">1 paused · 1 withdrawn</span>
        </p>

        <Card>
          <CardHead
            title="Listings"
            sub={`${rows.length} of ${listings.length} shown`}
            right={
              <div className="gm-row" style={{ gap: 8 }}>
                <div className="gm-search" style={{ width: 240 }}>
                  <IconSearch />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Card, listing id, seller…"
                    aria-label="Search listings"
                  />
                </div>
                <ViewToggle value={view} onChange={setView} />
              </div>
            }
          />

          <div style={{ padding: "12px 18px 0" }}>
            <PillTabs
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({ ...f, count: counts[f.key] ?? 0 }))}
            />
          </div>

          {rows.length === 0 ? (
            <Empty icon={<IconListing />} title="No listings match" body="Clear the search or pick another status." />
          ) : view === "gallery" ? (
            <div className="gm-gallery">
              {rows.map((l) => (
                <CardTile
                  key={l.id}
                  slab={<Slab grader={l.grader} grade={l.grade} game={l.game} art={l.art} size="lg" />}
                  topLeft={<Tier tier={l.tier} />}
                  topRight={<ListingBadge status={l.status} />}
                  title={l.card}
                  sub={`${l.grader} ${l.grade} · ${l.setLine}`}
                  price={money(l.price)}
                  meta={
                    <>
                      <GameChip game={l.game} />
                      <span className="gm-tiny gm-dim gm-spacer">
                        {num(l.views)} views · {num(l.watchers)} watching
                      </span>
                    </>
                  }
                  footer={
                    <>
                      <Avatar initials={l.seller.initials} size="sm" />
                      <span className="gm-tiny gm-muted">{l.seller.handle}</span>
                      {l.status === "queued" ? (
                        <button type="button" className="gm-btn gm-btn--sm gm-btn--primary gm-spacer">
                          Publish
                        </button>
                      ) : l.status === "live" ? (
                        <button type="button" className="gm-btn gm-btn--sm gm-btn--danger gm-spacer">
                          Withdraw
                        </button>
                      ) : (
                        <span className="gm-spacer" />
                      )}
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="gm-tablewrap" style={{ marginTop: 12 }}>
              <table className="gm-table" style={{ minWidth: 1020 }}>
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>Seller</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th className="gm-num">Price</th>
                    <th className="gm-num">Views</th>
                    <th className="gm-num">Watching</th>
                    <th>Released by</th>
                    <th className="gm-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="gm-cell-user">
                          <Slab grader={l.grader} grade={l.grade} game={l.game} art={l.art} />
                          <div className="gm-cell2">
                            <b>{l.card}</b>
                            <span>
                              {l.grader} {l.grade} · {l.setLine}
                            </span>
                            <span className="gm-dim gm-mono" style={{ fontSize: 11 }}>
                              {l.id} · {shortDate(l.releasedAt)}
                            </span>
                            <span style={{ marginTop: 3 }}>
                              <GameChip game={l.game} />
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="gm-cell-user">
                          <Avatar initials={l.seller.initials} size="sm" />
                          <span className="gm-sm">{l.seller.handle}</span>
                        </div>
                      </td>
                      <td>
                        <Tier tier={l.tier} />
                      </td>
                      <td>
                        <ListingBadge status={l.status} />
                      </td>
                      <td className="gm-num gm-strong">{money(l.price)}</td>
                      <td className="gm-num gm-muted">{num(l.views)}</td>
                      <td className="gm-num gm-muted">{num(l.watchers)}</td>
                      <td className="gm-sm gm-muted">
                        {l.verifiedBy ?? <span className="gm-dim">Auto-cleared</span>}
                      </td>
                      <td className="gm-actions">
                        <div className="gm-row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          {l.status === "queued" ? (
                            <button type="button" className="gm-btn gm-btn--sm gm-btn--primary">
                              Publish
                            </button>
                          ) : l.status === "live" ? (
                            <button type="button" className="gm-btn gm-btn--sm gm-btn--danger">
                              Withdraw
                            </button>
                          ) : l.status === "paused" ? (
                            <button type="button" className="gm-btn gm-btn--sm gm-btn--gold">
                              Resume
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="gm-btn gm-btn--sm gm-btn--icon"
                            aria-label="Open on the public site"
                          >
                            <IconExternal />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
