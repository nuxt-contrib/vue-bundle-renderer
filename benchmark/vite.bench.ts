import { describe } from 'vitest'
import type { Manifest as ViteManifest } from 'vite'
import { normalizeViteManifest } from '../src/vite'
import { bench, sink } from './_harness'

import smallViteManifest from '../test/fixtures/vite-manifest.json'
import largeViteManifest from './fixtures/large-vite-manifest.json'

function buildViteManifest(pages: number, componentsPerPage: number): ViteManifest {
  const manifest: ViteManifest = {
    '_vendor.js': { file: '_vendor.js' },
    'entry.ts': {
      file: 'entry.js',
      src: 'entry.ts',
      isEntry: true,
      imports: ['_vendor.js'],
      css: ['entry.css'],
      dynamicImports: [],
      assets: ['logo.svg', 'favicon.ico'],
    },
  }
  for (let i = 0; i < pages; i++) {
    const pageKey = `pages/page-${i}.vue`
    manifest[pageKey] = {
      file: `pages/page-${i}.js`,
      src: pageKey,
      isDynamicEntry: true,
      imports: ['_vendor.js'],
      css: [`pages/page-${i}.css`],
      dynamicImports: [],
      assets: [`assets/bg-${i}.jpg`],
    }
    for (let j = 0; j < componentsPerPage; j++) {
      const componentKey = `components/page-${i}/comp-${j}.vue`
      manifest[componentKey] = {
        file: `components/page-${i}/comp-${j}.js`,
        src: componentKey,
        isDynamicEntry: true,
        imports: ['_vendor.js'],
        css: [`components/page-${i}/comp-${j}.css`],
      }
      manifest[pageKey]!.dynamicImports!.push(componentKey)
    }
    manifest['entry.ts']!.dynamicImports!.push(pageKey)
  }
  return manifest
}

describe('normalizeViteManifest', () => {
  bench(`fixture: small (${Object.keys(smallViteManifest).length} entries)`, () => {
    sink(normalizeViteManifest(smallViteManifest))
  })

  bench(`fixture: large (${Object.keys(largeViteManifest).length} entries)`, () => {
    sink(normalizeViteManifest(largeViteManifest))
  })

  for (const [pages, components] of [[20, 5], [200, 5], [1000, 5]] as const) {
    const manifest = buildViteManifest(pages, components)
    bench(`synthetic: ${pages} pages x ${components} components (${Object.keys(manifest).length} entries)`, () => {
      sink(normalizeViteManifest(manifest))
    })
  }
})
