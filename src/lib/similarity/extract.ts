export type Extracted = { text: string; kind: "text" | "code" };

const CODE_EXT = new Set(
  "py java c h cpp cc cxx hpp cs js jsx mjs ts tsx go rs rb php kt kts swift sql scala r m sh bash ps1 html htm css scss vue dart lua pl hs asm".split(" "),
);
const TEXT_EXT = new Set("txt md markdown csv tsv tex rst json xml yaml yml log".split(" "));

export function extension(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Extract analysable text from an uploaded file; null if the type isn't supported. */
export async function extractFile(name: string, data: Buffer): Promise<Extracted[] | null> {
  const ext = extension(name);
  try {
    if (CODE_EXT.has(ext)) return [{ text: data.toString("utf8"), kind: "code" }];
    if (TEXT_EXT.has(ext)) return [{ text: data.toString("utf8"), kind: "text" }];
    if (ext === "ipynb") return extractNotebook(data.toString("utf8"));
    if (ext === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const { text } = await extractText(pdf, { mergePages: true });
      // PDFs made with legacy Thai fonts often extract as garbage; don't score what we can't read.
      return text.trim() && !looksGarbled(text) ? [{ text, kind: "text" }] : null;
    }
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: data });
      return value.trim() ? [{ text: value, kind: "text" }] : null;
    }
  } catch (err) {
    console.warn(`[extract] could not read ${name}:`, err);
  }
  return null;
}

/**
 * True when extracted text is mostly unreadable: replacement characters, private-use glyphs
 * (legacy Thai PDF fonts map vowels/tone marks there), control characters, or Thai combining
 * marks with no base consonant.
 */
export function looksGarbled(text: string): boolean {
  const chars = [...text.replace(/\s+/g, "")];
  if (chars.length === 0) return false;
  let bad = 0;
  let prev = "";
  for (const c of chars) {
    const cp = c.codePointAt(0)!;
    const privateUse = cp >= 0xe000 && cp <= 0xf8ff;
    const control = cp < 0x20 || (cp >= 0x7f && cp < 0xa0);
    // Thai above/below vowels and tone marks must follow a Thai consonant or vowel.
    const thaiMark = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(c);
    const orphanMark = thaiMark && !/[\u0E01-\u0E30\u0E31-\u0E3A\u0E47-\u0E4E]/.test(prev);
    if (c === "\uFFFD" || privateUse || control || orphanMark) bad++;
    prev = c;
  }
  return bad / chars.length > 0.02;
}

/** Jupyter notebooks: code cells as code, markdown cells as prose. Outputs are ignored. */
export function extractNotebook(json: string): Extracted[] | null {
  const nb = JSON.parse(json) as { cells?: { cell_type: string; source: string | string[] }[] };
  const parts: Extracted[] = [];
  for (const cell of nb.cells ?? []) {
    const text = Array.isArray(cell.source) ? cell.source.join("") : cell.source;
    if (!text?.trim()) continue;
    const kind = cell.cell_type === "code" ? "code" : "text";
    const last = parts[parts.length - 1];
    if (last?.kind === kind) last.text += "\n\n" + text;
    else parts.push({ text, kind });
  }
  return parts.length ? parts : null;
}
