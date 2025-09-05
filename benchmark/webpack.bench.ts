import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bench, describe } from 'vitest'
import { normalizeWebpackManifest, type WebpackClientManifest } from '../src/webpack'

// Load test fixtures
const smallWebpackManifest = JSON.parse(
  readFileSync(resolve(__dirname, '../test/fixtures/webpack-manifest.json'), 'utf-8'),
) as WebpackClientManifest

const largeWebpackManifest = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/large-webpack-manifest.json'), 'utf-8'),
) as WebpackClientManifest

describe('Webpack Manifest Normalization Benchmarks', () => {
  bench('normalize small Webpack manifest', () => {
    normalizeWebpackManifest(smallWebpackManifest)
  })

  bench('normalize large Webpack manifest', () => {
    normalizeWebpackManifest(largeWebpackManifest)
  })

  bench('normalize small Webpack manifest (100 iterations)', () => {
    for (let i = 0; i < 100; i++) {
      normalizeWebpackManifest(smallWebpackManifest)
    }
  })

  bench('normalize large Webpack manifest (10 iterations)', () => {
    for (let i = 0; i < 10; i++) {
      normalizeWebpackManifest(largeWebpackManifest)
    }
  })
})

// Benchmark with different manifest sizes
describe('Webpack Manifest Size Scaling', () => {
  // Generate manifests of different sizes
  const generateManifest = (entryCount: number): WebpackClientManifest => {
    const all: string[] = ['runtime.js', 'commons/app.js', 'app.css', 'app.js']
    const async: string[] = []
    const modules: Record<string, number[]> = {}

    // Add entries
    for (let i = 0; i < entryCount; i++) {
      const jsFile = `pages/page-${i}.js`
      const cssFile = `pages/page-${i}.css`
      const assetFile = `assets/asset-${i}.png`

      all.push(jsFile, cssFile, assetFile)
      async.push(jsFile, cssFile)

      // Create module mapping
      modules[`module-${i}`] = [all.length - 3, all.length - 2] // JS and CSS indices
    }

    return {
      publicPath: '/_nuxt/',
      all,
      initial: ['runtime.js', 'commons/app.js', 'app.css', 'app.js'],
      async,
      modules,
    }
  }

  const manifest5 = generateManifest(5)
  bench('normalize 5 entries', () => {
    normalizeWebpackManifest(manifest5)
  })

  const manifest25 = generateManifest(25)
  bench('normalize 25 entries', () => {
    normalizeWebpackManifest(manifest25)
  })

  const manifest50 = generateManifest(50)
  bench('normalize 50 entries', () => {
    normalizeWebpackManifest(manifest50)
  })

  const manifest100 = generateManifest(100)
  bench('normalize 100 entries', () => {
    normalizeWebpackManifest(manifest100)
  })
})
