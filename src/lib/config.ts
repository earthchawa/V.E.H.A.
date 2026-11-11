const onVercel = !!process.env.VERCEL;
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const blobDriver = (process.env.STORAGE_DRIVER ?? (hasBlob ? "blob" : "")) === "blob";

export const config = {
  onVercel,
  appUrl: (
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, ""),
  /**
   * Where NEW uploads go: "disk" (self-hosted default), "blob" (Vercel Blob; the default as soon as a Blob store
   * is connected, i.e. BLOB_READ_WRITE_TOKEN is set) or "db" (bytes in Postgres; Vercel without a Blob store).
   * Files saved earlier stay readable after a switch: a key tells which store it is in (lib/storage.ts).
   */
  storageDriver: (process.env.STORAGE_DRIVER ?? (hasBlob ? "blob" : onVercel ? "db" : "disk")) as "disk" | "db" | "blob",
  /** Store of files saved before Blob was switched on (keys without a Blob prefix). */
  legacyDriver: (process.env.STORAGE_DRIVER === "disk" || process.env.STORAGE_DRIVER === "db"
    ? process.env.STORAGE_DRIVER
    : onVercel ? "db" : "disk") as "disk" | "db",
  hasBlob,
  uploadDir: process.env.UPLOAD_DIR ?? "./storage/uploads",
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE !== "false"
    : process.env.NODE_ENV === "production",
  /**
   * Safe Exam Browser mode. Off by default: quizzes use the full-screen browser mode with a supervising
   * instructor. Set SEB_ENABLED=true to offer the locked-down mode (and its admin settings) again.
   */
  sebEnabled: process.env.SEB_ENABLED === "true",
  tempPasswordDays: Number(process.env.TEMP_PASSWORD_DAYS ?? 14),
  sessionDays: 7,
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  resetTokenMinutes: 30,
  maxResetRequestsPerHour: 3,
  /**
   * Largest upload per request. Vercel functions accept at most 4.5 MB request bodies, so without Blob the cap
   * there is 4 MB; with Blob the browser uploads straight to the store and the usual 50 MB applies.
   */
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? (onVercel && !blobDriver ? 4 : 50)),
  /** Browser → Blob direct uploads (file fields are replaced by references before the form is posted). */
  directUpload: blobDriver,
  /**
   * Self-service password reset by email works only once an SMTP server is configured. Until then the
   * "Forgot password?" page tells people to contact an administrator (who resets it on the Users page).
   */
  get emailReset() {
    return !!process.env.SMTP_HOST;
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "NKRAFA Classroom <no-reply@localhost>",
  },
};
