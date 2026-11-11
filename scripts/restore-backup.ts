/**
 * Restore a database backup downloaded from Admin → System (veha-backup-….ndjson.gz).
 *
 *   npx prisma migrate deploy                       # an empty database with the current tables
 *   npx tsx scripts/restore-backup.ts <file>        # into a new database (no accounts yet)
 *   npx tsx scripts/restore-backup.ts <file> --wipe # replace everything in a database that is in use
 *
 * Uploaded files are a separate archive (veha-files-….tar); add `--files <archive.tar>` to put them back
 * into the storage configured for this environment (disk, Blob or database).
 * Sign-in sessions are not part of a backup: everyone signs in again afterwards.
 */
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { BACKUP_FORMAT, BACKUP_VERSION, backupTables, lastMigration, restoreOrder } from "../src/lib/backup";
import { config } from "../src/lib/config";
import { isBlobKey } from "../src/lib/storage";

const db = new PrismaClient();
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function restoreDatabase(file: string, wipe: boolean) {
  const lines = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  const it = lines[Symbol.asyncIterator]();
  const head = JSON.parse((await it.next()).value ?? "{}");
  if (head.format !== BACKUP_FORMAT || head.version !== BACKUP_VERSION) throw new Error("not a V.E.H.A. backup file (or a newer format)");
  const here = await lastMigration(db);
  if (head.migration !== here)
    throw new Error(`the backup was made at migration ${head.migration}, this database is at ${here}. Check out the matching version, restore, then upgrade.`);

  const existing = await backupTables(db, true);
  const tables: string[] = head.tables.filter((t: string) => existing.includes(t));
  // A database straight from `migrate deploy` is not empty (migrations seed the course catalogue), so "fresh"
  // means: nobody has an account yet. Anything else is only replaced with --wipe.
  const users = Number((await db.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) as n from "User"`))[0].n);
  if (users > 0 && !wipe) throw new Error(`this database already has ${users} accounts. Restore into a new database, or pass --wipe to replace everything in this one.`);

  const deps = await db.$queryRawUnsafe<{ child: string; parent: string }[]>(
    `select c.relname as child, p.relname as parent from pg_constraint k
       join pg_class c on c.oid = k.conrelid join pg_class p on p.oid = k.confrelid
       join pg_namespace n on n.oid = c.relnamespace
      where k.contype = 'f' and n.nspname = current_schema()`,
  );
  const order = restoreOrder(tables, deps);

  // The file is grouped by table in alphabetical order; rows must go in in foreign-key order, so collect
  // per table first. (File bytes stay on disk in the backup until their turn would need a second pass —
  // databases here are small enough to hold in memory.)
  const rows = new Map<string, unknown[]>();
  for (;;) {
    const { value, done } = await it.next();
    if (done) break;
    if (!value.trim()) continue;
    const chunk = JSON.parse(value) as { t: string; rows: unknown[] };
    rows.set(chunk.t, [...(rows.get(chunk.t) ?? []), ...chunk.rows]);
  }

  await db.$transaction(
    async (tx) => {
      // Always start from empty tables (on a fresh database this only clears what the migrations seeded).
      await tx.$executeRawUnsafe(`truncate ${existing.map(ident).join(", ")}, "Session", "PasswordResetToken" cascade`);
      for (const t of order) {
        const all = rows.get(t) ?? [];
        const selfRef = deps.some((d) => d.child === t && d.parent === t);
        // A table that points at itself (departments) goes in as one statement, so parents and children
        // may come in any order; others in pages.
        const size = selfRef ? all.length || 1 : 500;
        for (let i = 0; i < all.length; i += size) {
          await tx.$executeRawUnsafe(
            `insert into ${ident(t)} select * from jsonb_populate_recordset(null::${ident(t)}, $1::jsonb)`,
            JSON.stringify(all.slice(i, i + size)),
          );
        }
        console.log(`  ${t}: ${all.length}`);
      }
    },
    { timeout: 600_000, maxWait: 30_000 },
  );
  console.log(`Database restored from ${path.basename(file)} (made ${head.createdAt}).`);
}

/** Put the files of a veha-files tar back under their keys, in whichever store each key belongs to. */
async function restoreFiles(archive: string) {
  const data = await readFile(archive);
  let n = 0;
  for (let off = 0; off + 512 <= data.length; ) {
    const name = data.toString("utf8", off, off + 100).replace(/\0.*$/, "");
    if (!name) break;
    const size = parseInt(data.toString("ascii", off + 124, off + 135), 8);
    const body = data.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (!name.startsWith("files/")) continue;
    const key = name.slice("files/".length);
    if (isBlobKey(key)) await put(key, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream" });
    else if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error(`unexpected file name in the archive: ${name}`);
    else if (config.legacyDriver === "db") {
      await db.storedFile.upsert({ where: { key }, create: { key, data: new Uint8Array(body), sizeBytes: size }, update: { data: new Uint8Array(body), sizeBytes: size } });
    } else {
      const target = path.join(path.resolve(config.uploadDir), key.slice(0, 2), key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
    }
    n++;
  }
  console.log(`Files restored: ${n}`);
}

async function main() {
  const args = process.argv.slice(2);
  const filesAt = args.indexOf("--files");
  const archive = filesAt >= 0 ? args[filesAt + 1] : null;
  const file = args.find((a, i) => !a.startsWith("--") && !(filesAt >= 0 && i === filesAt + 1));
  if (!file && !archive) {
    console.error("usage: npx tsx scripts/restore-backup.ts <veha-backup-….ndjson.gz> [--wipe] [--files <veha-files-….tar>]");
    process.exit(2);
  }
  if (file) await restoreDatabase(file, args.includes("--wipe"));
  if (archive) await restoreFiles(archive);
}

main()
  .catch((e) => {
    console.error("Restore failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
