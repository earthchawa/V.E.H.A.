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
        <label className="label" htmlFor="currentPassword">Current password</label>
        <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label" htmlFor="newPassword">New password</label>
        <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
        <p className="mt-1.5 text-xs text-subtle">At least 8 characters with letters and numbers. Must not contain your ID.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirmPassword">Confirm new password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </div>
      {askEmail && (
        <div>
          <label className="label" htmlFor="email">Recovery email <span className="text-subtle">(optional)</span></label>
          <input id="email" name="email" type="email" className="input" defaultValue={currentEmail ?? ""} autoComplete="email" />
          <p className="mt-1.5 text-xs text-subtle">Lets you reset a forgotten password yourself.</p>
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton className="btn w-full">Save password</SubmitButton>
    </form>
  );
}
