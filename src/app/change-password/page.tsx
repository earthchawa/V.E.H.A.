import { AuthShell } from "@/components/AuthShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Set your password" };

/** First-login page: users on a temporary password land here and cannot go anywhere else. */
export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });
  return (
    <AuthShell
      title={user.mustChangePassword ? "Set your password" : "Change password"}
      subtitle={
        user.mustChangePassword
          ? `Welcome, ${user.fullName}. Replace your temporary password to continue.`
          : undefined
      }
    >
      <ChangePasswordForm askEmail currentEmail={user.email} />
    </AuthShell>
  );
}
