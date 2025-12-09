/**
 * Vitest Setup File
 *
 * Global test configuration and environment setup
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test environment variables
beforeAll(() => {
  // Set environment variables for tests
  Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-for-unit-tests-only',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  });
});

// Cleanup after all tests
afterAll(() => {
  // Add any global cleanup here
});

// Reset mocks before each test
beforeEach(() => {
  // Add any per-test setup here
});
