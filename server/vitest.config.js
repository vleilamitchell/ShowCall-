import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.{test,spec,int,unit}.ts'],
        setupFiles: ['src/test/setup.ts'],
        globals: true,
        singleThread: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage',
            all: false,
            thresholds: {
                lines: 80,
                statements: 80,
                branches: 80,
                functions: 80,
            },
        },
    },
});
