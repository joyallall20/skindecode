const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";

const sanitizeError = (message) =>
  String(message || "Cerebras request failed.")
    .replace(/csk-[a-zA-Z0-9_-]+/g, "[REDACTED_KEY]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED_KEY]")
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
  } catch (error) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (match?.[1]) {
      try {
        return {
          data: JSON.parse(match[1].trim()),
          parseError: null,
        };
      } catch (nestedError) {
        return {
          data: null,
          parseError: nestedError.message,
        };
      }
    }

    return {
      data: null,
      parseError: error.message,
    };
  }
};

const getCerebrasModel = (modelKey = "chat") => {
  const defaultModel =
    process.env.CEREBRAS_MODEL || "gpt-oss-120b";

  const models = {
    extraction:
      process.env.CEREBRAS_EXTRACTION_MODEL || defaultModel,

    matching:
      process.env.CEREBRAS_MATCHING_MODEL || defaultModel,

    validation:
      process.env.CEREBRAS_VALIDATION_MODEL || defaultModel,

    explanation:
      process.env.CEREBRAS_EXPLANATION_MODEL || defaultModel,

    research:
      process.env.CEREBRAS_RESEARCH_MODEL || defaultModel,

    intelligence:
      process.env.CEREBRAS_INTELLIGENCE_MODEL || defaultModel,

    chat:
      process.env.CEREBRAS_CHAT_MODEL || defaultModel,
  };

  return models[modelKey] || models.chat;
};

export const isCerebrasConfigured = () =>
  Boolean(
    String(process.env.CEREBRAS_API_KEY || "").trim()
  );

const callCerebras = async ({
  model,
  systemPrompt = "",
  prompt,
  temperature = 0.1,
  jsonMode = true,
  maxTokens,
}) => {
  if (!isCerebrasConfigured()) {
    return {
      ok: false,
      configured: false,
      error:
        "Cerebras API is not configured. Set CEREBRAS_API_KEY.",
    };
  }

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
    body.max_completion_tokens = maxTokens;
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
      `${CEREBRAS_BASE_URL}/chat/completions`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },

        body: JSON.stringify(body),
      }
    );

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        error: sanitizeError(
          payload?.error?.message ||
            `Cerebras HTTP ${response.status}`
        ),
        model,
        provider: "cerebras",
        inputChars,
      };
    }

    const choice = payload?.choices?.[0];

    const text =
      choice?.message?.content || "";

    if (!text.trim()) {
      return {
        ok: false,
        configured: true,
        error:
          "Cerebras returned an empty response.",
        model,
        provider: "cerebras",
        inputChars,
        rawResponse: payload,
      };
    }

    return {
      ok: true,
      text,
      model: payload?.model || model,
      provider: "cerebras",
      rawResponse: payload,
      inputChars,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: sanitizeError(error.message),
      model,
      provider: "cerebras",
      inputChars,
    };
  }
};

export const generateCerebrasJSON = async ({
  prompt,
  systemPrompt = "",
  modelKey = "intelligence",
  validate,
  temperature = 0.1,
  maxTokens = 4000,
}) => {
  const model =
    getCerebrasModel(modelKey);

  const result = await callCerebras({
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
        ? "cerebras"
        : "fallback",

      model: result.model || model,

      validationErrors: [],

      parseError: null,

      fallback:
        !result.configured,

      inputChars:
        result.inputChars,
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

      error:
        "Cerebras returned malformed JSON.",

      provider: "cerebras",
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
        "Cerebras JSON did not match expected schema.",

      provider: "cerebras",
      model: result.model,

      validationErrors,

      parseError: null,

      rawText: result.text,
    };
  }

  return {
    success: true,
    data,

    error: null,

    provider: "cerebras",

    model: result.model,

    validationErrors: [],

    parseError: null,

    rawText: result.text,
  };
};

export const generateCerebrasText = async ({
  prompt,
  systemPrompt = "",
  modelKey = "chat",
  temperature = 0.4,
  maxTokens = 4000,
}) => {
  const model =
    getCerebrasModel(modelKey);

  const result = await callCerebras({
    model,
    systemPrompt,
    prompt,
    temperature,
    jsonMode: false,
    maxTokens,
  });

  if (!result.ok) {
    return {
      success: false,
      text: null,

      error: result.error,

      provider: result.configured
        ? "cerebras"
        : "fallback",

      model,
    };
  }

  return {
    success: true,

    text: result.text,

    provider: "cerebras",

    model: result.model,
  };
};

export default {
  generateCerebrasJSON,
  generateCerebrasText,
  isCerebrasConfigured,
};