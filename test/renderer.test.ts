import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'

import { createRenderer } from '../src/runtime'
import { normalizeViteManifest } from '../src/vite'
import viteManifest from './fixtures/vite-manifest.json'

describe('renderer', () => {
  const getRenderer = async (modules = [
    'app.vue',
    '../packages/nuxt3/src/pages/runtime/page.vue',
    'pages/index.vue'
  ]) => {
    const renderer = createRenderer(() => { }, {
      manifest: normalizeViteManifest(viteManifest),
      renderToString: () => '',
      buildAssetsURL: id => joinURL('/assets', id)
    })
    return await renderer.renderToString({
      modules: new Set(modules)
    })
  }

  it('renders scripts correctly', async () => {
    const { renderScripts } = await getRenderer()
    const result = renderScripts().split('</script>').slice(0, -1).map(s => `${s}</script>`)
    expect(result).toMatchInlineSnapshot(`
      [
        "<script type=\\"module\\" src=\\"/assets/entry.mjs\\" crossorigin></script>",
        "<script type=\\"module\\" src=\\"/assets/index.mjs\\" crossorigin></script>",
      ]
    `)
  })

  it('renders styles correctly', async () => {
    const { renderStyles } = await getRenderer()
    expect(renderStyles().split('>').slice(0, -1).map(s => `${s}>`).sort()).toMatchInlineSnapshot(
      `
      [
        "<link rel=\\"stylesheet\\" href=\\"/assets/index.css\\">",
        "<link rel=\\"stylesheet\\" href=\\"/assets/test.css\\">",
      ]
    `
    )
  })

  it('renders resource hints correctly', async () => {
    const { renderResourceHints } = await getRenderer()
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).toMatchInlineSnapshot(
    `
      [
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/entry.mjs\\">",
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/index.mjs\\">",
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/vendor.mjs\\">",
        "<link rel=\\"prefetch\\" as=\\"image\\" type=\\"image/png\\" href=\\"/assets/entry.png\\">",
        "<link rel=\\"preload\\" as=\\"style\\" href=\\"/assets/index.css\\">",
        "<link rel=\\"preload\\" as=\\"style\\" href=\\"/assets/test.css\\">",
      ]
    `)
  })

  it('renders resource hint headers correctly', async () => {
    const { renderResourceHeaders } = await getRenderer()
    const result = renderResourceHeaders()
    expect(result).toMatchInlineSnapshot(`
      {
        "link": "</assets/entry.mjs>; rel=\\"modulepreload\\"; as=\\"script\\"; crossorigin, </assets/test.css>; rel=\\"preload\\"; as=\\"style\\", </assets/vendor.mjs>; rel=\\"modulepreload\\"; as=\\"script\\"; crossorigin, </assets/index.mjs>; rel=\\"modulepreload\\"; as=\\"script\\"; crossorigin, </assets/index.css>; rel=\\"preload\\"; as=\\"style\\", </assets/entry.png>; rel=\\"prefetch\\"; as=\\"image\\"; type=\\"image/png\\"",
      }
    `)
  })

  it('prefetches dynamic imports minimally', async () => {
    const { renderResourceHints } = await getRenderer([
      'pages/about.vue'
    ])
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).toMatchInlineSnapshot(`
      [
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/about.mjs\\">",
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/entry.mjs\\">",
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/vendor.mjs\\">",
        "<link rel=\\"prefetch\\" as=\\"image\\" type=\\"image/png\\" href=\\"/assets/entry.png\\">",
        "<link rel=\\"prefetch\\" as=\\"script\\" crossorigin href=\\"/assets/index.mjs\\">",
        "<link rel=\\"prefetch\\" as=\\"script\\" crossorigin href=\\"/assets/lazy-component.mjs\\">",
        "<link rel=\\"prefetch\\" as=\\"style\\" href=\\"/assets/index.css\\">",
        "<link rel=\\"prefetch\\" as=\\"style\\" href=\\"/assets/lazy-component.css\\">",
        "<link rel=\\"preload\\" as=\\"style\\" href=\\"/assets/about.css\\">",
        "<link rel=\\"preload\\" as=\\"style\\" href=\\"/assets/test.css\\">",
      ]
    `)
  })

  it('uses correct content types', async () => {
    const { renderResourceHints } = await getRenderer([
      'pages/about.vue',
      'components/LazyComponent.vue'
    ])
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).toMatchInlineSnapshot(`
      [
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/about.mjs\\">",
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/entry.mjs\\">",
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/lazy-component.mjs\\">",
        "<link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/assets/vendor.mjs\\">",
        "<link rel=\\"prefetch\\" as=\\"audio\\" href=\\"/assets/lazy-component.mp3\\">",
        "<link rel=\\"prefetch\\" as=\\"image\\" type=\\"image/jpeg\\" href=\\"/assets/lazy-component.jpg\\">",
        "<link rel=\\"prefetch\\" as=\\"image\\" type=\\"image/png\\" href=\\"/assets/entry.png\\">",
        "<link rel=\\"prefetch\\" as=\\"image\\" type=\\"image/png\\" href=\\"/assets/lazy-component.png\\">",
        "<link rel=\\"prefetch\\" as=\\"image\\" type=\\"image/svg+xml\\" href=\\"/assets/lazy-component.svg\\">",
        "<link rel=\\"prefetch\\" as=\\"image\\" type=\\"image/x-icon\\" href=\\"/assets/lazy-component.ico\\">",
        "<link rel=\\"prefetch\\" as=\\"script\\" crossorigin href=\\"/assets/index.mjs\\">",
        "<link rel=\\"prefetch\\" as=\\"style\\" href=\\"/assets/index.css\\">",
        "<link rel=\\"prefetch\\" as=\\"video\\" href=\\"/assets/lazy-component.mp4\\">",
        "<link rel=\\"preload\\" as=\\"style\\" href=\\"/assets/about.css\\">",
        "<link rel=\\"preload\\" as=\\"style\\" href=\\"/assets/lazy-component.css\\">",
        "<link rel=\\"preload\\" as=\\"style\\" href=\\"/assets/test.css\\">",
      ]
    `)
  })
})
