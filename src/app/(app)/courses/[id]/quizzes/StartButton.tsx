"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { startQuizAction } from "@/app/exam/actions";

export function StartButton({ quizId, resume }: { quizId: string; resume: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const messages: Record<string, string> = { seb: t("qz.blocked.seb"), ip: t("qz.blocked.ip"), closed: t("qz.blocked.closed") };
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startQuizAction(quizId);
            if (r?.error) setError(messages[r.error] ?? t("common.invalid"));
          })
        }
      >
        {pending ? t("common.working") : t(resume ? "qz.resume" : "qz.start")}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
