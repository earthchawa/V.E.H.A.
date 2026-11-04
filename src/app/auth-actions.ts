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

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const result = await authenticate(str(fd, "username"), str(fd, "password"));
  if (!result.ok) return { error: result.error };
  await createSession(result.userId);
  redirect(result.mustChangePassword ? "/change-password" : "/");
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser({ allowMustChange: true });
  const newPassword = str(fd, "newPassword");
  if (newPassword !== str(fd, "confirmPassword")) return { error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" };

  let email: string | null | undefined;
  if (fd.has("email")) {
    const raw = str(fd, "email").trim().toLowerCase();
    if (raw && !z.email().safeParse(raw).success) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
    email = raw || null;
  }

  const error = await changeOwnPassword(user.id, str(fd, "currentPassword"), newPassword, email);
  if (error) return { error };
  // Sign out other devices; keep this one.
  await destroyUserSessions(user.id, true);
  if (user.mustChangePassword) redirect("/");
  return { success: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว อุปกรณ์อื่นที่เคยเข้าสู่ระบบจะถูกออกจากระบบ" };
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  await requestPasswordReset(str(fd, "username"));
  return {
    success:
      "หากรหัสประจำตัวนี้มีอีเมลลงทะเบียนไว้ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว (ใช้ได้ 30 นาที) " +
      "หากไม่ได้รับอีเมล กรุณาติดต่ออาจารย์ประจำวิชาหรือผู้ดูแลระบบ",
  };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const newPassword = str(fd, "newPassword");
  if (newPassword !== str(fd, "confirmPassword")) return { error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" };
  const error = await resetPasswordWithToken(str(fd, "token"), newPassword);
  if (error) return { error };
  redirect("/login?reset=1");
}

export async function updateEmailAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = str(fd, "email").trim().toLowerCase();
  if (raw && !z.email().safeParse(raw).success) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
  const error = await updateOwnEmail(user.id, str(fd, "currentPassword"), raw || null);
  if (error) return { error };
  return { success: raw ? "บันทึกอีเมลแล้ว" : "ลบอีเมลแล้ว" };
}
