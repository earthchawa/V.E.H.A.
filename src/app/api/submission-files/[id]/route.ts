import { getCurrentUser } from "@/lib/auth/session";
import { offeringAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { openStoredFile } from "@/lib/storage";

/** Download a submitted file: the cadet who submitted it, or the course's instructors/admins. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const file = await db.submissionFile.findUnique({
    where: { id },
    include: { submission: { select: { studentId: true, assignment: { select: { offeringId: true } } } } },
  });
  if (!file) return new Response("Not found", { status: 404 });
  const own = file.submission.studentId === user.id;
  const manage = (await offeringAccess(user, file.submission.assignment.offeringId)) === "manage";
  if (!own && !manage) return new Response("Not found", { status: 404 });

  const { body, size } = await openStoredFile(file.storageKey);
  const ascii = file.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      ...(size != null ? { "Content-Length": String(size) } : {}),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
