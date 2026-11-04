/** Stable colour slot (0–7) for a course, so each course looks the same everywhere. */
export function courseColor(code: string): number {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 8;
}
