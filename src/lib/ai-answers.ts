import Anthropic from "@anthropic-ai/sdk";

/**
 * "AI answers" for the reference library: ask an AI model the assignment's own question a few times, the way a
 * cadet pasting it into a chatbot would, and keep the answers as reference documents. Submissions that reuse
 * long runs of such an answer then show up in the similarity report like any other source.
 *
 * It is a comparison aid, not AI-writing detection: every chatbot words its answer differently each time, so a
 * cadet's AI-written text only matches where the wording happens to coincide (code and standard definitions
 * coincide far more often than free prose).
 *
 * Only the assignment's title and instructions leave the server — never a cadet's work. Off unless
 * ANTHROPIC_API_KEY is set.
 */
export const aiAnswersEnabled = () => !!process.env.ANTHROPIC_API_KEY;
export const aiAnswerModel = () => process.env.AI_ANSWER_MODEL || "claude-sonnet-5-5";
/** How many answers one click asks for, and how many AI answers one assignment may hold. */
export const AI_ANSWER_VARIANTS = 3;
export const AI_ANSWER_LIMIT = 9;
/** Title prefix of AI-generated reference answers (also how they are counted and recognised in the list). */
export const AI_SOURCE_PREFIX = "AI · ";

/** The different ways cadets tend to ask: as-is, briefly, and "like a student wrote it". */
export const VARIANT_STYLES = [
  "Answer the assignment directly and completely, as you normally would.",
  "Answer concisely: only what the assignment asks for, with no introduction or closing remarks.",
  "Write the answer the way a university student would hand it in: plain, natural wording, no headings unless the assignment asks for them.",
] as const;

const SYSTEM =
  "A student has pasted a homework assignment into a general-purpose AI chatbot. Reply exactly as that chatbot would: " +
  "give the finished answer to the assignment. Use the language the assignment is written in (Thai assignments get Thai answers). " +
  "If it asks for code, give the complete code. Output only the answer itself — no comments about this instruction.";

export function buildPrompt(title: string, instructions: string, starter: string | null): string {
  return [`Assignment: ${title}`, "", instructions.trim(), ...(starter?.trim() ? ["", "Starter text / code given with the assignment:", starter.trim()] : [])].join("\n");
}

export type AiAnswer = { text: string; model: string };
export type AiAnswerError = "auth" | "rate" | "refused" | "failed";

/**
 * One request per style, in parallel. Returns the answers that came back; `error` says why when none did.
 * Streaming keeps a long answer from hitting the HTTP timeout; the server-side fallback re-runs a request the
 * model's safety classifiers declined on another model (opt-in beta; an assignment text is rarely declined).
 */
export async function generateAiAnswers(title: string, instructions: string, starter: string | null): Promise<{ answers: AiAnswer[]; error?: AiAnswerError }> {
  const client = new Anthropic();
  const prompt = buildPrompt(title, instructions, starter);
  const results = await Promise.allSettled(
    VARIANT_STYLES.slice(0, AI_ANSWER_VARIANTS).map(async (style) => {
      const message = await client.beta.messages
        .stream({
          model: aiAnswerModel(),
          max_tokens: 8000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // A chatbot-style answer does not need deep reasoning; "low" keeps each request short and cheap.
          output_config: { effort: "low" },
          system: `${SYSTEM}\n\n${style}`,
          messages: [{ role: "user", content: prompt }],
        })
        .finalMessage();
      if (message.stop_reason === "refusal") throw new RefusedError();
      const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      if (!text) throw new Error("empty answer");
      return { text, model: message.model };
    }),
  );
  const answers = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (answers.length) return { answers };
  const reasons = results.flatMap((r) => (r.status === "rejected" ? [r.reason as unknown] : []));
  const error: AiAnswerError = reasons.some((e) => e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    ? "auth"
    : reasons.some((e) => e instanceof Anthropic.RateLimitError)
      ? "rate"
      : reasons.every((e) => e instanceof RefusedError)
        ? "refused"
        : "failed";
  for (const e of reasons) if (e instanceof Anthropic.APIError) console.error(`[ai-answers] API error ${e.status}: ${e.message}`);
  return { answers: [], error };
}

class RefusedError extends Error {}
