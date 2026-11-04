import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/format";
import { logoutAction } from "../auth-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">
            <span className="text-xs tracking-widest text-brand-100">NKRAFA</span> AI Classroom
          </Link>
          <nav className="flex gap-4 text-sm text-brand-100">
            <Link href="/" className="hover:text-white">วิชาของฉัน</Link>
            {user.role === "ADMIN" && (
              <>
                <Link href="/admin/users" className="hover:text-white">ผู้ใช้</Link>
                <Link href="/admin/courses" className="hover:text-white">ภาคเรียน & วิชา</Link>
                <Link href="/admin/audit" className="hover:text-white">ประวัติการใช้งาน</Link>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/account" className="text-brand-100 hover:text-white">
              {user.fullName} <span className="opacity-70">({ROLE_LABEL[user.role]})</span>
            </Link>
            <form action={logoutAction}>
              <button className="rounded border border-white/30 px-2 py-1 text-xs hover:bg-white/10">ออกจากระบบ</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
