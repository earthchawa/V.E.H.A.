import type { Assignment, Submission } from "@prisma/client";

export const SUBMISSION_LIMITS = { maxFiles: 5, maxFileMb: 20 };

/** Per-file and per-request upload limits (MB) for a deployment whose request cap is `maxUploadMb`. */
export function uploadLimits(maxUploadMb: number) {
  return { maxFiles: SUBMISSION_LIMITS.maxFiles, fileMb: Math.min(SUBMISSION_LIMITS.maxFileMb, maxUploadMb), totalMb: maxUploadMb };
}

export function isPastDue(a: Pick<Assignment, "dueAt">, now = new Date()): boolean {
  return !!a.dueAt && a.dueAt < now;
}

export function acceptsSubmissions(a: Pick<Assignment, "dueAt" | "allowLate">, now = new Date()): boolean {
  return !isPastDue(a, now) || a.allowLate;
}

/** Whether a cadet may see the similarity report for their own submission. */
export function studentCanSeeReport(
  a: Pick<Assignment, "checkSimilarity" | "reportVisibility" | "dueAt">,
  now = new Date(),
): boolean {
  if (!a.checkSimilarity) return false;
  if (a.reportVisibility === "IMMEDIATE") return true;
  if (a.reportVisibility === "AFTER_DUE") return isPastDue(a, now);
  return false;
}

export type SubmissionStatus = "submitted" | "late" | "missing" | "notYet";

export function submissionStatus(a: Pick<Assignment, "dueAt">, s: Pick<Submission, "isLate"> | null | undefined, now = new Date()): SubmissionStatus {
  if (s) return s.isLate ? "late" : "submitted";
  return isPastDue(a, now) ? "missing" : "notYet";
}

/** <input type="datetime-local"> values are Bangkok time (UTC+7, no DST). */
export function parseBangkokLocal(v: string): Date | null {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toBangkokLocal(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 16);
}
