import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { requestMeta } from "./request";

export async function audit(entry: {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  const { ip } = await requestMeta();
  await db.auditLog.create({ data: { ...entry, ip } });
}
