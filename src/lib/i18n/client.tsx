"use client";

import { createContext, useContext, useMemo } from "react";
import { makeTranslator, type Lang, type Translator } from ".";

const I18nContext = createContext<Translator>(makeTranslator("en"));

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => makeTranslator(lang), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
