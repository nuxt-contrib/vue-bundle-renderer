import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'

import type { SSRContext } from '../src/runtime'
import { createRendererContext, getPreloadLinks, getPrefetchLinks, getRequestDependencies, renderStyles } from '../src/runtime'
import { precomputeDependencies } from '../src/precompute'
import { normalizeViteManifest } from '../src/vite'
import viteManifest from './fixtures/vite-manifest.json'

describe('dependencies', () => {
  const getContext = () => {
    return createRendererContext({
      manifest: normalizeViteManifest(viteManifest),
      buildAssetsURL: id => joinURL('/assets', id),
    })
  }

  it('gets all entrypoint dependencies', () => {
    const context = getContext()
    const { prefetch, preload, scripts, styles } = getRequestDependencies({}, context)
    expect(Object.values(prefetch).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "entry.png",
        "index.css",
        "index.mjs",
      ]
    `)
    expect(Object.values(preload).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "entry.mjs",
        "vendor.mjs",
      ]
    `)
    expect(Object.values(scripts).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "entry.mjs",
      ]
    `)
    expect(Object.values(styles).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "test.css",
      ]
    `)
  })

  describe('exclude option', () => {
    it('drops the excluded chunk and chunks reachable only through it from preload/prefetch', () => {
      const context = getContext()
      const ssrContext = { modules: new Set(['pages/about.vue']) }
      const preload = getPreloadLinks(ssrContext, context, { exclude: new Set(['pages/about.vue']) })
      const prefetch = getPrefetchLinks(ssrContext, context, { exclude: new Set(['pages/about.vue']) })
      const preloadFiles = preload.map(l => l.href)
      const prefetchFiles = prefetch.map(l => l.href)
      expect(preloadFiles).not.toContain('/assets/about.mjs')
      expect(prefetchFiles).not.toContain('/assets/lazy-component.mjs')
      expect(prefetchFiles).not.toContain('/assets/lazy-component.css')
      expect(preloadFiles).toContain('/assets/entry.mjs')
    })

    it('keeps styles for the excluded module (asymmetry preserved)', () => {
      const context = getContext()
      const ssrContext = { modules: new Set(['pages/about.vue']) }
      getPreloadLinks(ssrContext, context, { exclude: new Set(['pages/about.vue']) })
      expect(renderStyles(ssrContext, context)).toContain('/assets/about.css')
    })

    it('bypasses the per-request cache populated by an earlier zero-arg call (regression: nuxt#35145)', () => {
      const context = getContext()
      const ssrContext: SSRContext = { modules: new Set(['pages/about.vue']) }
      getRequestDependencies(ssrContext, context)
      expect(ssrContext._requestDependencies).toBeDefined()
      const preload = getPreloadLinks(ssrContext, context, { exclude: new Set(['pages/about.vue']) })
      expect(preload.map(l => l.href)).not.toContain('/assets/about.mjs')
    })

    it('zero-arg calls populate the per-request cache and reuse it', () => {
      const context = getContext()
      const ssrContext: SSRContext = { modules: new Set(['pages/about.vue']) }
      const first = getRequestDependencies(ssrContext, context)
      expect(ssrContext._requestDependencies).toBe(first)
      const second = getRequestDependencies(ssrContext, context)
      expect(second).toBe(first)
      const preloadHrefs = getPreloadLinks(ssrContext, context).map(l => l.href)
      expect(preloadHrefs).toContain('/assets/about.mjs')
    })

    it('treats an unknown excluded id as a no-op', () => {
      const context = getContext()
      const ssrContext = { modules: new Set(['pages/about.vue']) }
      const baseline = getPreloadLinks(ssrContext, context).map(l => l.href).sort()
      const otherSsr = { modules: new Set(['pages/about.vue']) }
      const withUnknown = getPreloadLinks(otherSsr, context, { exclude: new Set(['does/not/exist.vue']) }).map(l => l.href).sort()
      expect(withUnknown).toEqual(baseline)
    })

    it('honours exclude in precomputed-deps mode', () => {
      const precomputed = precomputeDependencies(normalizeViteManifest(viteManifest))
      const context = createRendererContext({
        precomputed,
        buildAssetsURL: id => joinURL('/assets', id),
      })
      const ssrContext = { modules: new Set(['pages/about.vue']) }
      const preload = getPreloadLinks(ssrContext, context, { exclude: new Set(['pages/about.vue']) }).map(l => l.href)
      expect(preload).not.toContain('/assets/about.mjs')
      expect(preload).toContain('/assets/entry.mjs')
    })
  })

  it('gets all dependencies for a request with dynamic imports', () => {
    const context = getContext()
    const { prefetch, preload, scripts, styles } = getRequestDependencies({
      modules: new Set(['pages/about.vue']),
    }, context)
    expect(Object.values(prefetch).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "entry.png",
        "index.css",
        "index.mjs",
        "lazy-component.css",
        "lazy-component.mjs",
      ]
    `)
    expect(Object.values(preload).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "entry.mjs",
        "vendor.mjs",
        "about.mjs",
      ]
    `)
    expect(Object.values(scripts).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "entry.mjs",
      ]
    `)
    expect(Object.values(styles).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "test.css",
        "about.css",
      ]
    `)
  })
})
