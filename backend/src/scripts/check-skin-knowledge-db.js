import "dotenv/config";
import mongoose from "mongoose";
import SkinKnowledgeChunk from "../src/models/SkinKnowledgeChunk.js";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL;

async function main() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI / MONGO_URI / DATABASE_URL");
  }

  await mongoose.connect(MONGODB_URI);

  console.log("\n========================================");
  console.log("Skin Knowledge DB Check");
  console.log("========================================\n");

  const total = await SkinKnowledgeChunk.countDocuments();
  const active = await SkinKnowledgeChunk.countDocuments({
    isActive: true,
  });

  const withEmbeddings = await SkinKnowledgeChunk.countDocuments({
    isActive: true,
    embedding: { $exists: true, $type: "array" },
  });

  console.log("Total chunks:", total);
  console.log("Active chunks:", active);
  console.log("Chunks with embeddings:", withEmbeddings);

  const sample = await SkinKnowledgeChunk.findOne({
    isActive: true,
    embedding: { $exists: true, $type: "array" },
  })
    .select(
      "ingredientName ingredientKey chunkType embeddingDimensions embedding"
    )
    .lean();

  if (!sample) {
    console.log("\n❌ No embedded chunks found.");
    return;
  }

  console.log("\nSample document:");
  console.log({
    ingredientName: sample.ingredientName,
    ingredientKey: sample.ingredientKey,
    chunkType: sample.chunkType,
    embeddingDimensions: sample.embeddingDimensions,
    actualEmbeddingLength: sample.embedding?.length,
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("\n❌ ERROR:", error);
  await mongoose.disconnect();
  process.exit(1);
});