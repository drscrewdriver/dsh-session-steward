import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['tests/**/*.spec.ts'],
    pool: 'threads',
    environment: 'node',
    testTimeout: 15_000,
  },
})
