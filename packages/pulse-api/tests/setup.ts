// Stub env vars so config.loadConfig() succeeds in tests.
// Tests that need a real DB/Redis should override these.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET ??= "test-jwt-secret-min-32-chars-aaaaaaaaaaaaa";
process.env.REDIS_HOST ??= "localhost";
process.env.REDIS_PORT ??= "6379";
process.env.NODE_ENV ??= "test";
process.env.LOG_LEVEL ??= "silent";
