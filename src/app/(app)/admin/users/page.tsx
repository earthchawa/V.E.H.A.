import type { Prisma, Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ROLE_LABEL, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { toggleUserActiveAction } from "../actions";
import { CreateUserForm, ImportUsersForm, ResetPasswordButton } from "./forms";

export const metadata = { title: "Users" };

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
    <div>
      <PageHeader title="Users" description="Create accounts, import a cohort, and reset passwords." />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="card-title">New account</h2><CreateUserForm /></section>
        <section className="card"><h2 className="card-title">Import from CSV</h2><ImportUsersForm /></section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <form className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <input name="q" defaultValue={q} placeholder="Search ID or name" className="input h-9 max-w-xs" />
          <select name="role" defaultValue={role} className="input h-9 w-auto py-0" aria-label="Role">
            <option value="">All roles</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-secondary h-9">Search</button>
          <span className="ml-auto pr-1 text-xs text-subtle">{users.length} users</span>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th>Last sign-in</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const status = !u.isActive
                  ? { text: "Disabled", cls: "bg-surface-3 text-muted" }
                  : u.lockedUntil && u.lockedUntil > now
                    ? { text: "Locked", cls: "bg-red-500/10 text-red-300" }
                    : u.mustChangePassword
                      ? u.tempPasswordExpiresAt && u.tempPasswordExpiresAt < now
                        ? { text: "Temp expired", cls: "bg-red-500/10 text-red-300" }
                        : { text: "Pending setup", cls: "bg-amber-500/10 text-amber-300" }
                      : { text: "Active", cls: "bg-emerald-500/10 text-emerald-300" };
                return (
                  <tr key={u.id}>
                    <td className="font-mono text-xs">{u.username}</td>
                    <td>{u.fullName}</td>
                    <td className="text-muted">{ROLE_LABEL[u.role]}</td>
                    <td className="text-muted">{u.email ?? <span className="text-subtle">—</span>}</td>
                    <td><span className={`badge ${status.cls}`}>{status.text}</span></td>
                    <td className="whitespace-nowrap text-xs text-subtle">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <ResetPasswordButton userId={u.id} username={u.username} />
                        {u.id !== me.id && (
                          <form action={toggleUserActiveAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button className={u.isActive ? "btn-danger" : "btn-secondary"}>
                              {u.isActive ? "Disable" : "Enable"}
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
        </div>
        {users.length === 0 && <p className="py-10 text-center text-sm text-muted">No users found.</p>}
      </section>
    </div>
  );
}
