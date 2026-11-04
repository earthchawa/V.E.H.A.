"use client";

import { useActionState } from "react";
import { enrollAction } from "../../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function EnrollForm({ offeringId }: { offeringId: string }) {
  const [state, action] = useActionState(enrollAction.bind(null, offeringId), undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="role">Add as</label>
        <select id="role" name="role" className="input">
          <option value="STUDENT">Cadet</option>
          <option value="INSTRUCTOR">Instructor</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="usernames">IDs <span className="text-subtle">(separated by spaces, commas or new lines)</span></label>
        <textarea id="usernames" name="usernames" rows={6} className="input font-mono text-xs" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Add to roster</SubmitButton>
    </form>
  );
}
