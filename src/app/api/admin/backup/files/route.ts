import { getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { TAR_END, backupStamp as stamp, tarHeader, tarPadding } from "@/lib/backup";
import { db } from "@/lib/db";
import { openStoredFile } from "@/lib/storage";

export const maxDuration = 300;

/**
 * Every uploaded file (materials, submission files, department logos) as one tar archive, named by storage
 * key under files/, plus manifest.json mapping keys to their original names. Files are streamed one by one.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || user.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const [materials, submissionFiles, logos] = await Promise.all([
    db.material.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true, fileName: true } }),
    db.submissionFile.findMany({ select: { storageKey: true, fileName: true } }),
    db.department.findMany({ where: { logoKey: { not: null } }, select: { logoKey: true, code: true } }),
  ]);
  const entries = [
    ...materials.map((m) => ({ key: m.storageKey!, name: m.fileName ?? "", kind: "material" })),
    ...submissionFiles.map((f) => ({ key: f.storageKey, name: f.fileName, kind: "submission" })),
    ...logos.map((d) => ({ key: d.logoKey!, name: `logo-${d.code}`, kind: "logo" })),
  ];
  await audit({ actorId: user.id, action: "backup.downloaded", details: { kind: "files", files: entries.length } });

  async function* tar(): AsyncGenerator<Uint8Array> {
    const manifest = Buffer.from(JSON.stringify({ format: "veha-files", version: 1, createdAt: new Date().toISOString(), files: entries }, null, 1));
    yield tarHeader("manifest.json", manifest.length);
    yield new Uint8Array(manifest);
    yield tarPadding(manifest.length);
    const missing: string[] = [];
    for (const e of entries) {
      let file: Awaited<ReturnType<typeof openStoredFile>>;
      try {
        file = await openStoredFile(e.key);
      } catch {
        missing.push(e.key);
        continue;
      }
      // tar needs the exact size before the data; a stream without one is read into memory first.
      let body = file.body;
      let size = file.size;
      if (size == null && !(body instanceof Uint8Array)) {
        body = new Uint8Array(await new Response(body).arrayBuffer());
        size = body.length;
      }
      yield tarHeader(`files/${e.key}`, size!);
      if (body instanceof Uint8Array) yield body;
      else for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) yield chunk;
      yield tarPadding(size!);
    }
    if (missing.length) {
      const note = Buffer.from(missing.join("\n") + "\n");
      yield tarHeader("missing.txt", note.length);
      yield new Uint8Array(note);
      yield tarPadding(note.length);
    }
    yield TAR_END;
  }
  const it = tar();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await it.next();
      if (done) controller.close();
      else if (value.length) controller.enqueue(value);
    },
    cancel: () => void it.return(undefined),
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-tar",
      "Content-Disposition": `attachment; filename="veha-files-${stamp()}.tar"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
