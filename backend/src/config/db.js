import mongoose from 'mongoose';
import { seedIngredientKnowledgeIfEmpty } from '../services/ingredientKnowledgeService.js';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/consensuschoice';

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
    try {
      await seedIngredientKnowledgeIfEmpty();
    } catch (seedError) {
      console.error('[knowledge] initial seed failed', seedError.message);
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
