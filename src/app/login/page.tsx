import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { reset } = await searchParams;
  return (
    <AuthShell title="เข้าสู่ระบบ" subtitle="ใช้รหัสประจำตัวนักเรียน / อาจารย์">
      {reset && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          ตั้งรหัสผ่านใหม่เรียบร้อย เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย
        </p>
      )}
      <LoginForm />
      <div className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-brand-600 hover:underline">ลืมรหัสผ่าน?</Link>
      </div>
    </AuthShell>
  );
}
