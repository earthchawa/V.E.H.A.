"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addMaterialAction } from "./actions";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function AddMaterialForm({ offeringId }: { offeringId: string }) {
  const [state, action] = useActionState(addMaterialAction.bind(null, offeringId), undefined);
  const [type, setType] = useState<"FILE" | "LINK">("FILE");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-xs" role="tablist">
        {(["FILE", "LINK"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={`rounded-md py-1.5 transition ${type === t ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"}`}
          >
            {t === "FILE" ? "Upload file" : "Add link"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_4.5rem] gap-3">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" className="input" required maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="week">Week</label>
          <input id="week" name="week" type="number" min={0} max={30} className="input" />
        </div>
      </div>
      {type === "FILE" ? (
        <div>
          <label className="label" htmlFor="file">File <span className="text-subtle">(max 50 MB)</span></label>
          <input id="file" name="file" type="file" className="input" required />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="url">URL</label>
          <input id="url" name="url" type="url" className="input" placeholder="https://" required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="description">Description <span className="text-subtle">(optional)</span></label>
        <textarea id="description" name="description" rows={2} className="input" maxLength={2000} />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="isPublished" defaultChecked className="accent-accent" /> Visible to cadets
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn w-full" pendingText="Uploading…">Add material</SubmitButton>
    </form>
  );
}
