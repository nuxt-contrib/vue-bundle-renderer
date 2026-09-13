import { describe } from 'vitest'
import { normalizeWebpackManifest, type WebpackClientManifest } from '../src/webpack'
import { bench, sink } from './_harness'

import smallWebpackManifest from '../test/fixtures/webpack-manifest.json'
import largeWebpackManifest from './fixtures/large-webpack-manifest.json'

function buildWebpackManifest(pages: number): WebpackClientManifest {
  const initial = ['runtime.js', 'commons/app.js', 'app.css', 'app.js']
  const all: string[] = [...initial]
  const async: string[] = []
  const modules: Record<string, number[]> = {}
  for (let i = 0; i < pages; i++) {
    const js = `pages/page-${i}.js`
    const css = `pages/page-${i}.css`
    const asset = `assets/asset-${i}.png`
    all.push(js, css, asset)
    async.push(js, css)
    modules[`module-${i}`] = [all.length - 3, all.length - 2]
  }
  return { publicPath: '/_nuxt/', all, initial, async, modules }
}

describe('normalizeWebpackManifest', () => {
  bench(`fixture: small (${smallWebpackManifest.all.length} files)`, () => {
    sink(normalizeWebpackManifest(smallWebpackManifest))
  })

  bench(`fixture: large (${largeWebpackManifest.all.length} files)`, () => {
    sink(normalizeWebpackManifest(largeWebpackManifest))
  })

  for (const pages of [100, 1000, 5000]) {
    const manifest = buildWebpackManifest(pages)
    bench(`synthetic: ${pages} pages (${manifest.all.length} files)`, () => {
      sink(normalizeWebpackManifest(manifest))
    })
  }
})
