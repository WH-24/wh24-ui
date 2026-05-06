import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test-setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
