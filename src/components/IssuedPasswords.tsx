"use client";

import { toCsv } from "@/lib/csv";

export type Issued = { username: string; fullName: string; password: string };

/** Shows freshly generated temporary passwords exactly once, with CSV download for printing slips. */
export function IssuedPasswords({ items }: { items: Issued[] }) {
  if (!items.length) return null;
  const download = () => {
    const csv = toCsv([["username", "fullName", "temporaryPassword"], ...items.map((i) => [i.username, i.fullName, i.password])]);
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `temp-passwords-${Date.now()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
      <p className="text-sm font-medium text-amber-300">Temporary passwords — shown only once</p>
      <p className="mt-0.5 text-xs text-muted">Download or copy them before leaving this page.</p>
      <table className="table mt-3">
        <thead><tr><th>ID</th><th>Name</th><th>Temporary password</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.username}>
              <td className="font-mono">{i.username}</td><td>{i.fullName}</td><td className="font-mono text-amber-200">{i.password}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={download} className="btn-secondary mt-3">Download CSV</button>
    </div>
  );
}
