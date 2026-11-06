import { brand } from "@/lib/brand";

/** Full Academic Faculty badge on a transparent background; the dark theme uses a variant with light lettering. */
export function LogoMark({ className = "h-7 w-auto" }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logo} alt="" className={`${className} object-contain dark:hidden`} data-variant="light" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logoDark} alt="" className={`${className} hidden object-contain dark:block`} data-variant="dark" />
    </>
  );
}

/**
 * Header lockup: the "AF" emblem, then V.E.H.A. with what it stands for underneath (from sm up).
 * The full badge is too detailed to read at header size, so it is kept for the sign-in page.
 */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  if (size === "lg") {
    return (
      <span className="inline-flex flex-col items-center gap-2">
        <LogoMark className="h-16 w-auto" />
        <span className="text-2xl font-semibold tracking-[0.12em]">{brand.name}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2.5" data-testid="app-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.mark} alt="" className="h-7 w-auto shrink-0 object-contain" />
      <span className="flex flex-col justify-center border-l border-border pl-2.5 leading-none">
        <span className="text-[15px] font-semibold tracking-[0.14em]">{brand.name}</span>
        {/* Hidden at lg, where the full admin menu needs the room; shown again from xl. */}
        <span className="mt-1 hidden text-[10px] tracking-wide text-subtle sm:block lg:hidden xl:block">{brand.fullName}</span>
      </span>
    </span>
  );
}
