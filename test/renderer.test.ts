import { describe, expect, it } from 'vitest'
import { joinURL } from 'ufo'

import { createRenderer, createRendererContext, getPreloadLinks, getPrefetchLinks, renderResourceHeaders, renderResourceHints } from '../src/runtime'
import { normalizeViteManifest } from '../src/vite'
import viteManifest from './fixtures/vite-manifest.json'

describe('renderer', () => {
  const getRenderer = async (modules = [
    'app.vue',
    '../packages/nuxt3/src/pages/runtime/page.vue',
    'pages/index.vue',
  ]) => {
    const renderer = createRenderer(() => { }, {
      manifest: normalizeViteManifest(viteManifest),
      renderToString: () => '',
      buildAssetsURL: id => joinURL('/assets', id),
    })
    return await renderer.renderToString({
      modules: new Set(modules),
    })
  }

  it('renders scripts correctly', async () => {
    const { renderScripts } = await getRenderer()
    const result = renderScripts().split('</script>').slice(0, -1).map(s => `${s}</script>`)
    expect(result).toMatchInlineSnapshot(`
      [
        "<script type="module" src="/assets/entry.mjs" crossorigin></script>",
      ]
    `)
  })

  it('renders styles correctly', async () => {
    const { renderStyles } = await getRenderer()
    expect(renderStyles().split('>').slice(0, -1).map(s => `${s}>`).sort()).toMatchInlineSnapshot(
      `
      [
        "<link rel="stylesheet" href="/assets/index.css" crossorigin>",
        "<link rel="stylesheet" href="/assets/test.css" crossorigin>",
      ]
    `,
    )
  })

  it('renders resource hints correctly', async () => {
    const { renderResourceHints } = await getRenderer()
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).toMatchInlineSnapshot(
    `
      [
        "<link rel="modulepreload" as="script" crossorigin href="/assets/entry.mjs">",
        "<link rel="modulepreload" as="script" crossorigin href="/assets/index.mjs">",
        "<link rel="modulepreload" as="script" crossorigin href="/assets/vendor.mjs">",
        "<link rel="prefetch" as="image" type="image/png" href="/assets/entry.png">",
      ]
    `)
  })

  it('renders resource hint headers correctly', async () => {
    const { renderResourceHeaders } = await getRenderer()
    const result = renderResourceHeaders()
    expect(result).toMatchInlineSnapshot(`
      {
        "link": "</assets/entry.mjs>; rel="modulepreload"; as="script"; crossorigin, </assets/vendor.mjs>; rel="modulepreload"; as="script"; crossorigin, </assets/index.mjs>; rel="modulepreload"; as="script"; crossorigin, </assets/entry.png>; rel="prefetch"; as="image"; type="image/png"",
      }
    `)
  })

  it('percent-encodes non-ASCII asset URLs in resource headers', async () => {
    const renderer = createRenderer(() => { }, {
      manifest: normalizeViteManifest(viteManifest),
      renderToString: () => '',
      buildAssetsURL: id => joinURL('/assets/@fs/Users/nuxt/тест', id),
    })
    const { renderResourceHeaders } = await renderer.renderToString({
      modules: new Set(['app.vue']),
    })
    const { link } = renderResourceHeaders()
    expect(link).toContain('/assets/@fs/Users/nuxt/%D1%82%D0%B5%D1%81%D1%82/entry.mjs')
    expect(link).not.toMatch(/[^\0-\u007F]/)
    expect(() => new Headers({ link: link! })).not.toThrow()
  })

  it('prefetches dynamic imports minimally', async () => {
    const { renderResourceHints } = await getRenderer([
      'pages/about.vue',
    ])
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).toMatchInlineSnapshot(`
      [
        "<link rel="modulepreload" as="script" crossorigin href="/assets/about.mjs">",
        "<link rel="modulepreload" as="script" crossorigin href="/assets/entry.mjs">",
        "<link rel="modulepreload" as="script" crossorigin href="/assets/vendor.mjs">",
        "<link rel="prefetch" as="image" type="image/png" href="/assets/entry.png">",
        "<link rel="prefetch" as="script" crossorigin href="/assets/index.mjs">",
        "<link rel="prefetch" as="script" crossorigin href="/assets/lazy-component.mjs">",
        "<link rel="prefetch" as="style" crossorigin href="/assets/index.css">",
        "<link rel="prefetch" as="style" crossorigin href="/assets/lazy-component.css">",
      ]
    `)
  })

  it('uses correct content types', async () => {
    const { renderResourceHints, renderStyles } = await getRenderer([
      'pages/about.vue',
      'components/LazyComponent.vue',
    ])
    expect(renderStyles().split('>').slice(0, -1).map(s => `${s}>`).sort()).toMatchInlineSnapshot(`
      [
        "<link rel="stylesheet" href="/assets/about.css" crossorigin>",
        "<link rel="stylesheet" href="/assets/lazy-component.css" crossorigin>",
        "<link rel="stylesheet" href="/assets/test.css" crossorigin>",
      ]
    `)
    const result = renderResourceHints().split('>').slice(0, -1).map(s => `${s}>`).sort()
    expect(result).toMatchInlineSnapshot(`
      [
        "<link rel="modulepreload" as="script" crossorigin href="/assets/about.mjs">",
        "<link rel="modulepreload" as="script" crossorigin href="/assets/entry.mjs">",
        "<link rel="modulepreload" as="script" crossorigin href="/assets/lazy-component.mjs">",
        "<link rel="modulepreload" as="script" crossorigin href="/assets/vendor.mjs">",
        "<link rel="prefetch" as="audio" href="/assets/lazy-component.mp3">",
        "<link rel="prefetch" as="image" type="image/jpeg" href="/assets/lazy-component.jpg">",
        "<link rel="prefetch" as="image" type="image/png" href="/assets/entry.png">",
        "<link rel="prefetch" as="image" type="image/png" href="/assets/lazy-component.png">",
        "<link rel="prefetch" as="image" type="image/svg+xml" href="/assets/lazy-component.svg">",
        "<link rel="prefetch" as="image" type="image/x-icon" href="/assets/lazy-component.ico">",
        "<link rel="prefetch" as="script" crossorigin href="/assets/index.mjs">",
        "<link rel="prefetch" as="style" crossorigin href="/assets/index.css">",
        "<link rel="prefetch" as="video" href="/assets/lazy-component.mp4">",
      ]
    `)
  })

  describe('scripts option', () => {
    const fontManifest = {
      'entry.mjs': {
        file: 'entry.mjs',
        isEntry: true,
        module: true,
        preload: true,
        resourceType: 'script' as const,
        css: ['index.css'],
        assets: ['font.woff2'],
      },
      'index.css': {
        file: 'index.css',
        preload: true,
        prefetch: true,
        resourceType: 'style' as const,
        mimeType: 'text/css',
      },
      'font.woff2': {
        file: 'font.woff2',
        preload: true,
        prefetch: true,
        resourceType: 'font' as const,
        mimeType: 'font/woff2',
      },
    }

    const getFontRenderer = async () => {
      const renderer = createRenderer(() => { }, {
        manifest: fontManifest,
        renderToString: () => '',
        buildAssetsURL: id => joinURL('/assets', id),
      })
      const { rendererContext } = renderer
      await renderer.renderToString({ modules: new Set(['entry.mjs']) })
      return rendererContext
    }

    it('drops script-shaped prefetch hints and keeps the rest', () => {
      const context = createRendererContext({
        manifest: normalizeViteManifest(viteManifest),
        buildAssetsURL: id => joinURL('/assets', id),
      })
      const ssrContext = { modules: new Set(['pages/about.vue']) }
      expect(renderResourceHints(ssrContext, context, { scripts: false }).split('>').slice(0, -1).map(s => `${s}>`).sort()).toMatchInlineSnapshot(`
        [
          "<link rel="prefetch" as="image" type="image/png" href="/assets/entry.png">",
          "<link rel="prefetch" as="style" crossorigin href="/assets/index.css">",
          "<link rel="prefetch" as="style" crossorigin href="/assets/lazy-component.css">",
        ]
      `)
      expect(renderResourceHeaders(ssrContext, context, { scripts: false })).toMatchInlineSnapshot(`
        {
          "link": "</assets/entry.png>; rel="prefetch"; as="image"; type="image/png", </assets/index.css>; rel="prefetch"; as="style"; crossorigin, </assets/lazy-component.css>; rel="prefetch"; as="style"; crossorigin",
        }
      `)
      expect(getPrefetchLinks(ssrContext, context, { scripts: false }).map(l => l.href)).toMatchInlineSnapshot(`
        [
          "/assets/entry.png",
          "/assets/index.css",
          "/assets/lazy-component.css",
        ]
      `)
    })

    it('drops script-shaped hints and keeps font and style hints', async () => {
      const context = await getFontRenderer()
      expect(renderResourceHints({}, context, { scripts: false })).toMatchInlineSnapshot(`"<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/font.woff2">"`)
      expect(renderResourceHeaders({}, context, { scripts: false })).toMatchInlineSnapshot(`
        {
          "link": "</assets/font.woff2>; rel="preload"; as="font"; type="font/woff2"; crossorigin",
        }
      `)
      expect(getPreloadLinks({}, context, { scripts: false }).map(l => l.href)).toMatchInlineSnapshot(`
        [
          "/assets/font.woff2",
        ]
      `)
    })

    it('returns the correct result for interleaved filtered and unfiltered calls', async () => {
      const context = await getFontRenderer()
      const filteredHeaders = renderResourceHeaders({}, context, { scripts: false }).link
      const headers = renderResourceHeaders({}, context).link
      expect(renderResourceHeaders({}, context, { scripts: false }).link).toBe(filteredHeaders)
      expect(renderResourceHeaders({}, context).link).toBe(headers)
      expect(headers).toContain('rel="modulepreload"')
      expect(filteredHeaders).not.toContain('rel="modulepreload"')

      const filteredHints = renderResourceHints({}, context, { scripts: false })
      const hints = renderResourceHints({}, context)
      expect(renderResourceHints({}, context, { scripts: false })).toBe(filteredHints)
      expect(renderResourceHints({}, context)).toBe(hints)
      expect(hints).toContain('rel="modulepreload"')
      expect(filteredHints).not.toContain('rel="modulepreload"')
    })

    it('is unchanged when no options are passed', async () => {
      const context = await getFontRenderer()
      expect(renderResourceHints({}, context)).toMatchInlineSnapshot(`"<link rel="modulepreload" as="script" crossorigin href="/assets/entry.mjs"><link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/font.woff2">"`)
      expect(renderResourceHeaders({}, context)).toMatchInlineSnapshot(`
        {
          "link": "</assets/entry.mjs>; rel="modulepreload"; as="script"; crossorigin, </assets/font.woff2>; rel="preload"; as="font"; type="font/woff2"; crossorigin",
        }
      `)
      expect(getPreloadLinks({}, context).map(l => l.href)).toMatchInlineSnapshot(`
        [
          "/assets/entry.mjs",
          "/assets/font.woff2",
        ]
      `)
    })
  })
})
