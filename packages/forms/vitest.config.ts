import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Тесты идут по ИСХОДНИКАМ ui-react, а не по dist: корневой `tsc -b` в
    // CI не копирует CSS-модули в dist (см. CLAUDE.md, ГРАБЛИ №1), и импорт
    // `@wowhaus-24/ui-react` из dist падал на `./X.module.css`.
    alias: {
      '@wowhaus-24/ui-react': path.resolve(__dirname, '../react/src/index.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test-setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
