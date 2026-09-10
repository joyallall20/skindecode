import { getGroqConfig, isGroqConfigured } from "../config/aiConfig.js";

const sanitizeError = (message) =>
  String(message || "Groq request failed.")
    .replace(/gsk_[a-zA-Z0-9]+/g, "[REDACTED_KEY]")
    .trim();

const parseJsonSafely = (text) => {
  if (!text?.trim()) {
    return {
      data: null,
      parseError: "Empty response.",
    };
  }

  try {
    return {
      data: JSON.parse(text),
      parseError: null,
    };
  } catch (e) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (match?.[1]) {
      try {
        return {
          data: JSON.parse(match[1].trim()),
          parseError: null,
        };
      } catch (nested) {
        return {
          data: null,
          parseError: nested.message,
        };
      }
    }

    return {
      data: null,
      parseError: e.message,
    };
  }
};

// ============================================================
// MODEL RESOLUTION
// ============================================================

const getGroqModel = (modelKey = "chat") => {
  const models = {
    extraction:
      process.env.GROQ_EXTRACTION_MODEL ||
      "openai/gpt-oss-20b",

    matching:
      process.env.GROQ_MATCHING_MODEL ||
      "openai/gpt-oss-20b",

    validation:
      process.env.GROQ_VALIDATION_MODEL ||
      "openai/gpt-oss-20b",

    explanation:
      process.env.GROQ_EXPLANATION_MODEL ||
      "openai/gpt-oss-20b",

    // Chat uses the explanation model unless a dedicated
    // GROQ_CHAT_MODEL is added later.
    chat:
      process.env.GROQ_CHAT_MODEL ||
      process.env.GROQ_EXPLANATION_MODEL ||
      "openai/gpt-oss-20b",
  };

  return models[modelKey] || models.chat;
};

// ============================================================
// GROQ REQUEST
// ============================================================

const callGroq = async ({
  model,
  systemPrompt,
  prompt,
  temperature = 0.1,
  jsonMode = true,
  maxTokens,
}) => {
  if (!isGroqConfigured()) {
    return {
      ok: false,
      configured: false,
      error: "Groq API is not configured. Set GROQ_API_KEY.",
    };
  }

  const { apiKey, baseUrl } = getGroqConfig();

  const messages = [];

  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  messages.push({
    role: "user",
    content: prompt,
  });

  const body = {
    model,
    messages,
    temperature,
  };

  if (Number.isFinite(maxTokens)) {
    body.max_tokens = maxTokens;
  }

  if (jsonMode) {
    body.response_format = {
      type: "json_object",
    };
  }

  const inputChars = messages.reduce(
    (sum, message) =>
      sum + String(message.content || "").length,
    0
  );

  try {
    const response = await fetch(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },

        body: JSON.stringify(body),
      }
    );

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      const failedGeneration = String(
        payload?.error?.failed_generation || ""
      ).slice(0, 400);

      console.error("[groq] API error", {
        model,
        status: response.status,
        error: payload?.error?.message,
        inputChars,
        failedGeneration:
          failedGeneration || undefined,
      });

      return {
        ok: false,
        configured: true,
        error: sanitizeError(
          payload?.error?.message ||
            `Groq HTTP ${response.status}`
        ),
        model,
        provider: "groq",
        inputChars,
      };
    }

    const text =
      payload?.choices?.[0]?.message?.content || "";

    return {
      ok: true,
      text,
      model,
      provider: "groq",
      rawResponse: payload,
      inputChars,
    };
  } catch (error) {
    console.error("[groq] request error", {
      model,
      message: error.message,
    });

    return {
      ok: false,
      configured: true,
      error: sanitizeError(error.message),
      model,
      provider: "groq",
    };
  }
};

// ============================================================
// GROQ JSON
// ============================================================

export const generateGroqJSON = async ({
  prompt,
  systemPrompt = "",
  modelKey = "extraction",
  validate,
  temperature = 0.1,
  maxTokens = 2500,
}) => {
  const model = getGroqModel(modelKey);

  const result = await callGroq({
    model,
    systemPrompt,
    prompt,
    temperature,
    jsonMode: true,
    maxTokens,
  });

  if (!result.ok) {
    return {
      success: false,
      data: null,
      error: result.error,
      provider: result.configured
        ? "groq"
        : "fallback",
      model: result.model || model,
      validationErrors: [],
      parseError: null,
      fallback: !result.configured,
      inputChars: result.inputChars,
    };
  }

  const {
    data,
    parseError,
  } = parseJsonSafely(result.text);

  if (parseError) {
    return {
      success: false,
      data: null,
      error: "Groq returned malformed JSON.",
      provider: "groq",
      model: result.model,
      parseError,
      validationErrors: [],
      rawText: result.text,
    };
  }

  const validationErrors =
    typeof validate === "function"
      ? validate(data)
      : [];

  if (validationErrors.length) {
    return {
      success: false,
      data: null,
      error:
        "Groq JSON did not match expected schema.",
      provider: "groq",
      model: result.model,
      validationErrors,
      rawText: result.text,
    };
  }

  return {
    success: true,
    data,
    error: null,
    provider: "groq",
    model: result.model,
    validationErrors: [],
    parseError: null,
    rawText: result.text,
  };
};

// ============================================================
// GROQ TEXT
// ============================================================

export const generateGroqText = async ({
  prompt,
  systemPrompt = "",
  modelKey = "chat",
  temperature = 0.4,
}) => {
  const model = getGroqModel(modelKey);

  const result = await callGroq({
    model,
    systemPrompt,
    prompt,
    temperature,
    jsonMode: false,
  });

  if (!result.ok) {
    return {
      success: false,
      text: null,
      error: result.error,
      provider: result.configured
        ? "groq"
        : "fallback",
      model,
    };
  }

  return {
    success: true,
    text: result.text,
    provider: "groq",
    model: result.model,
  };
};

export default {
  generateGroqJSON,
  generateGroqText,
  isGroqConfigured,
};