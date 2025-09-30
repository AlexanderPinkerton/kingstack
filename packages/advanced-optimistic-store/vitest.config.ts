import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: [
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
