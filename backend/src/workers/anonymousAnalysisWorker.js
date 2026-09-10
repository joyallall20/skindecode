import { Worker } from 'bullmq';
import IORedis from 'ioredis';

import {
  runAnonymousAnalysis,
} from '../services/anonymousAnalysisService.js';

import {
  saveAnonymousAnalysisResult,
  saveAnonymousAnalysisFailure,
} from '../services/anonymousAnalysisResultStore.js';

const redisUrl =
  process.env.REDIS_URL ||
  'redis://127.0.0.1:6379';

const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const concurrency = Math.max(
  1,
  Number(
    process.env.ANONYMOUS_ANALYSIS_CONCURRENCY ||
      5
  )
);

let worker = null;

export const startAnonymousAnalysisWorker = () => {
  if (worker) {
    console.log(
      '[ANON WORKER] Already running'
    );

    return worker;
  }

  worker = new Worker(
    'anonymous-analysis',

    async (job) => {
      console.log(
        `[ANON WORKER] Processing job ${job.id}`
      );

      const {
        profile,
        consent,
        sessionHash,
      } = job.data;

      try {
        const result =
          await runAnonymousAnalysis({
            profile,
            consent,
          });

        await saveAnonymousAnalysisResult({
          jobId: job.id,
          sessionHash,
          result,
        });

        console.log(
          `[ANON WORKER] Job ${job.id} completed`
        );

        return {
          status: 'completed',
        };
      } catch (error) {
        console.error(
          `[ANON WORKER] Job ${job.id} failed:`,
          error
        );

        await saveAnonymousAnalysisFailure({
          jobId: job.id,
          sessionHash,
          message:
            'We could not complete your skin analysis. Please try again.',
        });

        throw error;
      }
    },

    {
      connection: redisConnection,
      concurrency,
    }
  );

  worker.on(
    'completed',
    (job) => {
      console.log(
        `[ANON WORKER] Completed: ${job.id}`
      );
    }
  );

  worker.on(
    'failed',
    (job, error) => {
      console.error(
        `[ANON WORKER] Failed: ${job?.id}`,
        error?.message
      );
    }
  );

  worker.on(
    'error',
    (error) => {
      console.error(
        '[ANON WORKER] Worker error:',
        error
      );
    }
  );

  console.log(
    `[ANON WORKER] Started | concurrency=${concurrency}`
  );

  return worker;
};

export const stopAnonymousAnalysisWorker =
  async () => {
    if (!worker) {
      return;
    }

    await worker.close();

    worker = null;

    console.log(
      '[ANON WORKER] Stopped'
    );
  };

export default {
  startAnonymousAnalysisWorker,
  stopAnonymousAnalysisWorker,
};