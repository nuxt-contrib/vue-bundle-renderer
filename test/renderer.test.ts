import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'

import { createRenderer } from '../src/renderer'
import manifest from './fixtures/manifest.json'

describe('renderer', () => {
  const getRenderer = async (modules = [
    'app.vue',
    '../packages/nuxt3/src/pages/runtime/page.vue',
    'pages/index.vue'
  ]) => {
    const renderer = createRenderer(() => { }, {
      manifest,
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
      ]
    `)
  })

  it('renders resource hint headers correctly', async () => {
    const { renderResourceHeaders } = await getRenderer()
    const result = renderResourceHeaders()
    expect(result).toMatchInlineSnapshot(`
      {
        "link": "</assets/entry.mjs>; rel=\\"modulepreload\\"; as=\\"script\\"; crossorigin, </assets/vendor.mjs>; rel=\\"modulepreload\\"; as=\\"script\\"; crossorigin, </assets/index.mjs>; rel=\\"modulepreload\\"; as=\\"script\\"; crossorigin",
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
        "<link rel=\\"prefetch stylesheet\\" href=\\"/assets/index.css\\">",
        "<link rel=\\"prefetch stylesheet\\" href=\\"/assets/lazy-component.css\\">",
        "<link rel=\\"prefetch\\" as=\\"script\\" href=\\"/assets/index.mjs\\">",
        "<link rel=\\"prefetch\\" as=\\"script\\" href=\\"/assets/lazy-component.mjs\\">",
      ]
    `)
  })
})
