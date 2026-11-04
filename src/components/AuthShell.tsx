import { getI18n } from "@/lib/i18n/server";
import { Logo } from "./Logo";
import { PrefsSwitcher } from "./PrefsSwitcher";

export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]"
      />
      <div className="absolute top-4 right-4"><PrefsSwitcher /></div>
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Logo size="lg" />
          <p className="text-xs text-muted">{t("app.tagline")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/80 p-6 backdrop-blur">
          <h1 className="text-base font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/academic-faculty.webp" alt="" className="h-12 w-auto opacity-90" data-testid="faculty-logo" />
          <p className="text-[11px] text-subtle">{t("app.org")}</p>
        </div>
      </div>
    </main>
  );
}
