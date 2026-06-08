import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts'],
  format: ['esm', 'cjs'],
  dts: { oxc: true },
  deps: {
    neverBundle: [
      'vite',
      '@vue/server-renderer',
    ],
  },
})
