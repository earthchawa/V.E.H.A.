/**
 * Find the Postgres connection string even when a hosting integration names it differently.
 * Vercel's Neon/Postgres integrations may use DATABASE_URL, POSTGRES_URL / POSTGRES_PRISMA_URL,
 * or the same names behind a custom prefix (e.g. STORAGE_DATABASE_URL).
 */
const POOLED = [
  /^DATABASE_URL$/,
  /^POSTGRES_PRISMA_URL$/,
  /^POSTGRES_URL$/,
  /^NEON_DATABASE_URL$/,
  /^[A-Z0-9_]+_DATABASE_URL$/,
  /^[A-Z0-9_]+_POSTGRES_PRISMA_URL$/,
  /^[A-Z0-9_]+_POSTGRES_URL$/,
];
const DIRECT = [
  /^DATABASE_URL_UNPOOLED$/,
  /^POSTGRES_URL_NON_POOLING$/,
  /^DIRECT_URL$/,
  /^[A-Z0-9_]+_DATABASE_URL_UNPOOLED$/,
  /^[A-Z0-9_]+_URL_NON_POOLING$/,
];

type Env = Record<string, string | undefined>;
const isPg = (v: string | undefined): v is string => !!v && /^postgres(ql)?:\/\//.test(v);

function pick(env: Env, patterns: RegExp[]): [string, string] | undefined {
  const keys = Object.keys(env).sort();
  for (const re of patterns) {
    const key = keys.find((k) => re.test(k) && isPg(env[k]));
    if (key) return [key, env[key]!];
  }
}

export function resolveDatabaseEnv(env: Env = process.env) {
  const url = pick(env, POOLED);
  const direct = pick(env, DIRECT);
  return {
    url: url?.[1],
    urlFrom: url?.[0],
    directUrl: direct?.[1],
    directFrom: direct?.[0],
    /** Names only (never values), for diagnostics in build logs. */
    candidates: Object.keys(env).filter((k) => /DATABASE|POSTGRES|NEON|^PG/.test(k)).sort(),
  };
}

/** Make sure DATABASE_URL (what Prisma reads) is set, using whatever name the platform provided. */
export function applyDatabaseEnv(env: Env = process.env): void {
  if (isPg(env.DATABASE_URL)) return;
  const { url } = resolveDatabaseEnv(env);
  if (url) env.DATABASE_URL = url;
}
