import { brand } from "@/lib/brand";
import { Logo } from "./Logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Logo size="lg" />
          <p className="text-xs text-muted">{brand.tagline}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface/80 p-6 backdrop-blur">
          <h1 className="text-base font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-8 text-center text-[11px] text-subtle">{brand.org}</p>
      </div>
    </main>
  );
}
