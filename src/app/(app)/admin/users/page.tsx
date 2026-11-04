import type { Prisma, Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ROLE_LABEL, formatDateTime } from "@/lib/format";
import { toggleUserActiveAction } from "../actions";
import { CreateUserForm, ImportUsersForm, ResetPasswordButton } from "./forms";

export const metadata = { title: "จัดการผู้ใช้" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const me = await requireRole("ADMIN");
  const { q = "", role = "" } = await searchParams;
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ username: { contains: q } }, { fullName: { contains: q, mode: "insensitive" } }] } : {}),
    ...(role in ROLE_LABEL ? { role: role as Role } : {}),
  };
  const users = await db.user.findMany({ where, orderBy: [{ role: "asc" }, { username: "asc" }], take: 500 });
  const now = new Date();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">จัดการผู้ใช้</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold">สร้างบัญชีทีละคน</h2>
          <CreateUserForm />
        </section>
        <section className="card">
          <h2 className="mb-4 font-semibold">นำเข้าจาก CSV (ทั้งชั้นปี)</h2>
          <ImportUsersForm />
        </section>
      </div>

      <section className="card overflow-x-auto">
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="ค้นหารหัสหรือชื่อ" className="input max-w-xs" />
          <select name="role" defaultValue={role} className="input w-auto">
            <option value="">ทุกบทบาท</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-secondary">ค้นหา</button>
        </form>
        <table className="table">
          <thead>
            <tr><th>รหัส</th><th>ชื่อ</th><th>บทบาท</th><th>อีเมล</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const status = !u.isActive
                ? { text: "ปิดใช้งาน", cls: "bg-slate-200 text-slate-700" }
                : u.lockedUntil && u.lockedUntil > now
                  ? { text: "ล็อกชั่วคราว", cls: "bg-red-100 text-red-800" }
                  : u.mustChangePassword
                    ? u.tempPasswordExpiresAt && u.tempPasswordExpiresAt < now
                      ? { text: "รหัสชั่วคราวหมดอายุ", cls: "bg-red-100 text-red-800" }
                      : { text: "รอตั้งรหัสผ่าน", cls: "bg-amber-100 text-amber-800" }
                    : { text: "ใช้งาน", cls: "bg-green-100 text-green-800" };
              return (
                <tr key={u.id}>
                  <td className="font-mono">{u.username}</td>
                  <td>{u.fullName}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td className="text-slate-500">{u.email ?? "—"}</td>
                  <td><span className={`rounded px-1.5 py-0.5 text-xs ${status.cls}`}>{status.text}</span></td>
                  <td className="text-xs text-slate-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <ResetPasswordButton userId={u.id} username={u.username} />
                      {u.id !== me.id && (
                        <form action={toggleUserActiveAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button className={u.isActive ? "btn-danger" : "btn-secondary"}>
                            {u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && <p className="py-6 text-center text-sm text-slate-500">ไม่พบผู้ใช้</p>}
      </section>
    </div>
  );
}
