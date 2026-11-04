import { brand } from "@/lib/brand";

/** Academic Faculty badge. */
export function LogoMark({ className = "h-7 w-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={brand.logo} alt="" className={`${className} object-contain`} />;
}

export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="rounded-md dark:bg-white/90 dark:p-0.5">
        <LogoMark className={size === "lg" ? "h-16 w-auto" : "h-7 w-auto"} />
      </span>
      <span className={`font-semibold tracking-tight ${size === "lg" ? "text-2xl" : "text-sm"}`}>{brand.name}</span>
    </span>
  );
}
