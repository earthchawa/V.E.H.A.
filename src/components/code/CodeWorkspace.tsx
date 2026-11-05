"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { LANGUAGE_FILES, type CodeFiles, type CodeLanguage } from "@/lib/code";
import { CodeEditor } from "./CodeEditor";
import { CodeRunner } from "./CodeRunner";

/**
 * File tabs + editor + runner. Editable in the exam page; read-only (but runnable) when an instructor
 * marks an answer or a cadet reviews their results.
 */
export function CodeWorkspace({
  language,
  files,
  onChange,
  readOnly = false,
  idPrefix,
}: {
  language: CodeLanguage;
  files: CodeFiles;
  onChange?: (files: CodeFiles) => void;
  readOnly?: boolean;
  idPrefix: string;
}) {
  const { t } = useI18n();
  const names = LANGUAGE_FILES[language];
  const [active, setActive] = useState(names[0]);
  // Local copy so switching tabs keeps unsaved text and the runner always sees the latest code.
  const [current, setCurrent] = useState<CodeFiles>(() => Object.fromEntries(names.map((n) => [n, files[n] ?? ""])));

  const edit = (name: string, v: string) => {
    const next = { ...current, [name]: v };
    setCurrent(next);
    onChange?.(next);
  };

  return (
    <div className="space-y-3" data-testid="code-workspace" data-language={language}>
      <div className="min-w-0 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-1.5" role="tablist">
          {names.map((n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={active === n}
              onClick={() => setActive(n)}
              className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-xs transition ${active === n ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"}`}
              data-testid="code-tab"
            >
              {n}
            </button>
          ))}
          <span className="ml-auto shrink-0 pl-2 text-[11px] text-subtle">{t(`code.lang.${language}`)}</span>
        </div>
        {names.map((n) => (
          <div key={`${idPrefix}-${n}`} hidden={active !== n}>
            <CodeEditor value={current[n] ?? ""} onChange={(v) => edit(n, v)} fileName={n} readOnly={readOnly} label={`${t("code.editor")} ${n}`} />
          </div>
        ))}
      </div>
      <CodeRunner language={language} files={current} />
    </div>
  );
}
