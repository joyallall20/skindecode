// src/services/chatIntentService.js
//
// Fast, deterministic intent detection for skinDecode chat.
//
// IMPORTANT:
// This file intentionally does NOT use:
// - MongoDB
// - Groq
// - Gemini
// - RAG
// - embeddings
//
// The purpose is to handle simple conversational messages instantly.
//
// Supported examples:
//
// English:
//   hi
//   hello
//   hey
//   good morning
//   good evening
//   thanks
//   thank you
//   bye
//   good night
//
// Hindi / Hinglish:
//   namaste
//   namaskar
//   kese ho
//   kaise ho
//   kaise hain
//   kya haal hai
//   kya chal raha hai
//   sab theek hai
//   sab thik hai
//   badhiya
//   shukriya
//   dhanyavaad
//
// The detector is intentionally conservative.
// It should NEVER classify a real skincare question as a greeting.


// ============================================================
// NORMALIZATION
// ============================================================

export function normalizeIntentText(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s!?'.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ============================================================
// GREETING PHRASES
// ============================================================

const GREETING_PHRASES = [
  // English
  "hi",
  "hello",
  "hey",
  "heya",
  "hiya",
  "howdy",

  // Repeated casual greetings
  "hii",
  "hiii",
  "hiiii",
  "helloo",
  "hellooo",
  "heyy",
  "heyyy",

  // Hindi
  "namaste",
  "namaskar",
  "namaskaar",

  // Hinglish
  "kese ho",
  "kaise ho",
  "kaise hain",
  "kaisi ho",
  "kaisi hain",

  "kya haal hai",
  "kya haal hain",
  "kya chal raha hai",
  "kya chal rha hai",

  "sab theek hai",
  "sab thik hai",
  "sab theek",
  "sab thik",

  "badhiya",
  "badiya",
  "mast",
  "theek ho",
  "thik ho",

  // Time-based greetings
  "good morning",
  "good afternoon",
  "good evening",
  "good night",
];


// ============================================================
// THANKS
// ============================================================

const THANKS_PHRASES = [
  "thanks",
  "thank you",
  "thankyou",
  "thanks a lot",
  "thank you so much",
  "thx",
  "ty",

  // Hindi / Hinglish
  "shukriya",
  "bahut shukriya",
  "dhanyavaad",
  "dhanyavad",
];


// ============================================================
// GOODBYE
// ============================================================

const GOODBYE_PHRASES = [
  "bye",
  "goodbye",
  "good bye",
  "see you",
  "see ya",
  "take care",
  "talk to you later",
  "ttyl",

  // Hinglish
  "fir milte hain",
  "phir milte hain",
  "milte hain",
];


// ============================================================
// CASUAL WELL-BEING QUESTIONS
// ============================================================

const WELL_BEING_PHRASES = [
  "how are you",
  "how r you",
  "how are u",
  "how r u",

  "how have you been",
  "how is it going",
  "how's it going",
  "hows it going",

  // Hinglish
  "kese ho",
  "kaise ho",
  "kaise hain",
  "kaisi ho",
  "kaisi hain",

  "kya haal hai",
  "kya haal hain",

  "kya chal raha hai",
  "kya chal rha hai",

  "sab theek hai",
  "sab thik hai",
];


// ============================================================
// SIMPLE GREETING MATCHING
// ============================================================

function matchesExactPhrase(text, phrases) {
  return phrases.some((phrase) => text === phrase);
}


// ============================================================
// REPETITIVE GREETING DETECTION
// ============================================================
//
// Handles things like:
//
// hi!!!
// hello :)
// hiiii
// hey skinDecode
//
// But stays conservative so:
//
// "hi what does niacinamide do?"
// is NOT treated as a greeting.
//

function looksLikeSimpleGreeting(text) {
  if (!text) {
    return false;
  }

  // Remove common punctuation.
  const cleaned = text
    .replace(/[!?.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return false;
  }

  // Exact phrase.
  if (matchesExactPhrase(cleaned, GREETING_PHRASES)) {
    return true;
  }

  // Very short "hi/hello/hey" variants.
  if (
    /^(hi+|hey+|heya+|hiya+|hello+|holla+)$/.test(
      cleaned
    )
  ) {
    return true;
  }

  // Greeting + skinDecode name.
  if (
    /^(hi+|hey+|hello+)\s+(skindecode|skin\s*decode)$/.test(
      cleaned
    )
  ) {
    return true;
  }

  return false;
}


// ============================================================
// INTENT DETECTION
// ============================================================

export function detectChatIntent(value) {
  const text = normalizeIntentText(value);

  if (!text) {
    return {
      intent: "empty",
      text,
    };
  }

  // ----------------------------------------------------------
  // GREETING
  // ----------------------------------------------------------

  if (
    looksLikeSimpleGreeting(text) ||
    matchesExactPhrase(text, WELL_BEING_PHRASES)
  ) {
    return {
      intent: "greeting",
      text,
    };
  }

  // ----------------------------------------------------------
  // THANKS
  // ----------------------------------------------------------

  if (matchesExactPhrase(text, THANKS_PHRASES)) {
    return {
      intent: "thanks",
      text,
    };
  }

  // ----------------------------------------------------------
  // GOODBYE
  // ----------------------------------------------------------

  if (matchesExactPhrase(text, GOODBYE_PHRASES)) {
    return {
      intent: "goodbye",
      text,
    };
  }

  return {
    intent: "unknown",
    text,
  };
}


// ============================================================
// FAST RESPONSE
// ============================================================
//
// These responses are intentionally short.
//
// Do not call an LLM for these.
//
// The slight variation keeps the assistant from sounding
// completely robotic while remaining deterministic.
//

const GREETING_RESPONSES = [
  "Hi! 👋 I’m skinDecode. How can I help with your skincare today?",
  "Hey! 👋 I’m skinDecode. What would you like to know about skincare?",
  "Hi! 👋 What can I help you with today?",
];

const THANKS_RESPONSES = [
  "You're very welcome! 😊",
  "Anytime! 😊",
  "You're welcome! Let me know if you want to explore anything else.",
];

const GOODBYE_RESPONSES = [
  "Bye! 👋 Take care of your skin.",
  "See you! 👋",
  "Take care! 👋 Come back anytime.",
];


// ============================================================
// DETERMINISTIC RESPONSE
// ============================================================

function pickResponse(responses, text) {
  // Deterministic selection based on message length.
  // This avoids randomness during testing while still giving
  // some variation.
  const index = text.length % responses.length;

  return responses[index];
}


export function getInstantChatResponse(intent, text = "") {
  switch (intent) {
    case "greeting":
      return pickResponse(
        GREETING_RESPONSES,
        text
      );

    case "thanks":
      return pickResponse(
        THANKS_RESPONSES,
        text
      );

    case "goodbye":
      return pickResponse(
        GOODBYE_RESPONSES,
        text
      );

    default:
      return null;
  }
}


// ============================================================
// MAIN FAST PATH
// ============================================================

export function getInstantChatResult(value) {
  const detected = detectChatIntent(value);

  if (
    detected.intent === "greeting" ||
    detected.intent === "thanks" ||
    detected.intent === "goodbye"
  ) {
    return {
      handled: true,
      intent: detected.intent,
      answer: getInstantChatResponse(
        detected.intent,
        detected.text
      ),
    };
  }

  return {
    handled: false,
    intent: detected.intent,
    answer: null,
  };
}


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
  normalizeIntentText,
  detectChatIntent,
  getInstantChatResponse,
  getInstantChatResult,
};