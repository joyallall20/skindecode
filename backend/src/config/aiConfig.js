/**
 * Centralized AI provider and model configuration.
 *
 * All AI services should read configuration from here.
 * Never hardcode API keys or provider URLs in controllers/services.
 */

export const getFirecrawlConfig = () => ({
  apiKey: process.env.FIRECRAWL_API_KEY || "",
  baseUrl:
    process.env.FIRECRAWL_API_BASE ||
    "https://api.firecrawl.dev/v1",
  timeoutMs: Number(
    process.env.FIRECRAWL_TIMEOUT_MS || 30000
  ),
});

export const getGroqConfig = () => ({
  apiKey: process.env.GROQ_API_KEY || "",

  baseUrl:
    process.env.GROQ_API_BASE ||
    "https://api.groq.com/openai/v1",

  models: {
    extraction:
      process.env.GROQ_EXTRACTION_MODEL ||
      "llama-3.3-70b-versatile",

    matching:
      process.env.GROQ_MATCHING_MODEL ||
      "llama-3.1-8b-instant",

    validation:
      process.env.GROQ_VALIDATION_MODEL ||
      "llama-3.1-8b-instant",

    /**
     * Product Intelligence fallback.
     */
    intelligence:
      process.env.GROQ_INTELLIGENCE_MODEL ||
      "openai/gpt-oss-120b",

    chat:
      process.env.GROQ_CHAT_MODEL ||
      "llama-3.3-70b-versatile",

    explanation:
      process.env.GROQ_EXPLANATION_MODEL ||
      "llama-3.3-70b-versatile",
  },
});


/**
 * OpenRouter configuration.
 *
 * Product Intelligence uses OpenRouter as the primary provider.
 *
 * Default:
 *   openrouter/free
 *
 * This lets OpenRouter select an available free model that
 * supports the requested capabilities.
 */
export const getOpenRouterConfig = () => ({
  apiKey:
    process.env.OPENROUTER_API_KEY || "",

  baseUrl:
    (
      process.env.OPENROUTER_API_BASE ||
      "https://openrouter.ai/api/v1"
    ).replace(/\/+$/, ""),

  siteUrl:
    process.env.OPENROUTER_SITE_URL || "",

  siteName:
    process.env.OPENROUTER_SITE_NAME ||
    "skinDecode",

  models: {
    intelligence:
      process.env.OPENROUTER_INTELLIGENCE_MODEL ||
      "openrouter/free",
  },
});


/**
 * Gemini configuration.
 *
 * Gemini remains available for Ingredient Research.
 *
 * It is NOT used as Product Intelligence fallback.
 */
export const getGeminiConfig = () => ({
  apiKey:
    process.env.GEMINI_API_KEY || "",

  model:
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash",

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
    process.env.INCI_DECODER_BASE_URL ||
    "https://incidecoder.com"
  ).replace(/\/+$/, ""),

  timeoutMs: Number(
    process.env.INCI_DECODER_TIMEOUT_MS || 15000
  ),
});


export const isFirecrawlConfigured = () =>
  Boolean(getFirecrawlConfig().apiKey);

export const isGroqConfigured = () =>
  Boolean(getGroqConfig().apiKey);

export const isGeminiConfigured = () =>
  Boolean(getGeminiConfig().apiKey);

export const isOpenRouterConfigured = () =>
  Boolean(getOpenRouterConfig().apiKey);


export default {
  getFirecrawlConfig,
  getGroqConfig,
  getGeminiConfig,
  getOpenRouterConfig,
  getInciDecoderConfig,

  isFirecrawlConfigured,
  isGroqConfigured,
  isGeminiConfigured,
  isOpenRouterConfigured,
};