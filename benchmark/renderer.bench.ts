import { posix } from 'node:path'
import { bench, describe } from 'vitest'
import {
  createRenderer,
  getResources,
  renderResourceHeaders,
  renderResourceHints,
  renderScripts,
  renderStyles,
} from '../src/runtime'
import { normalizeViteManifest, normalizeWebpackManifest } from '../src'
import { precomputeDependencies } from '../src/precompute'

import viteManifest from '../test/fixtures/vite-manifest.json'
import webpackManifest from '../test/fixtures/webpack-manifest.json'
import largeViteManifest from './fixtures/large-vite-manifest.json'
import { buildFixedSizeSetPool, buildSyntheticManifest } from './_synthetic'

// Realistic-shape relative `buildAssetsURL`: SSR'd page lives at some nested
// route and emits asset hrefs relative to that route. The exact algorithm
// here is not load-bearing for what the bench measures; what matters is that
// each call does real string work (dirname / relative) rather than the
// near-free `withLeadingSlash` default. This exposes how much of render time
// is spent inside the URL function itself.
const requestPath = '/some/nested/route/'
const relativeBuildAssetsURL = (id: string) =>
  posix.relative(posix.dirname(requestPath), `/_nuxt/${id}`) || `./${id}`

const syntheticManifest = buildSyntheticManifest({ components: 2000, pages: 5000 })
const syntheticPrecomputed = precomputeDependencies(syntheticManifest)

const SET_SIZES = [1, 10, 50, 200] as const
const moduleSetsBySize: Record<number, Set<string>[]> = {}
for (const size of SET_SIZES) {
  moduleSetsBySize[size] = buildFixedSizeSetPool(syntheticManifest, size, 64, 1337 + size)
}

function makeRenderer(buildAssetsURL?: (id: string) => string) {
  return createRenderer(() => ({}), {
    precomputed: syntheticPrecomputed,
    renderToString: () => '<div>test</div>',
    buildAssetsURL,
  })
}

const syntheticRendererDefault = makeRenderer()
const syntheticRendererRelative = makeRenderer(relativeBuildAssetsURL)

const URL_VARIANTS = [
  { label: 'default URL', renderer: syntheticRendererDefault },
  { label: 'relative URL', renderer: syntheticRendererRelative },
] as const

describe('createRenderer', () => {
  const vitePrecomputed = precomputeDependencies(normalizeViteManifest(viteManifest))
  const webpackPrecomputed = precomputeDependencies(normalizeWebpackManifest(webpackManifest))
  const largeVitePrecomputed = precomputeDependencies(normalizeViteManifest(largeViteManifest))

  bench('vite', () => {
    createRenderer(() => ({}), {
      precomputed: vitePrecomputed,
      renderToString: () => '<div>test</div>',
    })
  })

  bench('vite (manifest)', () => {
    createRenderer(() => ({}), {
      manifest: normalizeViteManifest(viteManifest),
      renderToString: () => '<div>test</div>',
    })
  })

  bench('webpack', () => {
    createRenderer(() => ({}), {
      precomputed: webpackPrecomputed,
      renderToString: () => '<div>test</div>',
    })
  })

  bench('webpack (manifest)', () => {
    createRenderer(() => ({}), {
      manifest: normalizeWebpackManifest(webpackManifest),
      renderToString: () => '<div>test</div>',
    })
  })

  bench('vite (large)', () => {
    createRenderer(() => ({}), {
      precomputed: largeVitePrecomputed,
      renderToString: () => '<div>test</div>',
    })
  })

  bench('vite (large) (manifest)', () => {
    createRenderer(() => ({}), {
      manifest: normalizeViteManifest(largeViteManifest),
      renderToString: () => '<div>test</div>',
    })
  })

  bench('synthetic 2000/5000 (precomputed)', () => {
    createRenderer(() => ({}), {
      precomputed: syntheticPrecomputed,
      renderToString: () => '<div>test</div>',
    })
  })

  bench('synthetic 2000/5000 (manifest)', () => {
    createRenderer(() => ({}), {
      manifest: syntheticManifest,
      renderToString: () => '<div>test</div>',
    })
  })
})

