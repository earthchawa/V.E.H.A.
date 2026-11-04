import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { findValidResetToken } from "@/lib/auth/account";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "ตั้งรหัสผ่านใหม่" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const record = await findValidResetToken(token);
  if (!record) {
    return (
      <AuthShell title="ลิงก์ใช้ไม่ได้">
        <p className="text-sm text-slate-600">ลิงก์นี้ไม่ถูกต้อง ถูกใช้ไปแล้ว หรือหมดอายุแล้ว</p>
        <Link href="/forgot-password" className="btn mt-4 w-full">ขอลิงก์ใหม่</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" subtitle={`บัญชี ${record.user.username}`}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
