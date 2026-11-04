import type { Prisma, Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/PageHeader";
import { toggleUserActiveAction } from "../actions";
import { CreateUserForm, ImportUsersForm, ResetPasswordButton } from "./forms";

export async function generateMetadata() {
  return { title: (await getI18n()).t("users.title") };
}

const ROLES = ["ADMIN", "INSTRUCTOR", "STUDENT"] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const me = await requireRole("ADMIN");
  const { q = "", role = "" } = await searchParams;
  const { t, date, role: roleLabel } = await getI18n();
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ username: { contains: q } }, { fullName: { contains: q, mode: "insensitive" } }] } : {}),
    ...((ROLES as readonly string[]).includes(role) ? { role: role as Role } : {}),
  };
  const users = await db.user.findMany({ where, orderBy: [{ role: "asc" }, { username: "asc" }], take: 500 });
  const now = new Date();

  return (
    <div>
      <PageHeader title={t("users.title")} description={t("users.desc")} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card"><h2 className="card-title">{t("users.new")}</h2><CreateUserForm /></section>
        <section className="card"><h2 className="card-title">{t("users.import")}</h2><ImportUsersForm /></section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <form className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <input name="q" defaultValue={q} placeholder={t("users.search")} className="input h-9 max-w-xs" />
          <select name="role" defaultValue={role} className="input h-9 w-auto py-0" aria-label={t("account.role")}>
            <option value="">{t("users.allRoles")}</option>
            {ROLES.map((k) => <option key={k} value={k}>{roleLabel(k)}</option>)}
          </select>
          <button className="btn-secondary h-9">{t("users.searchBtn")}</button>
          <span className="ml-auto pr-1 text-xs text-subtle">{t("users.count", { n: users.length })}</span>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>{t("login.id")}</th><th>{t("users.fullName")}</th><th>{t("account.role")}</th><th>{t("users.email")}</th><th>{t("users.status")}</th><th>{t("users.lastSignIn")}</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const status = !u.isActive
                  ? { text: t("status.disabled"), cls: "bg-surface-3 text-muted" }
                  : u.lockedUntil && u.lockedUntil > now
                    ? { text: t("status.locked"), cls: "bg-red-500/10 text-danger" }
                    : u.mustChangePassword
                      ? u.tempPasswordExpiresAt && u.tempPasswordExpiresAt < now
                        ? { text: t("status.tempExpired"), cls: "bg-red-500/10 text-danger" }
                        : { text: t("status.pending"), cls: "bg-amber-500/10 text-warning" }
                      : { text: t("status.active"), cls: "bg-emerald-500/10 text-success" };
                return (
                  <tr key={u.id}>
                    <td className="font-mono text-xs">{u.username}</td>
                    <td>{u.fullName}</td>
                    <td className="text-muted">{roleLabel(u.role)}</td>
                    <td className="text-muted">{u.email ?? <span className="text-subtle">—</span>}</td>
                    <td><span className={`badge ${status.cls}`}>{status.text}</span></td>
                    <td className="whitespace-nowrap text-xs text-subtle">{u.lastLoginAt ? date(u.lastLoginAt) : "—"}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <ResetPasswordButton userId={u.id} username={u.username} />
                        {u.id !== me.id && (
                          <form action={toggleUserActiveAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button className={u.isActive ? "btn-danger" : "btn-secondary"}>
                              {t(u.isActive ? "users.disable" : "users.enable")}
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
        {users.length === 0 && <p className="py-10 text-center text-sm text-muted">{t("users.none")}</p>}
      </section>
    </div>
  );
}
