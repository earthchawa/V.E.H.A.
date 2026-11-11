import { createHash, randomInt } from "node:crypto";

import { isBlankCode, type CodeFiles } from "./code";

export type QType = "SINGLE" | "MULTIPLE" | "SHORT" | "ESSAY" | "CODE";
export type Option = { id: string; text: string; correct: boolean };
export type Response = { choice?: string[]; text?: string; files?: CodeFiles };
export type QuestionForGrading = { type: QType; points: number; options: Option[]; accepted: string[] };

// ---------- grading ----------

/** Case-, space- and trailing-punctuation-insensitive comparison for short answers (works for Thai too). */
export function normaliseShort(s: string): string {
  return s.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.。,;:!?]+$/u, "");
}

/**
 * Points for an answer, or null when a person has to grade it.
 * MULTIPLE gives partial credit: (right picks − wrong picks) / correct options, never below 0.
 */
export function autoGrade(q: QuestionForGrading, r: Response | null | undefined): number | null {
  const choice = r?.choice ?? [];
  if (q.type === "SINGLE") {
    const correct = q.options.find((o) => o.correct);
    return choice.length === 1 && correct && choice[0] === correct.id ? q.points : 0;
  }
  if (q.type === "MULTIPLE") {
    const correct = new Set(q.options.filter((o) => o.correct).map((o) => o.id));
    if (correct.size === 0) return 0;
    const picked = new Set(choice);
    let right = 0;
    let wrong = 0;
    for (const id of picked) (correct.has(id) ? right++ : wrong++);
    return Math.max(0, Math.round(((right - wrong) / correct.size) * q.points * 100) / 100);
  }
  if (q.type === "SHORT") {
    const text = normaliseShort(r?.text ?? "");
    if (!text) return 0;
    return q.accepted.some((a) => normaliseShort(a) === text) ? q.points : null;
  }
  // CODE: graded by hand (cadets run it in the exam page; instructors can run it again when marking).
  if (q.type === "CODE") return isBlankCode(r?.files) ? 0 : null;
  // ESSAY: blank answers get 0 automatically; anything else is graded by hand.
  return (r?.text ?? "").trim() ? null : 0;
}

export function attemptTotals(answers: { points: number | null }[], maxScore: number) {
  const pending = answers.filter((a) => a.points == null).length;
  const sum = answers.reduce((n, a) => n + (a.points ?? 0), 0);
  return { score: pending ? null : Math.round(sum * 100) / 100, partial: Math.round(sum * 100) / 100, pending, maxScore };
}

// ---------- attempt layout & timing ----------

