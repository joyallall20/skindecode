import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import ApiError from '../../src/utils/ApiError.js';
import { ensureActiveUser } from '../../src/middleware/authMiddleware.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { createInactiveUser, createAdminUser } from '../helpers/fixtures.js';

describe('inactive user authentication guard', () => {
  before(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('rejects inactive users with 403', async () => {
    const inactiveUser = await createInactiveUser();

    assert.throws(
      () => ensureActiveUser(inactiveUser),
      (error) => error instanceof ApiError && error.statusCode === 403
    );
  });

  it('allows active users through the guard', async () => {
    const admin = await createAdminUser();
    assert.equal(ensureActiveUser(admin), undefined);
  });
});
