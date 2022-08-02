import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'

import { createRendererContext, getRequestDependencies } from '../src/runtime'
import { normalizeViteManifest } from '../src/vite'
import viteManifest from './fixtures/vite-manifest.json'

describe('dependencies', () => {
  const getContext = () => {
    return createRendererContext({
      manifest: normalizeViteManifest(viteManifest),
      buildAssetsURL: id => joinURL('/assets', id)
    })
  }

  it('gets all entrypoint dependencies', () => {
    const context = getContext()
    const { prefetch, preload, scripts, styles } = getRequestDependencies({}, context)
    expect(Object.values(prefetch).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "entry.png",
        "index.mjs",
        "index.css",
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

  it('gets all dependencies for a request with dynamic imports', () => {
    const context = getContext()
    const { prefetch, preload, scripts, styles } = getRequestDependencies({
      modules: new Set(['pages/about.vue'])
    }, context)
    expect(Object.values(prefetch).map(i => i.file)).toMatchInlineSnapshot(`
      [
        "entry.png",
        "index.mjs",
        "index.css",
        "lazy-component.mjs",
        "lazy-component.css",
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
        "about.mjs",
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
