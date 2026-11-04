"use client";

import { useActionState } from "react";
import { loginAction } from "../auth-actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="username">ID</label>
        <input id="username" name="username" className="input" autoComplete="username" placeholder="e.g. 6601001" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn w-full" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
