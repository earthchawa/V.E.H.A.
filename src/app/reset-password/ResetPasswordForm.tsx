"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "../auth-actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="newPassword">รหัสผ่านใหม่</label>
        <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
        <p className="mt-1 text-xs text-slate-500">อย่างน้อย 8 ตัว มีทั้งตัวอักษรภาษาอังกฤษและตัวเลข</p>
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</label>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton>ตั้งรหัสผ่านใหม่</SubmitButton>
    </form>
  );
}
