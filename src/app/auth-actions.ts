"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/form";
import {
  authenticate,
  changeOwnPassword,
  updateOwnEmail,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/auth/account";
import {
  createSession,
  destroyCurrentSession,
  destroyUserSessions,
  requireUser,
} from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const { tm } = await getI18n();
  const result = await authenticate(str(fd, "username"), str(fd, "password"));
  if (!result.ok) return { error: tm(result.error) };
  await createSession(result.userId);
  redirect(result.mustChangePassword ? "/change-password" : "/");
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t, tm } = await getI18n();
  const user = await requireUser({ allowMustChange: true });
  const newPassword = str(fd, "newPassword");
  if (newPassword !== str(fd, "confirmPassword")) return { error: t("err.mismatch") };

  let email: string | null | undefined;
  if (fd.has("email")) {
    const raw = str(fd, "email").trim().toLowerCase();
    if (raw && !z.email().safeParse(raw).success) return { error: t("err.emailInvalid") };
    email = raw || null;
  }

  const error = await changeOwnPassword(user.id, str(fd, "currentPassword"), newPassword, email);
  if (error) return { error: tm(error) };
  // Sign out other devices; keep this one.
  await destroyUserSessions(user.id, true);
  if (user.mustChangePassword) redirect("/");
  return { success: t("ok.passwordChanged") };
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t, lang } = await getI18n();
  await requestPasswordReset(str(fd, "username"), lang);
  return { success: t("forgot.sent") };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t, tm } = await getI18n();
  const newPassword = str(fd, "newPassword");
  if (newPassword !== str(fd, "confirmPassword")) return { error: t("err.mismatch") };
  const error = await resetPasswordWithToken(str(fd, "token"), newPassword);
  if (error) return { error: tm(error) };
  redirect("/login?reset=1");
}

export async function updateEmailAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t, tm } = await getI18n();
  const user = await requireUser();
  const raw = str(fd, "email").trim().toLowerCase();
  if (raw && !z.email().safeParse(raw).success) return { error: t("err.emailInvalid") };
  const error = await updateOwnEmail(user.id, str(fd, "currentPassword"), raw || null);
  if (error) return { error: tm(error) };
  return { success: t(raw ? "ok.emailSaved" : "ok.emailRemoved") };
}
