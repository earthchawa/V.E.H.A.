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
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">
        รหัสผ่านชั่วคราว — แสดงครั้งเดียวเท่านั้น ดาวน์โหลดหรือจดไว้ก่อนออกจากหน้านี้
      </p>
      <table className="table mt-2">
        <thead><tr><th>รหัสประจำตัว</th><th>ชื่อ</th><th>รหัสผ่านชั่วคราว</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.username}>
              <td>{i.username}</td><td>{i.fullName}</td><td className="font-mono">{i.password}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={download} className="btn-secondary mt-2">ดาวน์โหลด CSV</button>
    </div>
  );
}
