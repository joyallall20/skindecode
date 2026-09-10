// scripts/test-skin-knowledge-rag.js

import "dotenv/config";
import mongoose from "mongoose";
import { retrieveSkinKnowledge } from "../src/services/skinKnowledgeRagService.js";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL;

const questions = [
  "What ingredients are effective for acne?",
  "What ingredients are good for pigmentation?",
  "What ingredients are suitable for sensitive skin?",
];

async function main() {
  console.log("========================================");
  console.log("skinDecode Knowledge RAG Test");
  console.log("========================================\n");

  if (!MONGODB_URI) {
    throw new Error(
      "Missing MONGODB_URI, MONGO_URI, or DATABASE_URL in environment."
    );
  }

  await mongoose.connect(MONGODB_URI);

  console.log("MongoDB connected.\n");

  for (const question of questions) {
    console.log("----------------------------------------");
    console.log(`QUESTION: ${question}`);
    console.log("----------------------------------------");

    try {
      const result = await retrieveSkinKnowledge(question, {
        limit: 8,
        minScore: 0,
      });

      console.log(`Retrieved: ${result.results.length} chunks\n`);

      if (!result.results.length) {
        console.log("NO RESULTS\n");
        continue;
      }

      result.results.forEach((item, index) => {
        console.log(`${index + 1}. ${item.ingredientName || "Unknown"}`);
        console.log(`   Ingredient Key: ${item.ingredientKey || "N/A"}`);
        console.log(`   Chunk Type: ${item.chunkType || "N/A"}`);
        console.log(`   Concern: ${item.concern || "General"}`);
        console.log(`   Skin Type: ${item.skinType || "General"}`);
        console.log(
          `   Score: ${
            typeof item.score === "number"
              ? item.score.toFixed(4)
              : "N/A"
          }`
        );
        console.log(`   Evidence: ${item.evidenceLevel || "N/A"}`);
        console.log(`   Flag: ${item.generalFlag || "N/A"}`);
        console.log(
          `   Confidence: ${
            typeof item.confidence === "number"
              ? item.confidence
              : "N/A"
          }`
        );

        const text = item.text || "";
        console.log(
          `   Knowledge: ${
            text.length > 350 ? `${text.slice(0, 350)}...` : text
          }`
        );

        console.log("");
      });

      console.log("GPT CONTEXT:");
      console.log("----------------------------------------");
      console.log(result.context);
      console.log("");
    } catch (error) {
      console.error("RAG ERROR:", error.message);
      console.error("");
    }
  }

  await mongoose.disconnect();

  console.log("========================================");
  console.log("RAG test completed");
  console.log("========================================");
}

main().catch(async (error) => {
  console.error("\nFatal error:", error);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  process.exit(1);
});