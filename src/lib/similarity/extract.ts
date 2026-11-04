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
      return text.trim() ? [{ text, kind: "text" }] : null;
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
