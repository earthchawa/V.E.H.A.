import nodemailer from "nodemailer";
import { config } from "./config";

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!config.smtp.host) {
    // No mail server configured (e.g. development): write to the server log instead.
    console.info(`[mail] SMTP not configured. To: ${to}\nSubject: ${subject}\n\n${text}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  await transport.sendMail({ from: config.smtp.from, to, subject, text });
}
