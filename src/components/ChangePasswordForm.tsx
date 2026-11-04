"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/auth-actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function ChangePasswordForm({ askEmail, currentEmail }: { askEmail?: boolean; currentEmail?: string | null }) {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="currentPassword">รหัสผ่านปัจจุบัน</label>
        <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label" htmlFor="newPassword">รหัสผ่านใหม่</label>
        <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
        <p className="mt-1 text-xs text-slate-500">อย่างน้อย 8 ตัว มีทั้งตัวอักษรภาษาอังกฤษและตัวเลข และไม่มีรหัสประจำตัวอยู่ในรหัสผ่าน</p>
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</label>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </div>
      {askEmail && (
        <div>
          <label className="label" htmlFor="email">อีเมลสำหรับกู้รหัสผ่าน</label>
          <input id="email" name="email" type="email" className="input" defaultValue={currentEmail ?? ""} autoComplete="email" />
          <p className="mt-1 text-xs text-slate-500">ถ้าใส่อีเมลไว้ เมื่อลืมรหัสผ่านจะรีเซ็ตเองได้ทางอีเมล โดยไม่ต้องติดต่อผู้ดูแลระบบ</p>
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton>บันทึกรหัสผ่าน</SubmitButton>
    </form>
  );
}
