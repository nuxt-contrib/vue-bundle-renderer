import { describe } from 'vitest'
import { normalizeViteManifest, normalizeWebpackManifest } from '../src'
import { precomputeDependencies } from '../src/precompute'
import { bench } from './_harness'
import { fullRequest, makeContext } from './_renderer'

import viteManifest from '../test/fixtures/vite-manifest.json'
import webpackManifest from '../test/fixtures/webpack-manifest.json'
import largeViteManifest from './fixtures/large-vite-manifest.json'

const normalizedVite = normalizeViteManifest(viteManifest)
const normalizedWebpack = normalizeWebpackManifest(webpackManifest)
const normalizedLargeVite = normalizeViteManifest(largeViteManifest)

const REQUEST_BATCH = 64

describe('full request on real manifests', () => {
  const fixtures = [
    { label: 'vite fixture, all modules', manifest: normalizedVite, modules: new Set(Object.keys(normalizedVite)) },
    { label: 'webpack fixture, all modules', manifest: normalizedWebpack, modules: new Set(Object.keys(normalizedWebpack)) },
    { label: 'large vite fixture, 50 modules', manifest: normalizedLargeVite, modules: new Set(Object.keys(normalizedLargeVite).slice(0, 50)) },
  ]

  for (const { label, manifest, modules } of fixtures) {
    const precomputed = precomputeDependencies(manifest)
    const hot = makeContext({ precomputed })
    fullRequest(modules, hot)
    const cold = makeContext({ precomputed, dependencySetsCacheSize: 0 })

    bench(`hot: ${label} (x${REQUEST_BATCH})`, () => {
      for (let i = 0; i < REQUEST_BATCH; i++) {
        fullRequest(modules, hot)
      }
    })

    bench(`cold: ${label} (x${REQUEST_BATCH})`, () => {
      for (let i = 0; i < REQUEST_BATCH; i++) {
        fullRequest(modules, cold)
      }
    })
  }
})
