import { defineConfig } from 'vitest/config'
import codspeed from '@codspeed/vitest-plugin'
import { isCI } from 'std-env'

export default defineConfig({
  test: {
    coverage: {
      include: ['src/**'],
    },
  },
  plugins: isCI ? [codspeed()] : [],
})
