import Redis from 'ioredis';

const redisUrl =
  process.env.REDIS_URL ||
  'redis://127.0.0.1:6379';

const redis = new Redis(redisUrl);

const RESULT_TTL = Math.max(
  60,
  Number(
    process.env.ANONYMOUS_ANALYSIS_RESULT_TTL ||
      900
  )
);

const resultKey = (jobId) =>
  `anonymous-analysis:result:${jobId}`;

export const saveAnonymousAnalysisResult =
  async ({
    jobId,
    sessionHash,
    result,
  }) => {
    const key = resultKey(jobId);

    const payload = {
      status: 'completed',
      sessionHash,
      result,
    };

    await redis.set(
      key,
      JSON.stringify(payload),
      'EX',
      RESULT_TTL
    );

    return key;
  };

export const saveAnonymousAnalysisFailure =
  async ({
    jobId,
    sessionHash,
    message,
  }) => {
    const key = resultKey(jobId);

    const payload = {
      status: 'failed',
      sessionHash,
      message:
        message ||
        'Anonymous analysis failed.',
    };

    await redis.set(
      key,
      JSON.stringify(payload),
      'EX',
      RESULT_TTL
    );

    return key;
  };

export const getAnonymousAnalysisResult =
  async (jobId) => {
    const key = resultKey(jobId);

    const value =
      await redis.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

export const closeAnonymousAnalysisResultStore =
  async () => {
    await redis.quit();
  };

export default {
  saveAnonymousAnalysisResult,
  saveAnonymousAnalysisFailure,
  getAnonymousAnalysisResult,
};