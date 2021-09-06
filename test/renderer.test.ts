import { expect } from 'chai'

import { createRenderer } from '../src/renderer'

import clientManifest from './fixtures/manifest.json'
import legacyManifest from './fixtures/legacy-manifest.json'

describe('renderer', () => {
  const getRenderer = async () => {
    const renderer = createRenderer(() => { }, { clientManifest, renderToString: () => '' })
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
      '<script type="module" src="/entry.mjs" defer></script>',
      '<script type="module" src="/index.mjs" defer></script>'
    ])
  })
  it('renders styles correctly', async () => {
    const { renderStyles } = await getRenderer()
    expect(renderStyles()).to.equal(
      '<link rel="stylesheet" href="/index.css">'
    )
  })
  it('renders resource hints correctly', async () => {
    const { renderResourceHints } = await getRenderer()
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).to.deep.equal(
      [
        '<link rel="modulepreload" href="/entry.mjs" as="script">',
        '<link rel="modulepreload" href="/index.mjs" as="script">',
        '<link rel="modulepreload" href="/vendor.mjs" as="script">',
        '<link rel="preload" href="/index.css" as="style">'
      ]
    )
  })
})

describe('renderer with legacy manifest', () => {
  const getRenderer = async () => {
    const renderer = createRenderer(() => { }, { clientManifest: legacyManifest as any, renderToString: () => '' })
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
        '<script src="/_nuxt/app.js" defer></script>',
        '<script src="/_nuxt/commons/app.js" defer></script>',
        '<script src="/_nuxt/runtime.js" defer></script>'
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
        '<link rel="preload" href="/_nuxt/app.css" as="style">', // entrypoint CSS
        '<link rel="preload" href="/_nuxt/app.js" as="script">',
        '<link rel="preload" href="/_nuxt/commons/app.js" as="script">',
        '<link rel="preload" href="/_nuxt/pages/index.js" as="script">', // dynamic entrypoint
        '<link rel="preload" href="/_nuxt/runtime.js" as="script">'
      ]
    )
  })
})
