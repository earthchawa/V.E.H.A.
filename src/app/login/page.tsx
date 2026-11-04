import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata() {
  return { title: (await getI18n()).t("login.title") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { reset } = await searchParams;
  const { t } = await getI18n();
  return (
    <AuthShell title={t("login.title")} subtitle={t("login.subtitle")}>
      {reset && (
        <p className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-success">
          {t("login.resetDone")}
        </p>
      )}
      <LoginForm />
      <div className="mt-5 text-center text-sm">
        <Link href="/forgot-password" className="text-muted transition hover:text-fg">{t("login.forgot")}</Link>
      </div>
    </AuthShell>
  );
}
