
import { Queue } from 'bullmq';

const redisUrl =
  process.env.REDIS_URL ||
  'redis://127.0.0.1:6379';

export const anonymousAnalysisQueue =
  new Queue('anonymous-analysis', {
    connection: {
      url: redisUrl,
    },

    defaultJobOptions: {
      attempts: 2,

      backoff: {
        type: 'exponential',
        delay: 2000,
      },

      removeOnComplete: true,
      removeOnFail: true,
    },
  });

export const enqueueAnonymousAnalysis = async ({
  profile,
  consent,
  sessionHash,
}) => {
  const job = await anonymousAnalysisQueue.add(
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

