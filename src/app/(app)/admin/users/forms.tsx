"use client";

import { useActionState } from "react";
import { createUserAction, importUsersAction, resetUserPasswordAction } from "../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { IssuedPasswords, type Issued } from "@/components/IssuedPasswords";

export function CreateUserForm() {
  const [state, action] = useActionState(createUserAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cu-username">ID</label>
          <input id="cu-username" name="username" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="cu-role">Role</label>
          <select id="cu-role" name="role" className="input" defaultValue="STUDENT">
            <option value="STUDENT">Cadet</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="cu-fullName">Full name</label>
        <input id="cu-fullName" name="fullName" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="cu-email">Email <span className="text-subtle">(optional)</span></label>
        <input id="cu-email" name="email" type="email" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Create account</SubmitButton>
      <IssuedPasswords items={(state?.data as Issued[]) ?? []} />
    </form>
  );
}

export function ImportUsersForm() {
  const [state, action] = useActionState(importUsersAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <p className="text-xs leading-relaxed text-muted">
        Columns: <code className="font-mono text-fg">username, fullName, role, email</code>. Role is
        cadet / instructor / admin (blank = cadet). Email is optional. A header row is skipped automatically.
      </p>
      <input name="file" type="file" accept=".csv,text/csv" className="input" aria-label="CSV file" />
      <textarea
        name="csv"
        rows={4}
        className="input font-mono text-xs"
        aria-label="CSV rows"
        placeholder={"…or paste rows here\n6601001,Somchai Jaidee,cadet,somchai@example.ac.th"}
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="Importing…">Import</SubmitButton>
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
        if (!confirm(`Issue a new temporary password for ${username}? Their current password stops working immediately.`))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      {issued ? (
        <span className="badge bg-amber-500/10 px-2 py-1 font-mono text-sm text-amber-200" title="Shown only once">
          {issued.password}
        </span>
      ) : (
        <SubmitButton className="btn-secondary" pendingText="…">Reset password</SubmitButton>
      )}
    </form>
  );
}
