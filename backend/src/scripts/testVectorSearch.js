import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

import {
  generateQueryEmbedding,
  getEmbeddingConfig,
} from '../services/embeddingService.js';

import SkinKnowledgeChunk from '../models/SkinKnowledgeChunk.js';

async function main() {
  console.log('\n========================================');
  console.log(' skinDecode Vector Search Test');
  console.log('========================================\n');

  console.log('Embedding config:');
  console.log(getEmbeddingConfig());

  await mongoose.connect(process.env.MONGODB_URI);

  console.log('\nMongoDB connected.');

  const query = 'UVB sunscreen filter';

  console.log(`\nQuery: "${query}"`);

  const queryVector = await generateQueryEmbedding(query);

  console.log(
    `Query vector dimensions: ${queryVector.length}`
  );

  if (queryVector.length !== 384) {
    throw new Error(
      `Expected 384 dimensions, received ${queryVector.length}`
    );
  }

  const indexName =
    process.env.SKIN_KNOWLEDGE_VECTOR_INDEX;

  console.log(`Atlas index: ${indexName}`);

  const results = await SkinKnowledgeChunk.aggregate([
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector: queryVector,
        numCandidates: 50,
        limit: 5,
        filter: {
          isActive: true,
          researchStatus: 'verified',
        },
      },
    },
    {
      $project: {
        _id: 1,
        chunkKey: 1,
        category: 1,
        sourceType: 1,
        text: 1,
        score: {
          $meta: 'vectorSearchScore',
        },
      },
    },
  ]);

  console.log(`\nResults found: ${results.length}\n`);

  results.forEach((result, index) => {
    console.log(`========== RESULT ${index + 1} ==========`);

    console.log('chunkKey:', result.chunkKey);
    console.log('category:', result.category);
    console.log('sourceType:', result.sourceType);
    console.log('score:', result.score);

    console.log(
      'text:',
      result.text
        ? result.text.substring(0, 500)
        : '(no text)'
    );

    console.log('');
  });

  await mongoose.disconnect();

  console.log('========================================');
  console.log(' Vector Search Test Complete');
  console.log('========================================\n');
}

main().catch(async (error) => {
  console.error('\n❌ Vector search test failed:');
  console.error(error);

  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors.
  }

  process.exitCode = 1;
});