import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset password" subtitle="We'll email a reset link to the address on your account.">
      <ForgotPasswordForm />
      <div className="mt-5 text-center text-sm">
        <Link href="/login" className="text-muted transition hover:text-fg">← Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
