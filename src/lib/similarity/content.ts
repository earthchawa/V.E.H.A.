import type { Extracted } from "./extract";
import type { Segment } from "./engine";

/**
 * Build the single analysed document for a submission: the typed answer followed by each
 * file's extracted text under a header line. Segment ranges tell the engine how to tokenise.
 */
export function assembleContent(
  textAnswer: string | null,
  files: { fileName: string; extracted: Extracted[] | null }[],
): { content: string; segments: Segment[] } {
  let content = "";
  const segments: Segment[] = [];
  const push = (text: string, kind: Segment["kind"]) => {
    if (!text) return;
    segments.push({ s: content.length, e: content.length + text.length, kind });
    content += text;
  };
  if (textAnswer?.trim()) push(textAnswer.trim(), "text");
  for (const f of files) {
    if (!f.extracted) continue;
    push(`${content ? "\n\n" : ""}▌ ${f.fileName}\n`, "meta");
    f.extracted.forEach((part, i) => {
      if (i > 0) push("\n\n", "meta");
      push(part.text.replace(/\r\n/g, "\n").trimEnd(), part.kind);
    });
  }
  return { content, segments };
}
