import { describe } from 'vitest'
import { normalizeViteManifest, normalizeWebpackManifest } from '../src'
import { precomputeDependencies } from '../src/precompute'
import { bench, sink } from './_harness'
import { fullRequest, makeContext } from './_renderer'
import { buildFixedSizeSetPool, buildSyntheticManifest } from './_synthetic'

import viteManifest from '../test/fixtures/vite-manifest.json'
import webpackManifest from '../test/fixtures/webpack-manifest.json'
import largeViteManifest from './fixtures/large-vite-manifest.json'

const syntheticManifest = buildSyntheticManifest({ components: 2000, pages: 5000 })
const syntheticPrecomputed = precomputeDependencies(syntheticManifest)

const normalizedVite = normalizeViteManifest(viteManifest)
const normalizedWebpack = normalizeWebpackManifest(webpackManifest)
const normalizedLargeVite = normalizeViteManifest(largeViteManifest)

describe('createRenderer', () => {
  const CREATE_BATCH = 100
  bench(`manifest: vite fixture, ${Object.keys(normalizedVite).length} entries (x${CREATE_BATCH})`, () => {
    for (let i = 0; i < CREATE_BATCH; i++) {
      sink(makeContext({ manifest: normalizedVite }))
    }
  })

  bench(`manifest: webpack fixture, ${Object.keys(normalizedWebpack).length} entries (x${CREATE_BATCH})`, () => {
    for (let i = 0; i < CREATE_BATCH; i++) {
      sink(makeContext({ manifest: normalizedWebpack }))
    }
  })

  bench(`manifest: large vite fixture, ${Object.keys(normalizedLargeVite).length} entries (x${CREATE_BATCH})`, () => {
    for (let i = 0; i < CREATE_BATCH; i++) {
      sink(makeContext({ manifest: normalizedLargeVite }))
    }
  })

  bench(`manifest: synthetic, ${Object.keys(syntheticManifest).length} entries`, () => {
    sink(makeContext({ manifest: syntheticManifest }))
  }, { heavy: true })
})

// Manifest contexts resolve dependencies lazily, so startup is where they differ from precomputed.
describe('startup: createRenderer + first full request', () => {
  const STARTUP_BATCH = 8
  const pool = buildFixedSizeSetPool(syntheticManifest, 10, STARTUP_BATCH, 1347)

  bench(`precomputed: synthetic, ${STARTUP_BATCH} cold contexts`, () => {
    for (let i = 0; i < pool.length; i++) {
      fullRequest(pool[i]!, makeContext({ precomputed: syntheticPrecomputed }))
    }
  })

  bench(`manifest: synthetic, ${STARTUP_BATCH} cold contexts`, () => {
    for (let i = 0; i < pool.length; i++) {
      fullRequest(pool[i]!, makeContext({ manifest: syntheticManifest }))
    }
  }, { heavy: true })

  const vitePrecomputed = precomputeDependencies(normalizedVite)
  const viteModules = new Set(Object.keys(normalizedVite))

  bench(`precomputed: vite fixture, ${STARTUP_BATCH} cold contexts`, () => {
    for (let i = 0; i < STARTUP_BATCH; i++) {
      fullRequest(viteModules, makeContext({ precomputed: vitePrecomputed }))
    }
  })

  bench(`manifest: vite fixture, ${STARTUP_BATCH} cold contexts`, () => {
    for (let i = 0; i < STARTUP_BATCH; i++) {
      fullRequest(viteModules, makeContext({ manifest: normalizedVite }))
    }
  })
})
