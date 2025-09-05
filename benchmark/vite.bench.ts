import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bench, describe } from 'vitest'
import { normalizeViteManifest } from '../src/vite'
import type { Manifest as ViteManifest } from 'vite'

// Load test fixtures
const smallViteManifest = JSON.parse(
  readFileSync(resolve(__dirname, '../test/fixtures/vite-manifest.json'), 'utf-8'),
) as ViteManifest

const largeViteManifest = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/large-vite-manifest.json'), 'utf-8'),
) as ViteManifest

describe('Vite Manifest Normalization Benchmarks', () => {
  bench('normalize small Vite manifest', () => {
    normalizeViteManifest(smallViteManifest)
  })

  bench('normalize large Vite manifest', () => {
    normalizeViteManifest(largeViteManifest)
  })

  // Create a very complex manifest with deep nesting
  const createComplexViteManifest = (): ViteManifest => {
    const manifest: ViteManifest = {
      'main.ts': {
        file: 'main.js',
        src: 'main.ts',
        isEntry: true,
        imports: ['_vendor.js', '_polyfills.js'],
        css: ['main.css', 'global.css'],
        dynamicImports: [],
        assets: ['logo.svg', 'favicon.ico'],
      },
    }

    // Create nested structure
    for (let i = 0; i < 20; i++) {
      const pageKey = `pages/page-${i}.vue`
      manifest[pageKey] = {
        file: `pages/page-${i}.js`,
        src: pageKey,
        isDynamicEntry: true,
        imports: ['_vendor.js'],
        css: [`pages/page-${i}.css`],
        dynamicImports: [],
        assets: [`pages/assets/bg-${i}.jpg`],
      }

      // Add components for each page
      for (let j = 0; j < 5; j++) {
        const componentKey = `components/page-${i}/comp-${j}.vue`
        manifest[componentKey] = {
          file: `components/page-${i}/comp-${j}.js`,
          src: componentKey,
          isDynamicEntry: true,
          imports: ['_vendor.js'],
          css: [`components/page-${i}/comp-${j}.css`],
        }
        manifest[pageKey].dynamicImports!.push(componentKey)
      }

      manifest['main.ts'].dynamicImports!.push(pageKey)
    }

    return manifest
  }

  const complexViteManifest = createComplexViteManifest()

  bench('normalize complex nested Vite manifest', () => {
    normalizeViteManifest(complexViteManifest)
  })
})

// Benchmark with different manifest sizes
describe('Vite Manifest Size Scaling', () => {
  // Generate manifests of different sizes
  const generateManifest = (entryCount: number): ViteManifest => {
    const manifest: ViteManifest = {}

    // Add main entry
    manifest['main.ts'] = {
      file: 'main.js',
      src: 'main.ts',
      isEntry: true,
      imports: ['_vendor.js'],
      css: ['main.css'],
      dynamicImports: [],
      assets: [],
    }

    // Add entries
    for (let i = 0; i < entryCount; i++) {
      const key = `page-${i}.vue`
      manifest[key] = {
        file: `page-${i}.js`,
        src: key,
        isDynamicEntry: true,
        imports: ['_vendor.js'],
        css: [`page-${i}.css`],
        assets: [`asset-${i}.png`],
      }
      manifest['main.ts'].dynamicImports!.push(key)
    }

    return manifest
  }

  const manifest5 = generateManifest(5)
  bench('normalize 5 entries', () => {
    normalizeViteManifest(manifest5)
  })

  const manifest25 = generateManifest(25)
  bench('normalize 25 entries', () => {
    normalizeViteManifest(manifest25)
  })

  const manifest50 = generateManifest(50)
  bench('normalize 50 entries', () => {
    normalizeViteManifest(manifest50)
  })

  const manifest100 = generateManifest(100)
  bench('normalize 100 entries', () => {
    normalizeViteManifest(manifest100)
  })
})
