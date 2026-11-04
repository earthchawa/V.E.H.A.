"use client";

import { useActionState } from "react";
import { updateEmailAction } from "@/app/auth-actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export function UpdateEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [state, action] = useActionState(updateEmailAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" defaultValue={currentEmail ?? ""} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="emailPassword">Confirm with current password</label>
        <input id="emailPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary">Save email</SubmitButton>
    </form>
  );
}
