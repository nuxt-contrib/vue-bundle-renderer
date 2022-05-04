import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'

import { createRendererContext, getRequestDependencies } from '../src/renderer'
import manifest from './fixtures/manifest.json'

describe('dependencies', () => {
  const getContext = () => {
    return createRendererContext({
      manifest,
      buildAssetsURL: id => joinURL('/assets', id)
    })
  }

  it('gets all entrypoint dependencies', () => {
    const context = getContext()
    const { prefetch, preload, scripts, styles } = getRequestDependencies({}, context)
    expect(Object.values(prefetch).map(i => i.path)).toMatchInlineSnapshot(`
      [
        "index.mjs",
        "index.css",
      ]
    `)
    expect(Object.values(preload).map(i => i.path)).toMatchInlineSnapshot(`
      [
        "entry.mjs",
        "vendor.mjs",
      ]
    `)
    expect(Object.values(scripts).map(i => i.path)).toMatchInlineSnapshot(`
      [
        "entry.mjs",
      ]
    `)
    expect(Object.values(styles).map(i => i.path)).toMatchInlineSnapshot(`
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
    expect(Object.values(prefetch).map(i => i.path)).toMatchInlineSnapshot(`
      [
        "index.mjs",
        "index.css",
        "lazy-component.mjs",
        "lazy-component.css",
      ]
    `)
    expect(Object.values(preload).map(i => i.path)).toMatchInlineSnapshot(`
      [
        "entry.mjs",
        "vendor.mjs",
        "about.mjs",
      ]
    `)
    expect(Object.values(scripts).map(i => i.path)).toMatchInlineSnapshot(`
      [
        "entry.mjs",
        "about.mjs",
      ]
    `)
    expect(Object.values(styles).map(i => i.path)).toMatchInlineSnapshot(`
      [
        "test.css",
        "about.css",
      ]
    `)
  })
})
