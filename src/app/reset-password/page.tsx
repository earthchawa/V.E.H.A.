import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { findValidResetToken } from "@/lib/auth/account";
import { getI18n } from "@/lib/i18n/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export async function generateMetadata() {
  return { title: (await getI18n()).t("reset.title") };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const { t } = await getI18n();
  const record = await findValidResetToken(token);
  if (!record) {
    return (
      <AuthShell title={t("reset.expiredTitle")} subtitle={t("reset.expiredBody")}>
        <Link href="/forgot-password" className="btn w-full">{t("reset.requestNew")}</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("reset.title")} subtitle={t("reset.account", { id: record.user.username })}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
