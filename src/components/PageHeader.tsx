import { InfoTip } from "./InfoTip";

export function PageHeader({
  eyebrow,
  title,
  description,
  help,
  actions,
}: {
  /** Explanation shown in an ⓘ next to the title instead of a paragraph. */
  help?: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 font-mono text-xs text-accent">{eyebrow}</div>}
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {title}
          {help && <InfoTip text={help} align="start" />}
        </h1>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      {actions}
    </div>
  );
}
