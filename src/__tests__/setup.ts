/**
 * Vitest Setup File
 *
 * Global test configuration and environment setup
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test environment variables
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.env as any).NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.REDIS_URL = 'redis://localhost:6379';
});

// Cleanup after all tests
afterAll(() => {
  // Add any global cleanup here
});

// Reset mocks before each test
beforeEach(() => {
  // Add any per-test setup here
});
