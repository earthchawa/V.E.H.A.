import { brand } from "@/lib/brand";

/** Swept-wing mark + wordmark. */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M16 7 L25 23 L16 19.5 L7 23 Z" fill="white" />
    </svg>
  );
}

export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={size === "lg" ? "h-9 w-9" : "h-6 w-6"} />
      <span className={`font-semibold tracking-tight ${size === "lg" ? "text-xl" : "text-sm"}`}>{brand.name}</span>
    </span>
  );
}
