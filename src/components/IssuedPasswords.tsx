"use client";

import { toCsv } from "@/lib/csv";
import { useI18n } from "@/lib/i18n/client";

export type Issued = { username: string; fullName: string; password: string };

/** Shows freshly generated temporary passwords exactly once, with CSV download for printing slips. */
export function IssuedPasswords({ items }: { items: Issued[] }) {
  const { t } = useI18n();
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
      <p className="text-sm font-medium text-warning">{t("temp.title")}</p>
      <p className="mt-0.5 text-xs text-muted">{t("temp.hint")}</p>
      <table className="table mt-3">
        <thead><tr><th>{t("login.id")}</th><th>{t("users.fullName")}</th><th>{t("temp.password")}</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.username}>
              <td className="font-mono">{i.username}</td><td>{i.fullName}</td><td className="font-mono text-warning">{i.password}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={download} className="btn-secondary mt-3">{t("temp.download")}</button>
    </div>
  );
}
