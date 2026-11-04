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
    <form ref={formRef} action={action} className="space-y-3">
      <div className="flex gap-4 text-sm">
        {(["FILE", "LINK"] as const).map((t) => (
          <label key={t} className="flex items-center gap-1">
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />
            {t === "FILE" ? "อัปโหลดไฟล์" : "ลิงก์ (YouTube, Google Drive ฯลฯ)"}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <div>
          <label className="label" htmlFor="title">ชื่อเอกสาร</label>
          <input id="title" name="title" className="input" required maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="week">สัปดาห์</label>
          <input id="week" name="week" type="number" min={0} max={30} className="input" />
        </div>
      </div>
      {type === "FILE" ? (
        <div>
          <label className="label" htmlFor="file">ไฟล์ (ไม่เกิน 50 MB)</label>
          <input id="file" name="file" type="file" className="input" required />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="url">ลิงก์</label>
          <input id="url" name="url" type="url" className="input" placeholder="https://" required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="description">คำอธิบาย (ไม่บังคับ)</label>
        <textarea id="description" name="description" rows={2} className="input" maxLength={2000} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked /> เผยแพร่ให้นักเรียนเห็นทันที
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="กำลังอัปโหลด…">เพิ่มเอกสาร</SubmitButton>
    </form>
  );
}
