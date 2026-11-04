import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { UpdateEmailForm } from "@/components/UpdateEmailForm";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t("account.title") };
}

export default async function AccountPage() {
  const user = await requireUser();
  const { t, role } = await getI18n();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("account.title")} />
      <div className="space-y-6">
        <section className="card">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
            <dt className="text-muted">{t("account.name")}</dt><dd>{user.fullName}</dd>
            <dt className="text-muted">{t("account.id")}</dt><dd className="font-mono">{user.username}</dd>
            <dt className="text-muted">{t("account.role")}</dt><dd>{role(user.role)}</dd>
            <dt className="text-muted">{t("account.email")}</dt><dd>{user.email ?? <span className="text-subtle">{t("account.notSet")}</span>}</dd>
          </dl>
        </section>
        <section className="card">
          <h2 className="card-title">{t("account.changePw")}</h2>
          <ChangePasswordForm />
        </section>
        <section className="card">
          <h2 className="card-title">{t("account.email")}</h2>
          <p className="-mt-2 mb-4 text-xs text-muted">{t("account.emailHint")}</p>
          <UpdateEmailForm currentEmail={user.email} />
        </section>
      </div>
    </div>
  );
}
