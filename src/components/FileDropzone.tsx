"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { formatBytes } from "@/lib/format";

/**
 * Drag-and-drop area around a real <input type="file">, so the files still travel with the
 * form's FormData. Shows the chosen files and lets you remove one.
 */
export function FileDropzone({
  id,
  name,
  multiple = false,
  required = false,
  accept,
}: {
  id: string;
  name: string;
  multiple?: boolean;
  required?: boolean;
  accept?: string;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);

  const sync = () => setFiles(Array.from(input.current?.files ?? []));
  const setInputFiles = (list: File[]) => {
    const dt = new DataTransfer();
    list.forEach((f) => dt.items.add(f));
    if (input.current) input.current.files = dt.files;
    sync();
  };

  // A form reset (e.g. after a successful upload) clears the input; clear the list too.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => setTimeout(sync, 0);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const dropped = Array.from(e.dataTransfer.files);
          setInputFiles(multiple ? [...files, ...dropped] : dropped.slice(0, 1));
        }}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${
          over ? "border-accent bg-accent/10 text-fg" : "border-border-strong text-muted hover:border-accent/50 hover:text-fg"
        }`}
        data-testid="dropzone"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{t(multiple ? "dz.drop" : "dz.dropOne")}</span>
        <input
          ref={input}
          id={id}
          name={name}
          type="file"
          multiple={multiple}
          required={required}
          accept={accept}
          onChange={sync}
          className="absolute inset-0 -z-10 h-full w-full opacity-0"
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-subtle">{formatBytes(f.size)}</span>
              <button type="button" onClick={() => setInputFiles(files.filter((_, k) => k !== i))} className="text-xs text-muted hover:text-danger">
                {t("dz.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
