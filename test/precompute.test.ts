import { describe, expect, it } from 'vitest'
import { createRenderer, createRendererContext, getModuleDependencies } from '../src/runtime'
import { precomputeDependencies } from '../src/precompute'
import { normalizeViteManifest } from '../src/vite'
import type { Manifest } from '../src/types'
import viteManifest from './fixtures/vite-manifest.json'

describe('precomputed dependencies', () => {
  const normalizedManifest = normalizeViteManifest(viteManifest)

  it('should precompute dependencies correctly', () => {
    const precomputed = precomputeDependencies(normalizedManifest)

    expect(precomputed).toHaveProperty('dependencies')
    expect(precomputed).toHaveProperty('entrypoints')
    expect(precomputed).toHaveProperty('modules')

    // Should have dependencies for all modules
    expect(Object.keys(precomputed.dependencies).sort()).toEqual(Object.keys(normalizedManifest).sort())

    // Should identify entry points
    expect(precomputed.entrypoints).toContain('../packages/nuxt3/src/app/entry.ts')
  })

  it('should work with precomputed data instead of manifest', async () => {
    const precomputed = precomputeDependencies(normalizedManifest)

    // Create renderer with precomputed data (no manifest needed!)
    const renderer = createRenderer(() => ({}), {
      precomputed,
      renderToString: () => '<div>test</div>',
      buildAssetsURL: id => `/_nuxt/${id}`,
    })

    const result = await renderer.renderToString({
      modules: new Set(['pages/index.vue']),
    })

    expect(result.renderStyles().includes('index.css')).toBe(true)
    expect(result.renderScripts().includes('entry.mjs')).toBe(true)
  })

  it('should produce same results as manifest-based approach', async () => {
    const precomputed = precomputeDependencies(normalizedManifest)

    // Renderer with manifest (legacy)
    const manifestRenderer = createRenderer(() => ({}), {
      manifest: normalizedManifest,
      renderToString: () => '<div>test</div>',
      buildAssetsURL: id => `/_nuxt/${id}`,
    })

    // Renderer with precomputed data
    const precomputedRenderer = createRenderer(() => ({}), {
      precomputed,
      renderToString: () => '<div>test</div>',
      buildAssetsURL: id => `/_nuxt/${id}`,
    })

    const modules = new Set(['pages/index.vue'])

    const manifestResult = await manifestRenderer.renderToString({ modules })
    const precomputedResult = await precomputedRenderer.renderToString({ modules })

    // Should produce identical output
    expect(precomputedResult.renderStyles()).toBe(manifestResult.renderStyles())
    expect(precomputedResult.renderScripts()).toBe(manifestResult.renderScripts())
    expect(precomputedResult.renderResourceHints()).toBe(manifestResult.renderResourceHints())
  })

  it('should produce same results as manifest-based approach when dynamicImports are present', async () => {
    const manifest: Manifest = {
      'pages/index.vue': {
        file: 'index.mjs',
        isEntry: true,
        resourceType: 'script',
        module: true,
        preload: true,
        imports: ['vendor.mjs'],
        dynamicImports: ['components/lazy.vue'],
        css: ['index.css'],
      },
      'vendor.mjs': {
        file: 'vendor.mjs',
        resourceType: 'script',
        module: true,
        preload: true,
      },
      'index.css': {
        file: 'index.css',
        resourceType: 'style',
        preload: true,
        prefetch: true,
      },
      'components/lazy.vue': {
        file: 'lazy.mjs',
        resourceType: 'script',
        module: true,
        preload: true,
        prefetch: true,
        imports: ['vendor.mjs'],
        css: ['lazy.css'],
      },
      'lazy.css': {
        file: 'lazy.css',
        resourceType: 'style',
        preload: true,
        prefetch: true,
      },
    }

    const precomputed = precomputeDependencies(manifest)

    const manifestRenderer = createRenderer(() => ({}), {
      manifest,
      renderToString: () => '<div>test</div>',
      buildAssetsURL: id => `/_nuxt/${id}`,
    })

    const precomputedRenderer = createRenderer(() => ({}), {
      precomputed,
      renderToString: () => '<div>test</div>',
      buildAssetsURL: id => `/_nuxt/${id}`,
    })

    const modules = new Set(['pages/index.vue'])

    const manifestResult = await manifestRenderer.renderToString({ modules })
    const precomputedResult = await precomputedRenderer.renderToString({ modules })

    expect(manifestResult.renderResourceHints()).toContain('lazy.mjs')
    expect(precomputedResult.renderStyles()).toBe(manifestResult.renderStyles())
    expect(precomputedResult.renderScripts()).toBe(manifestResult.renderScripts())
    expect(precomputedResult.renderResourceHints()).toBe(manifestResult.renderResourceHints())
  })

  it('should not hoist nested dynamic imports into the entry prefetch set', async () => {
    const chunk = (file: string, extra: Partial<Manifest[string]> = {}): Manifest[string] => ({
      file,
      resourceType: 'script',
      module: true,
      prefetch: true,
      preload: true,
      ...extra,
    })

    const manifest: Manifest = {
      entry: chunk('entry.js', { isEntry: true, imports: ['app'] }),
      app: chunk('app.js', { imports: ['loader'] }),
      loader: chunk('loader.js', { dynamicImports: ['step'] }),
      step: chunk('step.js'),
    }

    const manifestRenderer = createRenderer(() => ({}), {
      manifest,
      renderToString: () => '<div>test</div>',
      buildAssetsURL: id => `/_nuxt/${id}`,
    })

    const precomputedRenderer = createRenderer(() => ({}), {
      precomputed: precomputeDependencies(manifest),
      renderToString: () => '<div>test</div>',
      buildAssetsURL: id => `/_nuxt/${id}`,
    })

    const manifestResult = await manifestRenderer.renderToString({})
    const precomputedResult = await precomputedRenderer.renderToString({})

    expect(manifestResult.renderResourceHints()).not.toContain('step.js')
    expect(precomputedResult.renderResourceHints()).toBe(manifestResult.renderResourceHints())
  })

  it('should resolve styles for every module in an import cycle regardless of manifest order', () => {
    const entries: Manifest = {
      'a.js': { file: 'a.js', resourceType: 'script', imports: ['_shared.js'] },
      '_shared.js': { file: 'shared.js', resourceType: 'script', css: ['shared.css'], imports: ['b.js'] },
      'b.js': { file: 'b.js', resourceType: 'script', imports: ['a.js'] },
      'shared.css': { file: 'shared.css', resourceType: 'style' },
    }

    for (const order of [['a.js', '_shared.js', 'b.js', 'shared.css'], ['b.js', 'a.js', '_shared.js', 'shared.css']]) {
      const manifest: Manifest = Object.fromEntries(order.map(id => [id, entries[id]!]))
      const precomputed = precomputeDependencies(manifest)
      const context = createRendererContext({ manifest })
      for (const id of ['a.js', '_shared.js', 'b.js']) {
        expect(Object.keys(precomputed.dependencies[id]!.styles)).toEqual(['shared.css'])
        expect(Object.keys(getModuleDependencies(id, context).styles)).toEqual(['shared.css'])
      }
    }
  })

  it('should include resources imported from outside a cycle and from nested cycles', () => {
    const entries: Manifest = {
      'entry.js': { file: 'entry.js', resourceType: 'script', isEntry: true, css: ['entry.css'], imports: ['a.js'] },
      'a.js': { file: 'a.js', resourceType: 'script', sideEffects: true, css: ['a.css'], imports: ['b.js', 'leaf.js'] },
      'b.js': { file: 'b.js', resourceType: 'script', sideEffects: true, css: ['b.css'], imports: ['a.js', 'c.js'] },
      'c.js': { file: 'c.js', resourceType: 'script', css: ['c.css'], imports: ['d.js'] },
      'd.js': { file: 'd.js', resourceType: 'script', css: ['d.css'], imports: ['c.js', 'leaf.js'] },
      'leaf.js': { file: 'leaf.js', resourceType: 'script', css: ['leaf.css'] },
      'entry.css': { file: 'entry.css', resourceType: 'style' },
      'a.css': { file: 'a.css', resourceType: 'style' },
      'b.css': { file: 'b.css', resourceType: 'style' },
      'c.css': { file: 'c.css', resourceType: 'style' },
      'd.css': { file: 'd.css', resourceType: 'style' },
      'leaf.css': { file: 'leaf.css', resourceType: 'style' },
    }
    const orders = [
      Object.keys(entries),
      ['d.js', 'b.js', 'leaf.js', 'entry.js', 'c.js', 'a.js', 'leaf.css', 'a.css', 'b.css', 'c.css', 'd.css', 'entry.css'],
    ]

    for (const order of orders) {
      const manifest: Manifest = Object.fromEntries(order.map(id => [id, entries[id]!]))
      const precomputed = precomputeDependencies(manifest).dependencies
      const context = createRendererContext({ manifest })
      for (const get of [(id: string) => precomputed[id]!, (id: string) => getModuleDependencies(id, context)]) {
        expect(Object.keys(get('entry.js').styles).sort()).toEqual(['a.css', 'b.css', 'c.css', 'd.css', 'entry.css', 'leaf.css'])
        expect(Object.keys(get('entry.js').scripts)).toEqual(['entry.js'])
        for (const id of ['a.js', 'b.js']) {
          expect(Object.keys(get(id).styles).sort()).toEqual(['a.css', 'b.css', 'c.css', 'd.css', 'leaf.css'])
          expect(Object.keys(get(id).scripts)).toEqual([id])
        }
        for (const id of ['c.js', 'd.js']) {
          expect(Object.keys(get(id).styles).sort()).toEqual(['c.css', 'd.css', 'leaf.css'])
          expect(Object.keys(get(id).scripts)).toEqual([])
        }
        expect(Object.keys(get('leaf.js').styles)).toEqual(['leaf.css'])
      }
    }
  })

  it('should throw error when neither manifest nor precomputed provided', () => {
    expect(() => {
      createRenderer(() => ({}), {
        renderToString: () => '<div>test</div>',
        buildAssetsURL: id => `/_nuxt/${id}`,
      })
    }).toThrow('Either manifest or precomputed data must be provided')
  })
})
