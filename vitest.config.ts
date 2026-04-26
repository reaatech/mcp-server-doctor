import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/index.ts', 'src/**/index.ts'],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 60,
        statements: 60,
      },
    },
  },
});
