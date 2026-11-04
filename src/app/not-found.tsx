import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">ไม่พบหน้านี้</h1>
      <p className="text-sm text-slate-500">หน้านี้ไม่มีอยู่ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
      <Link href="/" className="btn">กลับหน้าหลัก</Link>
    </main>
  );
}
