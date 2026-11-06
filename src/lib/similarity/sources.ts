import type { Segment } from "./engine";
import { assembleContent } from "./content";
import type { Extracted } from "./extract";

/**
 * Analysed text for a reference document. Pasted text is tokenised both as prose and as code, so a
 * pasted program (a GitHub solution, an AI chatbot's answer) also matches code in submissions.
 */
export function referenceContent(text: string | null, files: { fileName: string; extracted: Extracted[] | null }[]): { content: string; segments: Segment[] } {
  const { content, segments } = assembleContent(text, files);
  const both: Segment[] = [];
  for (const s of segments) {
    both.push(s);
    if (s.kind === "text") both.push({ ...s, kind: "code" });
  }
  return { content, segments: both };
}
