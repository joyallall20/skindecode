import '../src/config/env.js';
import connectDB from '../src/config/db.js';
import { importIngredientKnowledgeFromJson, loadKnowledgeSeedFile } from '../src/services/ingredientKnowledgeService.js';

const run = async () => {
  const preview = await loadKnowledgeSeedFile();
  console.log(`Seed JSON: ${preview.ingredients.length} ingredients, valid=${preview.valid}`);
  if (!preview.valid) {
    console.error(preview.errors);
    process.exit(1);
  }
  await connectDB();
  const result = await importIngredientKnowledgeFromJson({ overwrite: process.argv.includes('--overwrite') });
  console.log(result);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
