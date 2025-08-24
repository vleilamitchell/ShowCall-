import 'dotenv/config';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Ensure test-specific env variables can be loaded (user should add .env.test locally)
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Fake timers can be enabled here if needed
vi.useRealTimers();

// Global cleanup hooks can be extended later
beforeAll(async () => {
  // no-op for now; testDb will handle schema/migrations per file
});

afterEach(async () => {
  // place for per-test cleanup if needed later
});

afterAll(async () => {
  // place for global teardown
});


