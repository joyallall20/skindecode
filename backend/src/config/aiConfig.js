/**
 * Centralized AI provider and model configuration.
 * All services should read s from here — never hardcode in controllers.
 */

export const getFirecrawlConfig = () => ({
  apiKey: process.env.FIRECRAWL_API_KEY || "",
  baseUrl: process.env.FIRECRAWL_API_BASE || "https://api.firecrawl.dev/v1",
  timeoutMs: Number(process.env.FIRECRAWL_TIMEOUT_MS || 30000),
});

export const getGroqConfig = () => ({
  apiKey: process.env.GROQ_API_KEY || "",
  baseUrl: process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1",
  models: {
    extraction: process.env.GROQ_EXTRACTION_MODEL || "llama-3.3-70b-versatile",
    matching: process.env.GROQ_MATCHING_MODEL || "llama-3.1-8b-instant",
    validation: process.env.GROQ_VALIDATION_MODEL || "llama-3.1-8b-instant",
    chat: process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile",
    explanation:
      process.env.GROQ_EXPLANATION_MODEL || "llama-3.3-70b-versatile",
  },
});

export const getGeminiConfig = () => ({
  apiKey: process.env.GEMINI_API_KEY || "",
  model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  models: {
    intelligence:
      process.env.GEMINI_INTELLIGENCE_MODEL ||
      process.env.GEMINI_MODEL ||
      "gemini-3.6-flash",
    research:
      process.env.GEMINI_RESEARCH_MODEL ||
      process.env.GEMINI_MODEL ||
      "gemini-3.6-flash",
    extraction:
      process.env.GEMINI_EXTRACTION_MODEL ||
      process.env.GEMINI_MODEL ||
      "gemini-3.6-flash",
  },
});

export const getInciDecoderConfig = () => ({
  baseUrl: (
    process.env.INCI_DECODER_BASE_URL || "https://incidecoder.com"
  ).replace(/\/+$/, ""),
  timeoutMs: Number(process.env.INCI_DECODER_TIMEOUT_MS || 15000),
});

export const isFirecrawlConfigured = () => Boolean(getFirecrawlConfig().apiKey);
export const isGroqConfigured = () => Boolean(getGroqConfig().apiKey);
export const isGeminiConfigured = () => Boolean(getGeminiConfig().apiKey);

export default {
  getFirecrawlConfig,
  getGroqConfig,
  getGeminiConfig,
  getInciDecoderConfig,
  isFirecrawlConfigured,
  isGroqConfigured,
  isGeminiConfigured,
};
