import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: [
      '__tests__/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist'],
    globals: true,
    environment: 'node',
    reporters: [
      [
        'default',
        {
          summary: false
        }
      ]
    ],
  },
})
