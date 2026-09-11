import {
  getOpenRouterConfig,
  isOpenRouterConfigured,
} from '../config/aiConfig.js';

import {
  generateGroqJSON,

} from './groqService.js';
import { isGroqServiceConfigured as isGroqConfigured } from './groqService.js';

/*
 * ----------------------------------------------------------
 * ERROR SANITIZATION
 * ----------------------------------------------------------
 */
console.log(
  '[INTELLIGENCE ROUTER] LOADED UPDATED OPENROUTER ROUTER',
  new Date().toISOString()
);

const sanitizeError = (message) =>
  String(message || 'AI provider request failed.')
    .replace(
      /sk-or-v1-[a-zA-Z0-9_-]+/g,
      '[REDACTED_OPENROUTER_KEY]'
    )
    .replace(
      /gsk_[a-zA-Z0-9]+/g,
      '[REDACTED_GROQ_KEY]'
    )
    .trim();


/*
 * ----------------------------------------------------------
 * JSON PARSER
 * ----------------------------------------------------------
 */

const parseJsonSafely = (text) => {
  if (!text?.trim()) {
    return {
      data: null,
      parseError: 'Empty response.',
    };
  }

  try {
    return {
      data: JSON.parse(text),
      parseError: null,
    };
  } catch (error) {
    /*
     * Some models may still wrap JSON in markdown fences.
     */
    const match = text.match(
      /```(?:json)?\s*([\s\S]*?)```/i
    );

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


/*
 * ----------------------------------------------------------
 * OPENROUTER MODEL
 * ----------------------------------------------------------
 */

const getOpenRouterModel = (
  modelKey = 'intelligence'
) => {
  const config = getOpenRouterConfig();

  return (
    config.models?.[modelKey] ||
    config.models?.intelligence ||
    'openrouter/free'
  );
};


/*
 * ----------------------------------------------------------
 * OPENROUTER REQUEST
 * ----------------------------------------------------------
 */

const callOpenRouter = async ({
  model,
  systemPrompt = '',
  prompt,
  temperature = 0.2,
  maxTokens = 4000,
}) => {
  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      configured: false,
      error:
        'OpenRouter API is not configured. Set OPENROUTER_API_KEY.',
      provider: 'openrouter',
      model,
    };
  }

  const {
    apiKey,
    baseUrl,
    siteUrl,
    siteName,
  } = getOpenRouterConfig();


  /*
   * IMPORTANT:
   *
   * OpenRouter requires the word "json" to appear somewhere
   * in the messages when response_format.type is json_object.
   *
   * We enforce this here at the router level so every
   * Product Intelligence request satisfies that requirement.
   */

  const jsonSystemInstruction =
    'Output must be valid JSON only. Do not return markdown, explanations, commentary, or code fences.';


  const finalSystemPrompt = [
    systemPrompt,
    jsonSystemInstruction,
  ]
    .filter(Boolean)
    .join('\n\n');


  const messages = [];

  if (finalSystemPrompt) {
    messages.push({
      role: 'system',
      content: finalSystemPrompt,
    });
  }

  messages.push({
    role: 'user',
    content: prompt,
  });


  const body = {
    model,
    messages,

    temperature,

    response_format: {
      type: 'json_object',
    },
  };


  if (Number.isFinite(maxTokens)) {
    body.max_tokens = maxTokens;
  }


  const inputChars = messages.reduce(
    (sum, message) =>
      sum + String(message.content || '').length,
    0
  );


  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };


  if (siteUrl) {
    headers['HTTP-Referer'] = siteUrl;
  }

  if (siteName) {
    headers['X-Title'] = siteName;
  }


  try {
    const response = await fetch(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }
    );


    const payload = await response
      .json()
      .catch(() => ({}));


    if (!response.ok) {
      console.error(
        '[openrouter] API error',
        {
          model,
          status: response.status,
          error: sanitizeError(
            payload?.error?.message
          ),
          inputChars,
        }
      );


      return {
        ok: false,
        configured: true,
        error: sanitizeError(
          payload?.error?.message ||
            `OpenRouter HTTP ${response.status}`
        ),
        provider: 'openrouter',
        model,
        inputChars,
      };
    }


    const text =
      payload?.choices?.[0]?.message?.content ||
      '';


    return {
      ok: true,
      text,
      model:
        payload?.model || model,
      provider: 'openrouter',
      rawResponse: payload,
      inputChars,
    };


  } catch (error) {
    console.error(
      '[openrouter] request error',
      {
        model,
        message: sanitizeError(
          error.message
        ),
      }
    );


    return {
      ok: false,
      configured: true,
      error: sanitizeError(
        error.message
      ),
      provider: 'openrouter',
      model,
    };
  }
};


/*
 * ----------------------------------------------------------
 * OPENROUTER JSON GENERATION
 * ----------------------------------------------------------
 */

