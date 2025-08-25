import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/integration/**/*.int.ts'],
    setupFiles: ['src/test/setup.ts'],
    globals: true,
    singleThread: true,
    maxConcurrency: 1,
    poolOptions: {
      threads: { singleThread: true, maxThreads: 1, minThreads: 1 },
      forks: { singleFork: true, maxForks: 1, minForks: 1 },
    },
  },
});
