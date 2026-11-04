import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { reset } = await searchParams;
  return (
    <AuthShell title="Sign in" subtitle="Use your cadet or staff ID">
      {reset && (
        <p className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Password updated. Sign in with your new password.
        </p>
      )}
      <LoginForm />
      <div className="mt-5 text-center text-sm">
        <Link href="/forgot-password" className="text-muted transition hover:text-fg">Forgot password?</Link>
      </div>
    </AuthShell>
  );
}
