import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Uploaded division/department logo. Logos aren't sensitive; cached because the URL changes on upload. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await db.department.findUnique({ where: { id }, select: { logoKey: true, logoMime: true } });
  if (!d?.logoKey || !d.logoMime || !ALLOWED.has(d.logoMime)) return new Response("Not found", { status: 404 });
  const body = await readStoredFile(d.logoKey);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": d.logoMime,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
