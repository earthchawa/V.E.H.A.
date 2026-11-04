import { AuthShell } from "@/components/AuthShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t("change.titleFirst") };
}

/** First-login page: users on a temporary password land here and cannot go anywhere else. */
export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });
  const { t } = await getI18n();
  return (
    <AuthShell
      title={t(user.mustChangePassword ? "change.titleFirst" : "change.title")}
      subtitle={user.mustChangePassword ? t("change.welcome", { name: user.fullName }) : undefined}
    >
      <ChangePasswordForm askEmail currentEmail={user.email} />
    </AuthShell>
  );
}
