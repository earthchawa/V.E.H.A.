import type { Option, Response } from "@/lib/quiz";

/** Read-only rendering of a cadet's answer, optionally with the key. */
export function AnswerView({
  type,
  options,
  accepted,
  codeAnswer,
  response,
  showKey,
  labels,
}: {
  type: "SINGLE" | "MULTIPLE" | "SHORT" | "ESSAY";
  options: Option[];
  accepted: string[];
  codeAnswer: boolean;
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
