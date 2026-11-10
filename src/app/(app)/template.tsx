/** Remounts on navigation, so each page eases in (see .page-in in globals.css; off with reduced motion). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
