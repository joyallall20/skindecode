import {
  getGroqConfig,
  isGroqConfigured,
} from "../config/aiConfig.js";


const sanitizeError = (message) =>
  String(message || "Groq request failed.")
    .replace(
      /gsk_[a-zA-Z0-9]+/g,
      "[REDACTED_GROQ_KEY]"
    )
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
    const match =
      text.match(
        /```(?:json)?\s*([\s\S]*?)```/i
      );

    if (match?.[1]) {
      try {
        return {
          data: JSON.parse(
            match[1].trim()
          ),
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


// ============================================================
// MODEL RESOLUTION
// ============================================================

const getGroqModel = (
  modelKey = "chat"
) => {
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

    /**
     * Product Intelligence fallback model.
     */
    intelligence:
      process.env.GROQ_INTELLIGENCE_MODEL ||
      "openai/gpt-oss-120b",

    explanation:
      process.env.GROQ_EXPLANATION_MODEL ||
      "openai/gpt-oss-20b",

    chat:
      process.env.GROQ_CHAT_MODEL ||
      process.env.GROQ_EXPLANATION_MODEL ||
      "openai/gpt-oss-20b",
  };

  return (
    models[modelKey] ||
    models.chat
  );
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
      error:
        "Groq API is not configured. Set GROQ_API_KEY.",
    };
  }

  const {
    apiKey,
    baseUrl,
  } = getGroqConfig();

  const jsonSystemInstruction =
    'Return the response as valid JSON only. Do not return markdown, explanations, commentary, or code fences.';

  const finalSystemPrompt = [
    systemPrompt,
    jsonMode ? jsonSystemInstruction : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages = [];

  if (finalSystemPrompt) {
    messages.push({
      role: "system",
      content: finalSystemPrompt,
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

  const inputChars =
    messages.reduce(
      (sum, message) =>
        sum +
        String(
          message.content || ""
        ).length,
      0
    );

  try {
    const response =
      await fetch(
        `${baseUrl}/chat/completions`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`,
          },

          body:
            JSON.stringify(body),
        }
      );

    const payload =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      console.error(
        "[groq] API error",
        {
          model,
          status:
            response.status,

          error:
            sanitizeError(
              payload?.error
                ?.message
            ),

          inputChars,
        }
      );

      return {
        ok: false,
        configured: true,

        error:
          sanitizeError(
            payload?.error
              ?.message ||
              `Groq HTTP ${response.status}`
          ),

        provider: "groq",
        model,
        inputChars,
      };
    }

    const text =
      payload
        ?.choices?.[0]
        ?.message?.content ||
      "";

    return {
      ok: true,
      text,
      model,
      provider: "groq",
      rawResponse: payload,
      inputChars,
    };

  } catch (error) {
    console.error(
      "[groq] request error",
      {
        model,
        message:
          sanitizeError(
            error.message
          ),
      }
    );

    return {
      ok: false,
      configured: true,

      error:
        sanitizeError(
          error.message
        ),

      provider: "groq",
      model,
    };
  }
};


// ============================================================
// GROQ JSON GENERATION
// ============================================================

export const generateGroqJSON = async ({
  prompt,
  systemPrompt = "",
  modelKey = "chat",
  validate,
  temperature = 0.2,
  maxTokens = 4000,
}) => {
  const model =
    getGroqModel(modelKey);

  const result =
    await callGroq({
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

      error:
        result.error,

      provider: "groq",
      model:
        result.model ||
        model,

      validationErrors: [],
      parseError: null,
      rawText: null,

      rawResponse:
        result.rawResponse ||
        null,

      configured:
        result.configured,

      inputChars:
        result.inputChars,
    };
  }

  const {
    data,
    parseError,
  } =
    parseJsonSafely(
      result.text
    );

  if (parseError) {
    return {
      success: false,
      data: null,

      error:
        "Groq returned malformed JSON.",

      provider: "groq",
      model:
        result.model,

      validationErrors: [],

      parseError,

      rawText:
        result.text,

      rawResponse:
        result.rawResponse,
    };
  }

  const validationErrors =
    typeof validate === "function"
      ? validate(data)
      : [];

  if (
    validationErrors.length
  ) {
    console.error(
      "[groq] Product Intelligence schema validation failed:",
      {
        model: result.model,
        validationErrors,
        rawText: result.text,
      }
    );

    return {
      success: false,
      data: null,

      error:
        "Groq JSON did not match expected schema.",

      provider: "groq",
      model:
        result.model,

      validationErrors,

      parseError: null,

      rawText:
        result.text,

      rawResponse:
        result.rawResponse,
    };
  }

  return {
    success: true,

    data,

    error: null,

    provider: "groq",

    model:
      result.model,

    validationErrors: [],

    parseError: null,

    rawText:
      result.text,

    rawResponse:
      result.rawResponse,
  };
};


// ============================================================
// GROQ TEXT GENERATION
// ============================================================

export const generateGroqText = async ({
  prompt,
  systemPrompt = "",
  modelKey = "chat",
  temperature = 0.2,
  maxTokens = 4000,
}) => {
  const model =
    getGroqModel(modelKey);

  const result =
    await callGroq({
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

      error:
        result.error,

      provider: "groq",
      model:
        result.model ||
        model,

      rawResponse:
        result.rawResponse ||
        null,
    };
  }

  return {
    success: true,

    text:
      result.text,

    error: null,

    provider: "groq",

    model:
      result.model,

    rawResponse:
      result.rawResponse,
  };
};


export const isGroqServiceConfigured =
  isGroqConfigured;


export default {
  generateGroqJSON,
  generateGroqText,
  isGroqConfigured,
};