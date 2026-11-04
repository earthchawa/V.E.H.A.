"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "../auth-actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  if (state?.success) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">รหัสประจำตัว</label>
        <input id="username" name="username" className="input" required autoFocus />
      </div>
      <FormMessage state={state} />
      <SubmitButton>ส่งลิงก์ตั้งรหัสผ่านใหม่</SubmitButton>
    </form>
  );
}
