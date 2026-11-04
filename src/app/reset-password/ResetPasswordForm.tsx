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
        <label className="label" htmlFor="newPassword">New password</label>
        <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
        <p className="mt-1.5 text-xs text-subtle">At least 8 characters with letters and numbers.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">Confirm new password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn w-full">Update password</SubmitButton>
    </form>
  );
}
