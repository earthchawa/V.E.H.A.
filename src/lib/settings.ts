import { db } from "./db";

/** Academy-wide settings stored in AppSetting. */
export const SETTING = { sebConfigKeys: "exam.sebConfigKeys" } as const;

export async function getSetting(key: string): Promise<string> {
  return (await db.appSetting.findUnique({ where: { key } }))?.value ?? "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
