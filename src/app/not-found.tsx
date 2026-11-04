import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-xs text-accent">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted">It doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="btn mt-2">Back to dashboard</Link>
    </main>
  );
}
