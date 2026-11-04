import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { UpdateEmailForm } from "@/components/UpdateEmailForm";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/format";

export const metadata = { title: "บัญชีของฉัน" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-semibold">บัญชีของฉัน</h1>
      <div className="card text-sm">
        <dl className="grid grid-cols-3 gap-y-2">
          <dt className="text-slate-500">ชื่อ</dt><dd className="col-span-2">{user.fullName}</dd>
          <dt className="text-slate-500">รหัสประจำตัว</dt><dd className="col-span-2">{user.username}</dd>
          <dt className="text-slate-500">บทบาท</dt><dd className="col-span-2">{ROLE_LABEL[user.role]}</dd>
          <dt className="text-slate-500">อีเมล</dt><dd className="col-span-2">{user.email ?? "— (ยังไม่ได้ลงทะเบียน)"}</dd>
        </dl>
      </div>
      <div className="card">
        <h2 className="mb-4 font-semibold">เปลี่ยนรหัสผ่าน</h2>
        <ChangePasswordForm />
      </div>
      <div className="card">
        <h2 className="mb-1 font-semibold">อีเมลสำหรับกู้รหัสผ่าน</h2>
        <p className="mb-4 text-xs text-slate-500">ใช้รับลิงก์ตั้งรหัสผ่านใหม่เมื่อลืมรหัสผ่าน</p>
        <UpdateEmailForm currentEmail={user.email} />
      </div>
    </div>
  );
}
