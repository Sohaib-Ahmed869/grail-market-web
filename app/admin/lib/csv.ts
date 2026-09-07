"use client";

/**
 * Export, as a file that actually arrives.
 *
 * Every Export button in the console used to be a button with no handler. A
 * control that does nothing is worse than one that is not there — it gets
 * clicked, nothing happens, and the operator is left wondering whether the
 * download failed or the queue was empty.
 *
 * What it exports is what is on screen: the rows after the filter and the
 * search, in the order they are drawn. Exporting the unfiltered set would be a
 * different, unasked-for answer.
 */

/**
 * One CSV field.
 *
 * Quoting is not optional here. Card names carry commas, a moderator's reason
 * carries newlines and quotation marks, and a seller handle can start with `=`
 * — which a spreadsheet will happily evaluate as a formula. The leading
 * apostrophe on those is the standard defence against that.
 */
function field(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export type Column<T> = { header: string; value: (row: T) => unknown };

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const head = columns.map((c) => field(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => field(c.value(r))).join(","));
  /* CRLF and a BOM: Excel opens a bare UTF-8 CSV as Latin-1 and turns every
     accented set name into mojibake. The BOM is what stops that. */
  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}

/** Hand the browser a file. Named with the date so two exports do not collide. */
export function download(filename: string, contents: string, type = "text/csv;charset=utf-8") {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoked on the next tick rather than immediately: Safari has not started
     reading the blob by the time click() returns. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv<T>(filename: string, rows: T[], columns: Column<T>[]) {
  download(filename, toCsv(rows, columns));
}
