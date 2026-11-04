import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { findValidResetToken } from "@/lib/auth/account";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const record = await findValidResetToken(token);
  if (!record) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is invalid, already used, or has expired.">
        <Link href="/forgot-password" className="btn w-full">Request a new link</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle={`Account ${record.user.username}`}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
