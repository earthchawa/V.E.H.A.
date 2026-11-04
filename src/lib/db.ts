import { PrismaClient } from "@prisma/client";
import { applyDatabaseEnv } from "./db-url";

// Hosting integrations don't always call it DATABASE_URL; normalise before Prisma reads it.
applyDatabaseEnv();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
