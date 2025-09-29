import { bench, describe } from 'vitest'
import { createRenderer, renderStyles, renderScripts, renderResourceHints } from '../src/runtime'
import { normalizeViteManifest, normalizeWebpackManifest } from '../src'
import { precomputeDependencies } from '../src/precompute'

import viteManifest from '../test/fixtures/vite-manifest.json'
import webpackManifest from '../test/fixtures/webpack-manifest.json'
import largeViteManifest from './fixtures/large-vite-manifest.json'

describe('createRenderer', () => {
  // Precompute dependencies for benchmarks
  const vitePrecomputed = precomputeDependencies(normalizeViteManifest(viteManifest))
  const webpackPrecomputed = precomputeDependencies(normalizeWebpackManifest(webpackManifest))
  const largeVitePrecomputed = precomputeDependencies(normalizeViteManifest(largeViteManifest))

  bench('vite (manifest)', () => {
    createRenderer(() => ({}), {
      manifest: normalizeViteManifest(viteManifest),
      renderToString: () => '<div>test</div>',
    })
  })

  bench('vite (precomputed)', () => {
    createRenderer(() => ({}), {
      precomputed: vitePrecomputed,
      renderToString: () => '<div>test</div>',
    })
  })

  bench('webpack (manifest)', () => {
    createRenderer(() => ({}), {
      manifest: normalizeWebpackManifest(webpackManifest),
      renderToString: () => '<div>test</div>',
    })
  })

  bench('webpack (precomputed)', () => {
    createRenderer(() => ({}), {
      precomputed: webpackPrecomputed,
      renderToString: () => '<div>test</div>',
    })
  })

  bench('vite large (manifest)', () => {
    createRenderer(() => ({}), {
      manifest: normalizeViteManifest(largeViteManifest),
      renderToString: () => '<div>test</div>',
    })
  })

  bench('vite large (precomputed)', () => {
    createRenderer(() => ({}), {
      precomputed: largeVitePrecomputed,
      renderToString: () => '<div>test</div>',
    })
  })
})

describe('rendering', () => {
  // Precompute dependencies
  const vitePrecomputed = precomputeDependencies(normalizeViteManifest(viteManifest))
  const webpackPrecomputed = precomputeDependencies(normalizeWebpackManifest(webpackManifest))
  const largeVitePrecomputed = precomputeDependencies(normalizeViteManifest(largeViteManifest))

  // Legacy renderers (with manifest)
  const viteRenderer = createRenderer(() => ({}), {
    manifest: normalizeViteManifest(viteManifest),
    renderToString: () => '<div>test</div>',
  })

  const webpackRenderer = createRenderer(() => ({}), {
    manifest: normalizeWebpackManifest(webpackManifest),
    renderToString: () => '<div>test</div>',
  })

  const largeViteRenderer = createRenderer(() => ({}), {
    manifest: normalizeViteManifest(largeViteManifest),
    renderToString: () => '<div>test</div>',
  })

  // Precomputed renderers
  const vitePrecomputedRenderer = createRenderer(() => ({}), {
    precomputed: vitePrecomputed,
    renderToString: () => '<div>test</div>',
  })

  const webpackPrecomputedRenderer = createRenderer(() => ({}), {
    precomputed: webpackPrecomputed,
    renderToString: () => '<div>test</div>',
  })

  const largeVitePrecomputedRenderer = createRenderer(() => ({}), {
    precomputed: largeVitePrecomputed,
    renderToString: () => '<div>test</div>',
  })

  // Get actual module keys from manifests
  const viteModules = Object.keys(viteManifest)
  const webpackModules = Object.keys(webpackManifest)
  const largeViteModules = Object.keys(largeViteManifest)

  // Small module sets
  const smallViteSet = new Set(viteModules.slice(0, 2))
  const smallWebpackSet = new Set(webpackModules.slice(0, 2))

  // Large module sets
  const largeViteSet = new Set(viteModules)
  const largeLargeViteSet = new Set(largeViteModules.slice(0, 50))

  bench('renderStyles - vite small (manifest)', () => {
    renderStyles({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderStyles - vite small (precomputed)', () => {
    renderStyles({ modules: smallViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderStyles - vite large (manifest)', () => {
    renderStyles({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderStyles - vite large (precomputed)', () => {
    renderStyles({ modules: largeViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderStyles - vite very large (manifest)', () => {
    renderStyles({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderStyles - vite very large (precomputed)', () => {
    renderStyles({ modules: largeLargeViteSet }, largeVitePrecomputedRenderer.rendererContext)
  })

  bench('renderScripts - vite small (manifest)', () => {
    renderScripts({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderScripts - vite small (precomputed)', () => {
    renderScripts({ modules: smallViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderScripts - vite large (manifest)', () => {
    renderScripts({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderScripts - vite large (precomputed)', () => {
    renderScripts({ modules: largeViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderScripts - vite very large (manifest)', () => {
    renderScripts({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderScripts - vite very large (precomputed)', () => {
    renderScripts({ modules: largeLargeViteSet }, largeVitePrecomputedRenderer.rendererContext)
  })

  bench('renderResourceHints - vite small (manifest)', () => {
    renderResourceHints({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite small (precomputed)', () => {
    renderResourceHints({ modules: smallViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderResourceHints - vite large (manifest)', () => {
    renderResourceHints({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite large (precomputed)', () => {
    renderResourceHints({ modules: largeViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderResourceHints - vite very large (manifest)', () => {
    renderResourceHints({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite very large (precomputed)', () => {
    renderResourceHints({ modules: largeLargeViteSet }, largeVitePrecomputedRenderer.rendererContext)
  })

  bench('renderStyles - webpack (manifest)', () => {
    renderStyles({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })

  bench('renderStyles - webpack (precomputed)', () => {
    renderStyles({ modules: smallWebpackSet }, webpackPrecomputedRenderer.rendererContext)
  })

  bench('renderScripts - webpack (manifest)', () => {
    renderScripts({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })

  bench('renderScripts - webpack (precomputed)', () => {
    renderScripts({ modules: smallWebpackSet }, webpackPrecomputedRenderer.rendererContext)
  })

  bench('renderResourceHints - webpack (manifest)', () => {
    renderResourceHints({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })

  bench('renderResourceHints - webpack (precomputed)', () => {
    renderResourceHints({ modules: smallWebpackSet }, webpackPrecomputedRenderer.rendererContext)
  })
})
