import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { getI18n } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export async function generateMetadata() {
  return { title: (await getI18n()).t("forgot.title") };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <AuthShell title={t("forgot.title")} subtitle={t("forgot.subtitle")}>
      <ForgotPasswordForm />
      <div className="mt-5 text-center text-sm">
        <Link href="/login" className="text-muted transition hover:text-fg">{t("forgot.back")}</Link>
      </div>
    </AuthShell>
  );
}
