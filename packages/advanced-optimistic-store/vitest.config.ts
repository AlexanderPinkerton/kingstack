import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: [
      '__tests__/**/*.test.ts',
      '__tests__/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
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
