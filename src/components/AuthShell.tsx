import { brand } from "@/lib/brand";
import { getI18n } from "@/lib/i18n/server";
import { LogoMark } from "./Logo";
import { PrefsSwitcher } from "./PrefsSwitcher";
import { LoginScene } from "./LoginScene";
import { TiltCard } from "./TiltCard";

export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Sky gradient + glow; the 3D scene draws on top of it. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]"
      />
      <LoginScene />
      <div className="absolute top-4 right-4 z-10"><PrefsSwitcher /></div>
      <div className="relative z-10 w-full max-w-sm">
        <div className="fade-up mb-8 flex flex-col items-center gap-3 text-center">
          <span className="float-slow block" data-testid="faculty-logo">
            <LogoMark className="h-20 w-auto drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)] dark:drop-shadow-[0_0_28px_rgba(91,140,255,0.35)]" />
          </span>
          <div>
            <div className="bg-gradient-to-r from-fg via-accent to-fg bg-clip-text text-3xl font-semibold tracking-[0.12em] text-transparent" data-testid="brand-name">
              {brand.name}
            </div>
            <p className="mt-1 text-xs font-medium tracking-wide text-muted" data-testid="brand-full-name">{brand.fullName}</p>
            <p className="mt-0.5 text-[11px] text-subtle">{t("app.tagline")}</p>
          </div>
        </div>
        <TiltCard className="fade-up rounded-2xl border border-border bg-surface/75 p-6 shadow-2xl backdrop-blur-md [animation-delay:120ms]">
          <h1 className="text-base font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="relative z-10 mt-6">{children}</div>
        </TiltCard>
        <p className="fade-up mt-8 text-center text-[11px] text-subtle [animation-delay:240ms]">{t("app.org")}</p>
      </div>
    </main>
  );
}
