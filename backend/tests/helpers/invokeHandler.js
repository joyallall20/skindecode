import ApiError from '../../src/utils/ApiError.js';

/**
 * Invoke an express asyncHandler-wrapped controller directly.
 */
export const invokeHandler = async (handler, {
  params = {},
  body = {},
  query = {},
  user = null,
  headers = {},
  file = undefined,
  services = undefined,
} = {}) => {
  const req = {
    params,
    body,
    query,
    user,
    headers,
    file,
    services,
  };

  let statusCode = 200;
  let payload;
  let responded = false;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      payload = data;
      responded = true;
      return res;
    },
  };

  try {
    await new Promise((resolve, reject) => {
      const next = (err) => {
        if (err) reject(err);
      };

      const originalJson = res.json;
      res.json = (data) => {
        originalJson(data);
        resolve();
      };

      handler(req, res, next);
    });
  } catch (error) {
    const code = error instanceof ApiError ? error.statusCode : 500;
    return {
      statusCode: code,
      body: { success: false, message: error.message },
      error,
      responded,
    };
  }

  if (!responded) {
    return {
      statusCode: 500,
      body: { success: false, message: 'Handler completed without sending a response.' },
      responded,
    };
  }

  return { statusCode, body: payload, responded };
};

export default { invokeHandler };
