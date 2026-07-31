import OpenAI from "openai";

// ---------------------------------------------------------------------------
// OpenAI client for the Refunds.site assistant.
//
// The key is supplied by the operator as the OPENAI_API_KEY secret (the
// Replit AI integration was not used for this deployment). The client is
// created lazily so the API server still boots when the key is absent — the
// AI endpoints detect the missing key and return a clean 503 instead, while
// every other route keeps working.
// ---------------------------------------------------------------------------

let client: OpenAI | null = null;

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

// Model is overridable so the operator can point at whichever chat-completions
// model their key is entitled to without a code change. gpt-4o is a safe,
// widely-available default that supports streaming.
export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o";

// Newer OpenAI models reject `max_tokens` in favour of `max_completion_tokens`
// and ignore `temperature`. We use `max_completion_tokens` only and omit
// `temperature` so the same call works across the gpt-4o and gpt-5 families.
export const OPENAI_MAX_COMPLETION_TOKENS = 8192;