function shuffle<T>(xs: T[], rand: (n: number) => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Layout = { questions: string[]; options: Record<string, string[]> };

/** Per-cadet question/option order, fixed when the attempt starts. */
export function buildLayout(
  questions: { id: string; options: Option[] }[],
  opts: { shuffleQuestions: boolean; shuffleOptions: boolean },
  rand: (n: number) => number = randomInt,
): Layout {
  const qs = opts.shuffleQuestions ? shuffle(questions, rand) : questions;
  return {
    questions: qs.map((q) => q.id),
    options: Object.fromEntries(
      questions.map((q) => [q.id, (opts.shuffleOptions ? shuffle(q.options, rand) : q.options).map((o) => o.id)]),
    ),
  };
}

/** Attempt deadline: start + limit, never after the quiz closes. Null = no deadline. */
export function attemptDeadline(start: Date, timeLimitMin: number | null, closesAt: Date | null): Date | null {
  const byLimit = timeLimitMin ? new Date(start.getTime() + timeLimitMin * 60_000) : null;
  if (byLimit && closesAt) return byLimit < closesAt ? byLimit : closesAt;
  return byLimit ?? closesAt;
}

/** Answers arriving this long after the deadline are still accepted (network latency, autosave in flight). */
export const GRACE_MS = 30_000;

export type QuizPhase = "draft" | "upcoming" | "open" | "closed";
export function quizPhase(q: { isPublished: boolean; opensAt: Date | null; closesAt: Date | null }, now = new Date()): QuizPhase {
  if (!q.isPublished) return "draft";
  if (q.opensAt && now < q.opensAt) return "upcoming";
  if (q.closesAt && now >= q.closesAt) return "closed";
  return "open";
}

/** Cadets see results only after the quiz has closed (everyone has finished). */
export function resultsVisible(q: { results: "HIDDEN" | "SCORE" | "FULL"; closesAt: Date | null; isPublished: boolean; opensAt: Date | null }, now = new Date()) {
  if (q.results === "HIDDEN") return { score: false, answers: false };
  const closed = quizPhase(q, now) === "closed";
  return { score: closed, answers: closed && q.results === "FULL" };
}

// ---------- access restrictions ----------

function ipv4ToInt(ip: string): number | null {
  const m = ip.trim().replace(/^::ffff:/, "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/** Is `ip` in the allow-list (one IP or IPv4 CIDR per line)? Empty list = allowed. */
export function ipAllowed(ip: string | null, allowList: string | null | undefined): boolean {
  const rules = (allowList ?? "").split(/[\s,]+/).map((r) => r.trim()).filter(Boolean);
  if (!rules.length) return true;
  if (!ip) return false;
  const addr = ipv4ToInt(ip);
  return rules.some((rule) => {
    const [base, bitsRaw] = rule.split("/");
    if (bitsRaw === undefined) return base === ip || base === ip.replace(/^::ffff:/, "");
    const bits = Number(bitsRaw);
    const net = ipv4ToInt(base);
    if (addr == null || net == null || !(bits >= 0 && bits <= 32)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (addr & mask) === (net & mask);
  });
}

/**
 * Safe Exam Browser check. With Config Keys configured, SEB sends
 * X-SafeExamBrowser-ConfigKeyHash = SHA-256(absolute URL + config key) on every request.
 * Without keys we fall back to SEB's User-Agent marker (weaker, but stops ordinary browsers).
 */
export function sebOk(opts: { url: string; userAgent: string | null; configKeyHash: string | null; keys: string | null | undefined }): boolean {
  const keys = (opts.keys ?? "").split(/\s+/).map((k) => k.trim()).filter(Boolean);
  if (!keys.length) return /\bSEB\b|SafeExamBrowser/i.test(opts.userAgent ?? "");
  const got = (opts.configKeyHash ?? "").toLowerCase();
  if (!got) return false;
  const url = opts.url.split("#")[0];
  return keys.some((k) => createHash("sha256").update(url + k).digest("hex") === got);
}

// ---------- Exam integrity: severity, summaries, live presence ----------

export type Severity = "red" | "yellow";
/** Leaving the window for at least this long counts as serious. */
export const LONG_AWAY_MS = 10_000;
/** This many minor events together count as serious. */
export const MINOR_LIMIT = 3;
/** No heartbeat for this long = not connected. The exam page sends one every 10 s. */
export const OFFLINE_MS = 30_000;
/** Event types the exam page records (sent by the browser; "device"/"resume" come from the server). */
export const AWAY_TYPES = ["blur", "hidden"] as const;
const NEUTRAL = new Set(["open", "start", "submit", "autosubmit"]);

/** How long an away event lasted (filled in when the cadet came back); 0 when unknown. */
export function awayMs(details: unknown): number {
  const ms = details && typeof details === "object" ? (details as { ms?: unknown }).ms : undefined;
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Red: switched tab or minimised, exited full screen, changed device/network, or out of the window for
 * LONG_AWAY_MS or more. Yellow: a brief focus loss, blocked copy/paste/right-click, reloading the page.
 */
export function eventSeverity(type: string, details?: unknown): Severity | null {
  if (NEUTRAL.has(type)) return null;
  if (type === "hidden" || type === "fullscreen_exit" || type === "device") return "red";
  if (type === "blur") return awayMs(details) >= LONG_AWAY_MS ? "red" : "yellow";
  return "yellow";
}

export type IntegritySummary = { total: number; red: number; yellow: number; awayMs: number; level: Severity | null };

export function integritySummary(events: { type: string; details?: unknown }[]): IntegritySummary {
  let red = 0;
  let yellow = 0;
  let away = 0;
  for (const e of events) {
    const s = eventSeverity(e.type, e.details);
    if (s === "red") red++;
    else if (s === "yellow") yellow++;
    if ((AWAY_TYPES as readonly string[]).includes(e.type)) away += awayMs(e.details);
  }
  const level: Severity | null = red > 0 || yellow >= MINOR_LIMIT ? "red" : yellow > 0 ? "yellow" : null;
  return { total: red + yellow, red, yellow, awayMs: away, level };
}

export type Presence = "notStarted" | "submitted" | "active" | "away" | "offline";

/** Where a cadet is right now, for the supervising instructor's live view. Away wins over offline. */
export function presence(
  a: { status: "IN_PROGRESS" | "SUBMITTED"; lastSeenAt: Date | null; awayAt: Date | null } | null | undefined,
  now = new Date(),
): Presence {
  if (!a) return "notStarted";
  if (a.status === "SUBMITTED") return "submitted";
  if (a.awayAt) return "away";
  if (!a.lastSeenAt || now.getTime() - a.lastSeenAt.getTime() > OFFLINE_MS) return "offline";
  return "active";
}

/** Minutes and seconds of a duration, for "{m} min {s} s" style labels. */
export function splitDuration(ms: number): { m: number; s: number } {
  const total = Math.max(0, Math.round(ms / 1000));
  return { m: Math.floor(total / 60), s: total % 60 };
}
