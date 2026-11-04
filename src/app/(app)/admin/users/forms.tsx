"use client";

import { useActionState } from "react";
import { createUserAction, importUsersAction, resetUserPasswordAction } from "../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { IssuedPasswords, type Issued } from "@/components/IssuedPasswords";

export function CreateUserForm() {
  const [state, action] = useActionState(createUserAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cu-username">รหัสประจำตัว</label>
          <input id="cu-username" name="username" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="cu-role">บทบาท</label>
          <select id="cu-role" name="role" className="input" defaultValue="STUDENT">
            <option value="STUDENT">นักเรียน</option>
            <option value="INSTRUCTOR">อาจารย์</option>
            <option value="ADMIN">ผู้ดูแลระบบ</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="cu-fullName">ชื่อ-นามสกุล</label>
        <input id="cu-fullName" name="fullName" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="cu-email">อีเมล (ไม่บังคับ)</label>
        <input id="cu-email" name="email" type="email" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>สร้างบัญชี</SubmitButton>
      <IssuedPasswords items={(state?.data as Issued[]) ?? []} />
    </form>
  );
}

export function ImportUsersForm() {
  const [state, action] = useActionState(importUsersAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="text-xs text-slate-500">
        คอลัมน์: <code>username, fullName, role, email</code> — role ใส่ student / instructor / admin (เว้นว่าง = นักเรียน),
        email ไม่บังคับ แถวหัวตารางจะถูกข้ามอัตโนมัติ
      </p>
      <input name="file" type="file" accept=".csv,text/csv" className="input" />
      <textarea
        name="csv"
        rows={4}
        className="input font-mono text-xs"
        placeholder={"หรือวางข้อมูลที่นี่ เช่น\n6601001,นนอ.สมชาย ใจดี,student,somchai@example.ac.th"}
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="กำลังนำเข้า…">นำเข้า</SubmitButton>
      <IssuedPasswords items={(state?.data as Issued[]) ?? []} />
    </form>
  );
}

export function ResetPasswordButton({ userId, username }: { userId: string; username: string }) {
  const [state, action] = useActionState(resetUserPasswordAction, undefined);
  const issued = (state?.data as Issued[] | undefined)?.[0];
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`ออกรหัสผ่านชั่วคราวใหม่ให้ ${username}? รหัสผ่านเดิมจะใช้ไม่ได้ทันที`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      {issued ? (
        <span className="rounded bg-amber-50 px-2 py-1 font-mono text-sm text-amber-900" title="แสดงครั้งเดียว">
          {issued.password}
        </span>
      ) : (
        <SubmitButton className="btn-secondary" pendingText="…">รีเซ็ตรหัสผ่าน</SubmitButton>
      )}
    </form>
  );
}
