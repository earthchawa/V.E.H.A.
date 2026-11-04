import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { UpdateEmailForm } from "@/components/UpdateEmailForm";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/format";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Account" />
      <div className="space-y-6">
        <section className="card">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
            <dt className="text-muted">Name</dt><dd>{user.fullName}</dd>
            <dt className="text-muted">ID</dt><dd className="font-mono">{user.username}</dd>
            <dt className="text-muted">Role</dt><dd>{ROLE_LABEL[user.role]}</dd>
            <dt className="text-muted">Recovery email</dt><dd>{user.email ?? <span className="text-subtle">Not set</span>}</dd>
          </dl>
        </section>
        <section className="card">
          <h2 className="card-title">Change password</h2>
          <ChangePasswordForm />
        </section>
        <section className="card">
          <h2 className="card-title">Recovery email</h2>
          <p className="-mt-2 mb-4 text-xs text-muted">Used to send you a reset link if you forget your password.</p>
          <UpdateEmailForm currentEmail={user.email} />
        </section>
      </div>
    </div>
  );
}
