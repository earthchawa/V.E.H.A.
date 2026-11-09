import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { getI18n } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { config } from "@/lib/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t("forgot.title") };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <AuthShell title={t("forgot.title")} subtitle={config.emailReset ? t("forgot.subtitle") : undefined}>
      {config.emailReset ? (
        <ForgotPasswordForm />
      ) : (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-3 text-sm leading-relaxed text-muted" data-testid="contact-admin">
          {t("forgot.contactAdmin")}
        </p>
      )}
      <div className="mt-5 text-center text-sm">
        <Link href="/login" className="text-muted transition hover:text-fg">{t("forgot.back")}</Link>
      </div>
    </AuthShell>
  );
}
