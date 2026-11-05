import type { Option, Response } from "@/lib/quiz";
import { asLanguage, cleanFiles, isBlankCode } from "@/lib/code";
import { CodeWorkspace } from "./code/CodeWorkspace";

/** Read-only rendering of a cadet's answer, optionally with the key. */
export function AnswerView({
  type,
  options,
  accepted,
  codeAnswer,
  language,
  response,
  showKey,
  labels,
}: {
  type: "SINGLE" | "MULTIPLE" | "SHORT" | "ESSAY" | "CODE";
  options: Option[];
  accepted: string[];
  codeAnswer: boolean;
  /** CODE questions: the language, so the answer can be run again. */
  language?: string | null;
  response: Response | null;
  showKey: boolean;
  labels: { noAnswer: string; correctAnswer: string };
}) {
  if (type === "SINGLE" || type === "MULTIPLE") {
    const picked = new Set(response?.choice ?? []);
    return (
      <ul className="space-y-1 text-sm">
        {options.map((o) => {
          const mine = picked.has(o.id);
          const cls = showKey && o.correct ? "text-success" : mine && showKey ? "text-danger" : mine ? "text-fg" : "text-muted";
          return (
            <li key={o.id} className={cls}>
              <span className="inline-block w-5">{mine ? (type === "SINGLE" ? "●" : "☑") : type === "SINGLE" ? "○" : "☐"}</span>
              {o.text}
              {showKey && o.correct && <span className="ml-2 text-xs">✓</span>}
            </li>
          );
        })}
      </ul>
    );
  }
  if (type === "CODE") {
    if (isBlankCode(response?.files)) return <p className="text-sm text-subtle">{labels.noAnswer}</p>;
    const lang = asLanguage(language);
    return <CodeWorkspace language={lang} files={cleanFiles(lang, response?.files)} readOnly idPrefix="answer" />;
  }
  const text = response?.text?.trim();
  return (
    <div className="space-y-2">
      {text ? (
        <pre className={`whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm ${codeAnswer ? "font-mono text-[13px]" : "font-sans"}`}>{text}</pre>
      ) : (
        <p className="text-sm text-subtle">{labels.noAnswer}</p>
      )}
      {showKey && type === "SHORT" && accepted.length > 0 && (
        <p className="text-xs text-muted">{labels.correctAnswer}: <span className="text-success">{accepted.join(" · ")}</span></p>
      )}
    </div>
  );
}
