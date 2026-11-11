import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import type { PrismaClient } from "@prisma/client";

/**
 * Database backup: a gzipped NDJSON file. The first line is a header; every other line is
 * `{ "t": "<table>", "rows": [...] }` with rows exactly as PostgreSQL's row_to_json gives them, so
 * `scripts/restore-backup.ts` can put them back with jsonb_populate_recordset — no per-model code, and new
 * tables are picked up automatically.
 *
 * Left out: sign-in sessions and password-reset tokens (useless after a restore, and sensitive) and Prisma's
 * migration table (the restore runs the migrations itself). Password hashes ARE included (bcrypt) — a
 * restore needs them — so the file must be kept as carefully as the database.
 */
export const BACKUP_FORMAT = "veha-backup";
export const BACKUP_VERSION = 1;
/** Bangkok date-time for file names, e.g. 20261111-0930. */
export const backupStamp = () => new Date(Date.now() + 7 * 3600_000).toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
const SKIP = new Set(["_prisma_migrations", "Session", "PasswordResetToken"]);
/** File bytes kept in Postgres (the "db" storage driver): big, so only with `includeDbFiles`. */
const FILE_TABLE = "StoredFile";
const PAGE = 500;

type Db = Pick<PrismaClient, "$queryRawUnsafe">;
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function backupTables(db: Db, includeDbFiles: boolean): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ tablename: string }[]>(
    `select tablename from pg_tables where schemaname = current_schema() order by tablename`,
  );
  return rows.map((r) => r.tablename).filter((t) => !SKIP.has(t) && (includeDbFiles || t !== FILE_TABLE));
}

async function currentSchema(db: Db): Promise<string> {
  return ident((await db.$queryRawUnsafe<{ s: string }[]>(`select current_schema() as s`))[0].s);
}

export async function lastMigration(db: Db): Promise<string | null> {
  const rows = await db.$queryRawUnsafe<{ migration_name: string }[]>(
    `select migration_name from "_prisma_migrations" where finished_at is not null order by finished_at desc, migration_name desc limit 1`,
  );
  return rows[0]?.migration_name ?? null;
}

/** NDJSON lines of the backup, table by table and page by page (never the whole database in memory). */
export async function* backupLines(db: Db, opts: { includeDbFiles: boolean; app: string }): AsyncGenerator<string> {
  const tables = await backupTables(db, opts.includeDbFiles);
  yield JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: opts.app,
    createdAt: new Date().toISOString(),
    migration: await lastMigration(db),
    tables,
    includesDbFiles: opts.includeDbFiles,
  }) + "\n";
  for (const table of tables) {
    // File bytes: one row per line keeps lines small enough to parse.
    const page = table === FILE_TABLE ? 1 : PAGE;
    // Page by primary key so every row comes out exactly once (every table has one).
    const pk = await db.$queryRawUnsafe<{ attname: string }[]>(
      `select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = ($1 || '.' || $2)::regclass and i.indisprimary order by array_position(i.indkey, a.attnum)`,
      await currentSchema(db),
      ident(table),
    );
    const orderBy = pk.length ? pk.map((c) => `t.${ident(c.attname)}`).join(", ") : "t.ctid";
    for (let offset = 0; ; offset += page) {
      const rows = await db.$queryRawUnsafe<{ r: unknown }[]>(
        `select row_to_json(t) as r from ${ident(table)} t order by ${orderBy} limit ${page} offset ${offset}`,
      );
      if (rows.length) yield JSON.stringify({ t: table, rows: rows.map((x) => x.r) }) + "\n";
      if (rows.length < page) break;
    }
  }
}

/** The backup as a gzip web stream, for a download response. */
export function backupStream(db: Db, opts: { includeDbFiles: boolean; app: string }): ReadableStream<Uint8Array> {
  const gz = Readable.from(backupLines(db, opts)).pipe(createGzip({ level: 6 }));
  return Readable.toWeb(gz) as unknown as ReadableStream<Uint8Array>;
}

/** Order tables so that a table comes after the tables its foreign keys point to. */
export function restoreOrder(tables: string[], deps: { child: string; parent: string }[]): string[] {
  const left = new Set(tables);
  const out: string[] = [];
  while (left.size) {
    const ready = [...left].filter((t) => !deps.some((d) => d.child === t && d.parent !== t && left.has(d.parent))).sort();
    if (!ready.length) throw new Error(`circular foreign keys between: ${[...left].join(", ")}`);
    for (const t of ready) {
      out.push(t);
      left.delete(t);
    }
  }
  return out;
}

// ---------- tar (for the uploaded-files archive) ----------

/** One ustar header block for a regular file. Names are storage keys (ASCII, < 100 chars). */
export function tarHeader(name: string, size: number, mtime = Math.floor(Date.now() / 1000)): Uint8Array {
  if (Buffer.byteLength(name) > 100) throw new Error("tar name too long");
  const b = Buffer.alloc(512);
  b.write(name, 0);
  b.write("0000644\0", 100);
  b.write("0000000\0", 108);
  b.write("0000000\0", 116);
  b.write(size.toString(8).padStart(11, "0") + "\0", 124);
  b.write(mtime.toString(8).padStart(11, "0") + "\0", 136);
  b.write("        ", 148); // checksum placeholder
  b.write("0", 156);
  b.write("ustar\0" + "00", 257);
  let sum = 0;
  for (const x of b) sum += x;
  b.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return new Uint8Array(b);
}
export const tarPadding = (size: number) => new Uint8Array((512 - (size % 512)) % 512);
export const TAR_END = new Uint8Array(1024);
