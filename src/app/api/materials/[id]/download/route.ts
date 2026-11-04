import { getCurrentUser } from "@/lib/auth/session";
import { offeringAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const material = await db.material.findUnique({ where: { id } });
  if (!material || material.type !== "FILE" || !material.storageKey) return new Response("Not found", { status: 404 });

  const access = await offeringAccess(user, material.offeringId);
  if (!access || (access === "view" && !material.isPublished)) return new Response("Not found", { status: 404 });

  const body = await readStoredFile(material.storageKey);
  const name = material.fileName ?? "download";
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": material.mimeType ?? "application/octet-stream",
      "Content-Length": String(body.length),
      // Thai file names need the RFC 5987 form.
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