describe('rendering', () => {
  const vitePrecomputed = precomputeDependencies(normalizeViteManifest(viteManifest))
  const webpackPrecomputed = precomputeDependencies(normalizeWebpackManifest(webpackManifest))
  const largeVitePrecomputed = precomputeDependencies(normalizeViteManifest(largeViteManifest))

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

  const viteModules = Object.keys(viteManifest)
  const webpackModules = Object.keys(webpackManifest)
  const largeViteModules = Object.keys(largeViteManifest)

  const smallViteSet = new Set(viteModules.slice(0, 2))
  const smallWebpackSet = new Set(webpackModules.slice(0, 2))

  const largeViteSet = new Set(viteModules)
  const largeLargeViteSet = new Set(largeViteModules.slice(0, 50))

  bench('renderStyles - vite (small)', () => {
    renderStyles({ modules: smallViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderStyles - vite (small) (manifest)', () => {
    renderStyles({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderStyles - vite (large)', () => {
    renderStyles({ modules: largeViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderStyles - vite (large) (manifest)', () => {
    renderStyles({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderStyles - vite (very large)', () => {
    renderStyles({ modules: largeLargeViteSet }, largeVitePrecomputedRenderer.rendererContext)
  })

  bench('renderStyles - vite (very large) (manifest)', () => {
    renderStyles({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderScripts - vite (small)', () => {
    renderScripts({ modules: smallViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderScripts - vite (small) (manifest)', () => {
    renderScripts({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderScripts - vite (large)', () => {
    renderScripts({ modules: largeViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderScripts - vite (large) (manifest)', () => {
    renderScripts({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderScripts - vite (very large)', () => {
    renderScripts({ modules: largeLargeViteSet }, largeVitePrecomputedRenderer.rendererContext)
  })

  bench('renderScripts - vite (very large) (manifest)', () => {
    renderScripts({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (small)', () => {
    renderResourceHints({ modules: smallViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (small) (manifest)', () => {
    renderResourceHints({ modules: smallViteSet }, viteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (large)', () => {
    renderResourceHints({ modules: largeViteSet }, vitePrecomputedRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (large) (manifest)', () => {
    renderResourceHints({ modules: largeViteSet }, viteRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (very large)', () => {
    renderResourceHints({ modules: largeLargeViteSet }, largeVitePrecomputedRenderer.rendererContext)
  })

  bench('renderResourceHints - vite (very large) (manifest)', () => {
    renderResourceHints({ modules: largeLargeViteSet }, largeViteRenderer.rendererContext)
  })

  bench('renderStyles - webpack', () => {
    renderStyles({ modules: smallWebpackSet }, webpackPrecomputedRenderer.rendererContext)
  })

  bench('renderStyles - webpack (manifest)', () => {
    renderStyles({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })

  bench('renderScripts - webpack', () => {
    renderScripts({ modules: smallWebpackSet }, webpackPrecomputedRenderer.rendererContext)
  })

  bench('renderScripts - webpack (manifest)', () => {
    renderScripts({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })

  bench('renderResourceHints - webpack', () => {
    renderResourceHints({ modules: smallWebpackSet }, webpackPrecomputedRenderer.rendererContext)
  })

  bench('renderResourceHints - webpack (manifest)', () => {
    renderResourceHints({ modules: smallWebpackSet }, webpackRenderer.rendererContext)
  })
})

for (const { label, renderer } of URL_VARIANTS) {
  describe(`renderStyles - synthetic (${label})`, () => {
    for (const size of SET_SIZES) {
      const pool = moduleSetsBySize[size]!
      bench(`size ${size}`, () => {
        for (let i = 0; i < pool.length; i++) {
          renderStyles({ modules: pool[i]! }, renderer.rendererContext)
        }
      })
    }
  })

  describe(`renderScripts - synthetic (${label})`, () => {
    for (const size of SET_SIZES) {
      const pool = moduleSetsBySize[size]!
      bench(`size ${size}`, () => {
        for (let i = 0; i < pool.length; i++) {
          renderScripts({ modules: pool[i]! }, renderer.rendererContext)
        }
      })
    }
  })

  describe(`renderResourceHints - synthetic (${label})`, () => {
    for (const size of SET_SIZES) {
      const pool = moduleSetsBySize[size]!
      bench(`size ${size}`, () => {
        for (let i = 0; i < pool.length; i++) {
          renderResourceHints({ modules: pool[i]! }, renderer.rendererContext)
        }
      })
    }
  })

  describe(`renderResourceHeaders - synthetic (${label})`, () => {
    for (const size of SET_SIZES) {
      const pool = moduleSetsBySize[size]!
      bench(`size ${size}`, () => {
        for (let i = 0; i < pool.length; i++) {
          renderResourceHeaders({ modules: pool[i]! }, renderer.rendererContext)
        }
      })
    }
  })
}

describe('getResources - synthetic', () => {
  const pool = moduleSetsBySize[50]!
  bench('size 50 (default URL)', () => {
    for (let i = 0; i < pool.length; i++) {
      getResources({ modules: pool[i]! }, syntheticRendererDefault.rendererContext)
    }
  })
})
