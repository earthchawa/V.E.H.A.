import { en, type Key } from "./en";
import { th } from "./th";

export type { Key };
export type Lang = "en" | "th";
export type Theme = "dark" | "light";
export type Vars = Record<string, string | number>;
/** A translatable message returned by library code; translated where it is shown. */
export type Msg = { key: Key; vars?: Vars };

export const LANG_COOKIE = "lang";
export const THEME_COOKIE = "theme";
export const LANGS: Lang[] = ["en", "th"];

export const msg = (key: Key, vars?: Vars): Msg => ({ key, vars });

export function parseLang(v: string | undefined): Lang {
  return v === "th" ? "th" : "en";
}
export function parseTheme(v: string | undefined): Theme {
  return v === "light" ? "light" : "dark";
}

const dicts: Record<Lang, Record<Key, string>> = { en, th };

export type Translator = ReturnType<typeof makeTranslator>;

export function makeTranslator(lang: Lang) {
  const dict = dicts[lang];
  const t = (key: Key, vars?: Vars): string => {
    const s = dict[key] ?? en[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
  };
  /** Pluralised: uses `${base}.one` / `${base}.other` with {n}. */
  const tn = (base: string, n: number, vars?: Vars) =>
    t(`${base}.${n === 1 ? "one" : "other"}` as Key, { n, ...vars });
  const tm = (m: Msg) => t(m.key, m.vars);
  const locale = lang === "th" ? "th-TH" : "en-GB";
  const date = (d: Date) =>
    d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
  const term = (x: { academicYear: number; semester: number }) =>
    x.semester === 3 ? t("term.summer", { y: x.academicYear }) : t("term.semester", { s: x.semester, y: x.academicYear });
  const role = (r: "ADMIN" | "INSTRUCTOR" | "STUDENT") => t(`role.${r}` as Key);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return { lang, t, tn, tm, date, term, role, pct };
}
