export const config = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  uploadDir: process.env.UPLOAD_DIR ?? "./storage/uploads",
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE !== "false"
    : process.env.NODE_ENV === "production",
  tempPasswordDays: Number(process.env.TEMP_PASSWORD_DAYS ?? 14),
  sessionDays: 7,
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  resetTokenMinutes: 30,
  maxResetRequestsPerHour: 3,
  maxUploadBytes: 50 * 1024 * 1024,
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "NKRAFA Classroom <no-reply@localhost>",
  },
};
