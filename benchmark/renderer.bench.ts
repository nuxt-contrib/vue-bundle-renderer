import { bench, describe } from 'vitest'
import { createRenderer, renderStyles, renderScripts, renderResourceHints } from '../src/runtime'
import { normalizeViteManifest, normalizeWebpackManifest } from '../src'

import viteManifest from '../test/fixtures/vite-manifest.json'
import webpackManifest from '../test/fixtures/webpack-manifest.json'
import largeViteManifest from './fixtures/large-vite-manifest.json'

describe('createRenderer', () => {
  bench('vite', () => {
    createRenderer(() => ({}), {
      manifest: normalizeViteManifest(viteManifest),
      renderToString: () => '<div>test</div>',
    })
  })

  bench('webpack', () => {
    createRenderer(() => ({}), {
      manifest: normalizeWebpackManifest(webpackManifest),
      renderToString: () => '<div>test</div>',
    })
  })

  bench('vite (large)', () => {
    createRenderer(() => ({}), {
      manifest: normalizeViteManifest(largeViteManifest),
      renderToString: () => '<div>test</div>',
    })
  })
})

describe('rendering', () => {
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

  bench('renderStyles - vite (small)', () => {
    renderStyles({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderStyles - vite (large)', () => {
    renderStyles({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderStyles - vite (very large)', () => {
    renderStyles({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderScripts - vite (small)', () => {
    renderScripts({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderScripts - vite (large)', () => {
    renderScripts({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderScripts - vite (very large)', () => {
    renderScripts({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (small)', () => {
    renderResourceHints({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (large)', () => {
    renderResourceHints({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (very large)', () => {
    renderResourceHints({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderStyles - webpack', () => {
    renderStyles({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })

  bench('renderScripts - webpack', () => {
    renderScripts({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })

  bench('renderResourceHints - webpack', () => {
    renderResourceHints({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })
})
