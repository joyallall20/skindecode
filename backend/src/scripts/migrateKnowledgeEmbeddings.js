import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import SkinKnowledgeChunk from '../models/SkinKnowledgeChunk.js';
import {
  generateDocumentEmbedding,
  getEmbeddingConfig,
} from '../services/embeddingService.js';

const BATCH_SIZE = 10;
const EXPECTED_DIMENSIONS = 384;
const EXPECTED_MODEL = 'BAAI/bge-small-en-v1.5';

function needsMigrationFilter() {
  return {
    $or: [
      {
        $expr: {
          $ne: [
            {
              $size: {
                $ifNull: ['$embedding', []],
              },
            },
            EXPECTED_DIMENSIONS,
          ],
        },
      },
      {
        embeddingModel: {
          $ne: EXPECTED_MODEL,
        },
      },
      {
        embeddingDimensions: {
          $ne: EXPECTED_DIMENSIONS,
        },
      },
    ],
  };
}

async function migrate() {
  console.log('\n========================================');
  console.log(' skinDecode Knowledge Embedding Migration');
  console.log('========================================\n');

  const config = getEmbeddingConfig();

  console.log('Embedding configuration:');
  console.log(`  Provider:    ${config.provider}`);
  console.log(`  Model:       ${config.model}`);
  console.log(`  Dimensions:  ${config.dimensions}`);
  console.log(`  Service URL: ${config.serviceUrl}\n`);

  if (config.dimensions !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `Expected ${EXPECTED_DIMENSIONS} dimensions, but configuration reports ${config.dimensions}`
    );
  }

  if (config.model !== EXPECTED_MODEL) {
    throw new Error(
      `Expected ${EXPECTED_MODEL}, but configuration reports ${config.model}`
    );
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured.');
  }

  await mongoose.connect(mongoUri);

  console.log('MongoDB connected.\n');

  const total = await SkinKnowledgeChunk.countDocuments({});

  const migrationFilter = needsMigrationFilter();

  const needsMigration =
    await SkinKnowledgeChunk.countDocuments(migrationFilter);

  console.log(`Total knowledge documents: ${total}`);
  console.log(`Documents requiring migration: ${needsMigration}\n`);

  if (needsMigration === 0) {
    console.log('Nothing needs migration.');

    await verifyCollection();

    await mongoose.disconnect();
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  const cursor = SkinKnowledgeChunk.find(migrationFilter)
    .select(
      '_id chunkKey text embeddingModel embeddingDimensions category sourceType'
    )
    .lean()
    .cursor();

  let batch = [];

  for await (const doc of cursor) {
    batch.push(doc);

    if (batch.length >= BATCH_SIZE) {
      const result = await processBatch(batch);

      processed += result.processed;
      succeeded += result.succeeded;
      failed += result.failed;

      printProgress(
        processed,
        needsMigration,
        succeeded,
        failed
      );

      batch = [];
    }
  }

  if (batch.length > 0) {
    const result = await processBatch(batch);

    processed += result.processed;
    succeeded += result.succeeded;
    failed += result.failed;

    printProgress(
      processed,
      needsMigration,
      succeeded,
      failed
    );
  }

  console.log('\n========================================');
  console.log(' Migration finished');
  console.log('========================================');
  console.log(`Processed: ${processed}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed:    ${failed}\n`);

  await verifyCollection();

  await mongoose.disconnect();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function processBatch(batch) {
  let succeeded = 0;
  let failed = 0;

  for (const doc of batch) {
    try {
      if (!doc.text || !doc.text.trim()) {
        throw new Error('Document has no text to embed.');
      }

      console.log(
        `Embedding ${doc.chunkKey || doc._id}...`
      );

      const embedding = await generateDocumentEmbedding(
        doc.text
      );

      if (!Array.isArray(embedding)) {
        throw new Error(
          'Embedding response is not an array.'
        );
      }

      if (embedding.length !== EXPECTED_DIMENSIONS) {
        throw new Error(
          `Expected ${EXPECTED_DIMENSIONS} dimensions, received ${embedding.length}.`
        );
      }

      await SkinKnowledgeChunk.updateOne(
        { _id: doc._id },
        {
          $set: {
            embedding,
            embeddingModel: EXPECTED_MODEL,
            embeddingDimensions: EXPECTED_DIMENSIONS,
          },
        }
      );

      succeeded++;

      console.log(
        `✓ ${doc.chunkKey || doc._id} → ${EXPECTED_DIMENSIONS} dimensions`
      );
    } catch (error) {
      failed++;

      console.error(
        `✗ ${doc.chunkKey || doc._id}: ${error.message}`
      );
    }
  }

  return {
    processed: batch.length,
    succeeded,
    failed,
  };
}

async function verifyCollection() {
  console.log('\n========================================');
  console.log(' Verifying vector dimensions');
  console.log('========================================\n');

  const dimensions = await SkinKnowledgeChunk.aggregate([
    {
      $project: {
        dimensions: {
          $size: {
            $ifNull: ['$embedding', []],
          },
        },
      },
    },
    {
      $group: {
        _id: '$dimensions',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  console.table(dimensions);

  const invalid = await SkinKnowledgeChunk.countDocuments({
    $expr: {
      $ne: [
        {
          $size: {
            $ifNull: ['$embedding', []],
          },
        },
        EXPECTED_DIMENSIONS,
      ],
    },
  });

  console.log(
    `Documents without exactly ${EXPECTED_DIMENSIONS} dimensions: ${invalid}`
  );

  const correctModel =
    await SkinKnowledgeChunk.countDocuments({
      embeddingModel: EXPECTED_MODEL,
      embeddingDimensions: EXPECTED_DIMENSIONS,
    });

  console.log(
    `Documents using ${EXPECTED_MODEL}: ${correctModel}`
  );

  if (invalid === 0) {
    console.log(
      '\n✓ ALL DOCUMENTS HAVE 384-DIMENSION VECTORS'
    );
  } else {
    console.log(
      `\n⚠ ${invalid} documents still need attention`
    );
  }
}

function printProgress(
  processed,
  total,
  succeeded,
  failed
) {
  const percentage =
    total > 0
      ? ((processed / total) * 100).toFixed(1)
      : '100.0';

  console.log(
    `\nProgress: ${processed}/${total} (${percentage}%) | ` +
    `Success: ${succeeded} | Failed: ${failed}\n`
  );
}

migrate().catch(async (error) => {
  console.error('\nMigration failed:');
  console.error(error);

  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors.
  }

  process.exitCode = 1;
});