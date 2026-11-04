"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LANG_COOKIE, THEME_COOKIE, type Lang, type Theme } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

const SunIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <circle cx="10" cy="10" r="3.5" />
    <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" strokeLinecap="round" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" strokeLinejoin="round" />
  </svg>
);

/** Theme (dark/light) and language (EN/TH) switches, stored in cookies so the server renders them. */
export function PrefsSwitcher() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    setCookie(THEME_COOKIE, next);
  };

  const switchLang = (next: Lang) => {
    if (next === lang) return;
    setCookie(LANG_COOKIE, next);
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  };

  const nextMode = t(theme === "dark" ? "prefs.light" : "prefs.dark");
  return (
    <div className="flex items-center gap-1">
      <div className={`flex rounded-md border border-border p-0.5 text-[11px] font-medium ${pending ? "opacity-60" : ""}`} role="group" aria-label={t("prefs.language")}>
        {(["en", "th"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => switchLang(l)}
            aria-pressed={lang === l}
            className={`rounded px-1.5 py-0.5 transition ${lang === l ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"}`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-3 hover:text-fg"
        aria-label={t("prefs.toggleTheme", { mode: nextMode })}
        title={t("prefs.toggleTheme", { mode: nextMode })}
        data-testid="theme-toggle"
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}
