import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl =
  process.env.REDIS_URL ||
  'redis://127.0.0.1:6379';

const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const anonymousAnalysisQueue =
  new Queue('anonymous-analysis', {
    connection: redisConnection,

    defaultJobOptions: {
      attempts: 3,

      backoff: {
        type: 'exponential',
        delay: 2000,
      },

      removeOnComplete: {
        age: 60 * 60,
        count: 1000,
      },

      removeOnFail: {
        age: 24 * 60 * 60,
        count: 1000,
      },
    },
  });

export const enqueueAnonymousAnalysis = async ({
  profile,
  consent,
  sessionHash,
}) => {
  const job =
    await anonymousAnalysisQueue.add(
      'analyze',
      {
        profile,
        consent,
        sessionHash,
      },
      {
        jobId: `anon-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}`,
      }
    );

  return job;
};

export default anonymousAnalysisQueue;