"use client";

import { useActionState } from "react";
import { enrollAction } from "../../actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function EnrollForm({ offeringId }: { offeringId: string }) {
  const [state, action] = useActionState(enrollAction.bind(null, offeringId), undefined);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="role">เพิ่มเป็น</label>
        <select id="role" name="role" className="input">
          <option value="STUDENT">นักเรียน</option>
          <option value="INSTRUCTOR">อาจารย์ผู้สอน</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="usernames">รหัสประจำตัว (หลายรหัสได้ คั่นด้วยเว้นวรรค จุลภาค หรือขึ้นบรรทัดใหม่)</label>
        <textarea id="usernames" name="usernames" rows={6} className="input font-mono text-xs" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton>เพิ่ม</SubmitButton>
    </form>
  );
}
