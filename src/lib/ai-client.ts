/**
 * Browser-side helper for the AI gateway. Talks only to /api/ai/assist —
 * it has no idea Gemini exists, and no key ever reaches this file.
 */
export async function askAi<T>(task: string, payload: unknown): Promise<T> {
  const response = await fetch("/api/ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, payload }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? "ИИ временно недоступен");
  }
  return body.result as T;
}
