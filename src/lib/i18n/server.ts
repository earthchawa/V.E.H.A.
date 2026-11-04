import { cookies } from "next/headers";
import { cache } from "react";
import { LANG_COOKIE, THEME_COOKIE, makeTranslator, parseLang, parseTheme } from ".";

export const getPrefs = cache(async () => {
  const jar = await cookies();
  return { lang: parseLang(jar.get(LANG_COOKIE)?.value), theme: parseTheme(jar.get(THEME_COOKIE)?.value) };
});

/** Translator for the current request (server components and server actions). */
export const getI18n = cache(async () => makeTranslator((await getPrefs()).lang));