export const generateOpenRouterJSON = async ({
  prompt,
  systemPrompt = '',
  modelKey = 'intelligence',
  validate,
  temperature = 0.2,
  maxTokens = 4000,
}) => {

  const model =
    getOpenRouterModel(modelKey);


  const result =
    await callOpenRouter({
      model,
      systemPrompt,
      prompt,
      temperature,
      maxTokens,
    });


  if (!result.ok) {
    return {
      success: false,
      data: null,
      error: result.error,
      provider: 'openrouter',
      model:
        result.model || model,
      validationErrors: [],
      parseError: null,
      rawText: null,
      rawResponse:
        result.rawResponse || null,
      configured:
        result.configured,
      inputChars:
        result.inputChars,
    };
  }


  /*
   * Parse the model response.
   */

  const {
    data,
    parseError,
  } = parseJsonSafely(
    result.text
  );


  if (parseError) {
    console.error(
      '[openrouter] malformed JSON response',
      {
        model: result.model,
        parseError,
      }
    );


    return {
      success: false,
      data: null,
      error:
        'OpenRouter returned malformed JSON.',
      provider: 'openrouter',
      model: result.model,
      validationErrors: [],
      parseError,
      rawText: result.text,
      rawResponse:
        result.rawResponse,
    };
  }


  /*
   * Validate against the existing
   * Product Intelligence schema.
   */

  const validationErrors =
    typeof validate === 'function'
      ? validate(data)
      : [];


  if (validationErrors.length) {
    console.error(
      '[openrouter] schema validation failed',
      {
        model: result.model,
        validationErrors,
      }
    );


    return {
      success: false,
      data: null,
      error:
        'OpenRouter JSON did not match expected schema.',
      provider: 'openrouter',
      model: result.model,
      validationErrors,
      parseError: null,
      rawText: result.text,
      rawResponse:
        result.rawResponse,
    };
  }


  return {
    success: true,
    data,
    error: null,
    provider: 'openrouter',
    model: result.model,
    validationErrors: [],
    parseError: null,
    rawText: result.text,
    rawResponse:
      result.rawResponse,
  };
};


/*
 * ----------------------------------------------------------
 * PRODUCT INTELLIGENCE AI ROUTER
 * ----------------------------------------------------------
 *
 * PRIMARY:
 *   OpenRouter
 *
 * FALLBACK:
 *   Direct Groq
 *
 * Gemini is intentionally NOT used here.
 * Gemini remains reserved for Ingredient Research.
 * ----------------------------------------------------------
 */

export const generateProductIntelligenceJSON = async (
  options = {}
) => {

  let openRouterResult = null;


  /*
   * --------------------------------------------------------
   * 1. OPENROUTER PRIMARY
   * --------------------------------------------------------
   */

  if (isOpenRouterConfigured()) {

    console.info(
      '[intelligence-ai] trying OpenRouter'
    );


    openRouterResult =
      await generateOpenRouterJSON(
        options
      );


    if (openRouterResult.success) {

      console.info(
        '[intelligence-ai] OpenRouter succeeded',
        {
          model:
            openRouterResult.model,
        }
      );


      return openRouterResult;
    }


    console.warn(
      '[intelligence-ai] OpenRouter failed:',
      openRouterResult.error
    );

  } else {

    console.info(
      '[intelligence-ai] OpenRouter not configured; skipping'
    );
  }


  /*
   * --------------------------------------------------------
   * 2. GROQ FALLBACK
   * --------------------------------------------------------
   */

  if (isGroqConfigured()) {

    console.info(
      '[intelligence-ai] trying Groq fallback'
    );


    const groqResult =
      await generateGroqJSON({
        ...options,
        modelKey:
          options.modelKey ||
          'intelligence',
      });


    if (groqResult.success) {

      console.info(
        '[intelligence-ai] Groq fallback succeeded',
        {
          model:
            groqResult.model,
        }
      );


      return groqResult;
    }


    console.warn(
      '[intelligence-ai] Groq fallback failed:',
      groqResult.error
    );


    return {
      ...groqResult,

      error: [
        openRouterResult?.error,
        groqResult.error,
      ]
        .filter(Boolean)
        .join(' | '),
    };
  }


  /*
   * --------------------------------------------------------
   * NO PROVIDER AVAILABLE
   * --------------------------------------------------------
   */

  return {
    success: false,
    data: null,

    error:
      openRouterResult?.error ||
      'No Product Intelligence AI provider is configured. Set OPENROUTER_API_KEY or GROQ_API_KEY.',

    provider:
      openRouterResult?.provider ||
      'none',

    model:
      openRouterResult?.model ||
      'none',

    validationErrors:
      openRouterResult?.validationErrors ||
      [],

    parseError:
      openRouterResult?.parseError ||
      null,

    rawText:
      openRouterResult?.rawText ||
      null,

    rawResponse:
      openRouterResult?.rawResponse ||
      null,
  };
};


export default {
  generateProductIntelligenceJSON,
  generateOpenRouterJSON,
};