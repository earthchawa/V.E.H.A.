import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

/**
 * Instructor's two views of one quiz, as large tabs right under its title: the questions (builder) and
 * the results (who has started, what is waiting to be marked).
 */
export async function QuizTabs({
  base,
  active,
  questions,
  started,
  total,
  toGrade,
}: {
  base: string;
  active: "questions" | "results";
  questions: number;
  started: number;
  total: number;
  toGrade: number;
}) {
  const { t, tn } = await getI18n();
  const tab = (key: "questions" | "results", href: string, label: string, sub: string, badge?: React.ReactNode) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      data-testid={`quiz-tab-${key}`}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-4 py-3 transition sm:flex-none sm:min-w-56 ${
        active === key ? "border-accent/60 bg-accent/10" : "border-border bg-surface hover:border-border-strong hover:bg-surface-2"
      }`}
    >
      <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg text-base ${active === key ? "bg-accent text-accent-fg" : "bg-surface-3 text-muted"}`} aria-hidden>
        {key === "questions" ? "✎" : "▤"}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold">{label} {badge}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
    </Link>
  );
  return (
    <nav className="mb-6 flex flex-wrap gap-3" data-testid="quiz-tabs">
      {tab("questions", base, t("qz.builder"), tn("qz.questions", questions))}
      {tab(
        "results",
        `${base}/results`,
        t("qz.results"),
        t("qz.started", { n: started, total }),
        toGrade > 0 ? <span className="badge bg-accent/15 text-accent">{t("qz.toGrade", { n: toGrade })}</span> : undefined,
      )}
    </nav>
  );
}
