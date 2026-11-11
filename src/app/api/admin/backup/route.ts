import { getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { backupStamp as stamp, backupStream } from "@/lib/backup";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";

export const maxDuration = 300;

/**
 * Database backup for admins (gzipped NDJSON, restored with scripts/restore-backup.ts).
 * `?files=1` also includes file bytes kept in Postgres (the "db" storage driver).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || user.role !== "ADMIN") return new Response("Not found", { status: 404 });
  const includeDbFiles = new URL(req.url).searchParams.get("files") === "1";
  await audit({ actorId: user.id, action: "backup.downloaded", details: { kind: "database", includeDbFiles } });
  return new Response(backupStream(db, { includeDbFiles, app: brand.name }), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="veha-backup-${stamp()}.ndjson.gz"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
