const onVercel = !!process.env.VERCEL;

export const config = {
  onVercel,
  appUrl: (
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, ""),
  /** "disk" (default, self-hosted) or "db" (files kept in Postgres; default on Vercel). */
  storageDriver: (process.env.STORAGE_DRIVER ?? (onVercel ? "db" : "disk")) as "disk" | "db",
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
  /** Largest upload per request. Vercel functions accept at most 4.5 MB request bodies. */
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? (onVercel ? 4 : 50)),
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "NKRAFA Classroom <no-reply@localhost>",
  },
};
