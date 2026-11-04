import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "ลืมรหัสผ่าน" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="ลืมรหัสผ่าน" subtitle="ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลที่ลงทะเบียนไว้">
      <ForgotPasswordForm />
      <div className="mt-4 text-center text-sm">
        <Link href="/login" className="text-brand-600 hover:underline">กลับไปหน้าเข้าสู่ระบบ</Link>
      </div>
    </AuthShell>
  );
}
