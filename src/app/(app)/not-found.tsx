import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

/** 404 inside the signed-in shell (no access, or missing record). */
export default async function AppNotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="font-mono text-xs text-accent">404</p>
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-sm text-muted">{t("notFound.body")}</p>
      <Link href="/" className="btn mt-2">{t("notFound.back")}</Link>
    </div>
  );
}
