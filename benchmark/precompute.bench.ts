import { describe } from 'vitest'
import { normalizeViteManifest, normalizeWebpackManifest } from '../src'
import { precomputeDependencies } from '../src/precompute'
import { bench, sink } from './_harness'
import { buildSyntheticManifest } from './_synthetic'

import viteManifest from '../test/fixtures/vite-manifest.json'
import webpackManifest from '../test/fixtures/webpack-manifest.json'
import largeViteManifest from './fixtures/large-vite-manifest.json'

const normalizedVite = normalizeViteManifest(viteManifest)
const normalizedWebpack = normalizeWebpackManifest(webpackManifest)
const normalizedLargeVite = normalizeViteManifest(largeViteManifest)
const syntheticMedium = buildSyntheticManifest({ components: 200, pages: 500 })
const syntheticLarge = buildSyntheticManifest({ components: 2000, pages: 5000 })

describe('precomputeDependencies', () => {
  bench(`fixture: vite (${Object.keys(normalizedVite).length} entries)`, () => {
    sink(precomputeDependencies(normalizedVite))
  })

  bench(`fixture: webpack (${Object.keys(normalizedWebpack).length} entries)`, () => {
    sink(precomputeDependencies(normalizedWebpack))
  })

  bench(`fixture: large vite (${Object.keys(normalizedLargeVite).length} entries)`, () => {
    sink(precomputeDependencies(normalizedLargeVite))
  })

  bench(`synthetic: 200 components / 500 pages (${Object.keys(syntheticMedium).length} entries)`, () => {
    sink(precomputeDependencies(syntheticMedium))
  })

  bench(`synthetic: 2000 components / 5000 pages (${Object.keys(syntheticLarge).length} entries)`, () => {
    sink(precomputeDependencies(syntheticLarge))
  }, { heavy: true })
})
