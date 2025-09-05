import { bench, describe } from 'vitest'
import { normalizeWebpackManifest, type WebpackClientManifest } from '../src/webpack'

import smallWebpackManifest from '../test/fixtures/webpack-manifest.json'
import largeWebpackManifest from './fixtures/large-webpack-manifest.json'

describe('normalizeWebpackManifest', () => {
  bench('small', () => {
    normalizeWebpackManifest(smallWebpackManifest)
  })

  bench('large', () => {
    normalizeWebpackManifest(largeWebpackManifest)
  })
})

// Benchmark with different manifest sizes
describe('normalizeWebpackManifest scaling', () => {
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
  bench('5 entries', () => {
    normalizeWebpackManifest(manifest5)
  })

  const manifest25 = generateManifest(25)
  bench('25 entries', () => {
    normalizeWebpackManifest(manifest25)
  })

  const manifest50 = generateManifest(50)
  bench('50 entries', () => {
    normalizeWebpackManifest(manifest50)
  })

  const manifest100 = generateManifest(100)
  bench('100 entries', () => {
    normalizeWebpackManifest(manifest100)
  })
})
