import { AuthShell } from "@/components/AuthShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "ตั้งรหัสผ่านใหม่" };

/** First-login page: users on a temporary password land here and cannot go anywhere else. */
export default async function ChangePasswordPage() {
  const user = await requireUser({ allowMustChange: true });
  return (
    <AuthShell
      title={user.mustChangePassword ? "ตั้งรหัสผ่านของคุณ" : "เปลี่ยนรหัสผ่าน"}
      subtitle={
        user.mustChangePassword
          ? `สวัสดี ${user.fullName} — กรุณาตั้งรหัสผ่านใหม่แทนรหัสผ่านชั่วคราวก่อนเริ่มใช้งาน`
          : undefined
      }
    >
      <ChangePasswordForm askEmail currentEmail={user.email} />
    </AuthShell>
  );
}
