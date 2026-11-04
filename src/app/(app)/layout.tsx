import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { logoutAction } from "../auth-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const initials = user.fullName.replace(/^\S*\./, "").trim().slice(0, 1).toUpperCase() || user.username[0];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" aria-label="Dashboard"><Logo /></Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            <NavLink href="/">Courses</NavLink>
            {user.role === "ADMIN" && (
              <>
                <NavLink href="/admin/users">Users</NavLink>
                <NavLink href="/admin/courses">Terms &amp; courses</NavLink>
                <NavLink href="/admin/audit">Activity</NavLink>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/account" className="flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-surface-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-xs font-medium">{initials}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs">{user.fullName}</span>
                <span className="block text-[11px] text-subtle">{ROLE_LABEL[user.role]} · {user.username}</span>
              </span>
            </Link>
            <form action={logoutAction}>
              <button className="rounded-md px-2 py-1.5 text-xs text-muted transition hover:text-fg">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
