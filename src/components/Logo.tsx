import { brand } from "@/lib/brand";

/** Academic Faculty badge on a transparent background; the dark theme uses a variant with light lettering. */
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

export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={size === "lg" ? "h-16 w-auto" : "h-7 w-auto"} />
      <span className={`font-semibold tracking-tight ${size === "lg" ? "text-2xl" : "text-sm"}`}>{brand.name}</span>
    </span>
  );
}
