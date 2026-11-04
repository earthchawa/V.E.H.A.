import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/noto-sans-thai";
import { brand } from "@/lib/brand";
import { getI18n, getPrefs } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: `${t("app.tagline")} — ${t("app.org")}`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, theme } = await getPrefs();
  return (
    <html lang={lang} data-theme={theme} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
