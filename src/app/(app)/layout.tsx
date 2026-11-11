import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { PrefsSwitcher } from "@/components/PrefsSwitcher";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { MobileMenu } from "@/components/MobileMenu";
import { BackButton } from "@/components/BackButton";
import { Toaster } from "@/components/Toaster";
import { UploadProvider } from "@/components/direct-upload";
import { config } from "@/lib/config";
import { userUploadPrefix } from "@/lib/storage";
import { logoutAction } from "../auth-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, role } = await getI18n();
  const links = [
    { href: "/", label: t("nav.courses") },
    ...(user.role === "ADMIN"
      ? [
          { href: "/admin/users", label: t("nav.users") },
          { href: "/admin/courses", label: t("nav.terms") },
          { href: "/admin/departments", label: t("nav.departments") },
          { href: "/admin/exam-settings", label: t("nav.examSettings") },
          { href: "/admin/audit", label: t("nav.activity") },
          { href: "/admin/system", label: t("nav.system") },
        ]
      : []),
  ];
  const initials = user.fullName.replace(/^\S*\./, "").trim().slice(0, 1).toUpperCase() || user.username[0];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="relative mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 xl:gap-6">
          <Link href="/" aria-label="Dashboard" className="shrink-0"><Logo /></Link>
          <nav className="hidden items-center gap-1 lg:flex" data-testid="desktop-nav">
            {links.map((l) => <NavLink key={l.href} href={l.href}>{l.label}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <PrefsSwitcher />
            <Link href="/account" title={`${user.fullName} · ${user.username}`} className="hidden items-center gap-2 rounded-md px-2 py-1 transition hover:bg-surface-3 lg:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-xs font-medium">{initials}</span>
              {/* Admins have six menu items, so their name only shows on very wide screens; never wraps. */}
              <span className={`hidden max-w-[14rem] whitespace-nowrap text-left leading-tight ${user.role === "ADMIN" ? "2xl:block" : "lg:block"}`}>
                <span className="block truncate text-xs">{user.fullName}</span>
                <span className="block text-[11px] text-subtle">{role(user.role)} · {user.username}</span>
              </span>
            </Link>
            <form action={logoutAction} className="hidden lg:block">
              <button className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs text-muted transition hover:text-fg">{t("nav.signOut")}</button>
            </form>
            <MobileMenu label={t("nav.menu")} closeLabel={t("nav.closeMenu")}>
              <Link href="/account" className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5" data-testid="menu-account">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-sm font-medium">{initials}</span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm">{user.fullName}</span>
                  <span className="block text-xs text-subtle">{role(user.role)} · {user.username}</span>
                </span>
              </Link>
              <nav className="grid gap-0.5">
                {links.map((l) => <NavLink key={l.href} href={l.href} block>{l.label}</NavLink>)}
              </nav>
              <form action={logoutAction} className="mt-2 border-t border-border pt-2">
                <button className="w-full rounded-md px-3 py-2.5 text-left text-sm text-muted transition hover:bg-surface-3 hover:text-fg">{t("nav.signOut")}</button>
              </form>
            </MobileMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <BackButton placement="shell" />
        <UploadProvider value={{ direct: config.directUpload, prefix: userUploadPrefix(user.id) }}>{children}</UploadProvider>
      </main>
      <Toaster />
    </div>
  );
}
