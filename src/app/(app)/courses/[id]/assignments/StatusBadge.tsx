"use client";

import type { SubmissionStatus } from "@/lib/assignments";
import { useI18n } from "@/lib/i18n/client";

const STYLE: Record<SubmissionStatus, string> = {
  submitted: "bg-emerald-500/10 text-success",
  late: "bg-amber-500/10 text-warning",
  missing: "bg-red-500/10 text-danger",
  notYet: "bg-surface-3 text-muted",
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const { t } = useI18n();
  return <span className={`badge ${STYLE[status]}`}>{t(`asg.status.${status}`)}</span>;
}
