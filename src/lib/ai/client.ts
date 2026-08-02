import "server-only";
import { GoogleGenAI } from "@google/genai";

/**
 * The ONLY place GEMINI_API_KEY is read (CLAUDE.md §5, master plan §6.1).
 * `server-only` makes any accidental client import a build error rather than
 * a silent key leak.
 */
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Model IDs live here and nowhere else, so a retirement is a one-line fix.
 *
 * The master plan named gemini-2.5-flash / gemini-2.5-flash-lite; both now
 * return 404 "no longer available to new users", so these are the verified
 * replacements (see CLAUDE.md §7, 2026-08-02).
 */
export const MODELS = {
  cheap: "gemini-3.5-flash-lite", // classification, parsing, normalization
  main: "gemini-3.5-flash", // recipes, receipt vision
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * Measured on the categorize task: leaving thinking on costs 554 thinking
 * tokens and ~2s for byte-identical output (649 vs 165 total tokens).
 * Extraction-shaped tasks therefore run with thinking off.
 *
 * `cheap` has no thinking at all and rejects thinkingConfig outright, so the
 * budget is only ever sent for `main`.
 */
export function generationConfig({
  tier,
  responseSchema,
  reasoning,
}: {
  tier: ModelTier;
  responseSchema: object;
  reasoning: boolean;
}) {
  return {
    responseMimeType: "application/json",
    responseSchema,
    ...(tier === "main" && !reasoning
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : {}),
  };
}
