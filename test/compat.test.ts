import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'

import { createRenderer } from '../src/renderer'
import { normalizeClientManifest } from '../src/legacy'

import manifest from './fixtures/manifest.json'
import legacyManifest from './fixtures/legacy-manifest.json'

describe('renderer', () => {
  const getRenderer = async () => {
    const renderer = createRenderer(() => { }, { manifest, renderToString: () => '' })
    return await renderer.renderToString({
      modules: new Set([
        'app.vue',
        '../packages/nuxt3/src/pages/runtime/page.vue',
        'pages/index.vue'
      ])
    })
  }

  it('renders scripts correctly', async () => {
    const { renderScripts } = await getRenderer()
    const result = renderScripts().split('</script>').slice(0, -1).map(s => `${s}</script>`).sort()
    expect(result).to.deep.equal([
      '<script type="module" src="/entry.mjs" crossorigin></script>',
      '<script type="module" src="/index.mjs" crossorigin></script>'
    ])
  })
  it('renders styles correctly', async () => {
    const { renderStyles } = await getRenderer()
    expect(renderStyles()).to.equal(
      '<link rel="stylesheet" href="/test.css"><link rel="stylesheet" href="/index.css">'
    )
  })
  it('renders resource hints correctly', async () => {
    const { renderResourceHints } = await getRenderer()
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).to.deep.equal(
      [
        '<link rel="modulepreload" as="script" crossorigin href="/entry.mjs">',
        '<link rel="modulepreload" as="script" crossorigin href="/index.mjs">',
        '<link rel="modulepreload" as="script" crossorigin href="/vendor.mjs">',
        '<link rel="prefetch" as="image" type="image/png" href="/entry.png">'
      ]
    )
  })
})

describe('renderer with legacy manifest', () => {
  const getRenderer = async () => {
    const renderer = createRenderer(() => { }, { manifest: normalizeClientManifest(legacyManifest), buildAssetsURL: r => joinURL(legacyManifest.publicPath, r), renderToString: () => '' })
    return await renderer.renderToString({
      _registeredComponents: new Set([
        '4d87aad8',
        '630f1d84',
        '56940b2e'
      ])
    })
  }

  it('renders scripts correctly', async () => {
    const { renderScripts } = await getRenderer()
    const result = renderScripts().split('</script>').slice(0, -1).map(s => `${s}</script>`).sort()
    expect(result).to.deep.equal(
      [
        '<script src="/_nuxt/app.js" defer crossorigin></script>',
        '<script src="/_nuxt/commons/app.js" defer crossorigin></script>',
        '<script src="/_nuxt/runtime.js" defer crossorigin></script>'
      ]
    )
  })
  it('renders styles correctly', async () => {
    const { renderStyles } = await getRenderer()
    expect(renderStyles()).to.equal(
      '<link rel="stylesheet" href="/_nuxt/app.css">'
    )
  })
  it('renders resource hints correctly', async () => {
    const { renderResourceHints } = await getRenderer()
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).to.deep.equal(
      [
        '<link rel="prefetch stylesheet" href="/_nuxt/pages/another.css">', // dynamic import CSS
        '<link rel="prefetch" as="script" href="/_nuxt/pages/another.js">', // dynamic import
        '<link rel="preload" as="script" href="/_nuxt/app.js">',
        '<link rel="preload" as="script" href="/_nuxt/commons/app.js">',
        '<link rel="preload" as="script" href="/_nuxt/pages/index.js">', // dynamic entrypoint
        '<link rel="preload" as="script" href="/_nuxt/runtime.js">'
      ]
    )
  })
})
