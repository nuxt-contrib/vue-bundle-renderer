import { describe, expect, it } from 'vitest'
import { createRenderer } from '../src/runtime'
import { precomputeDependencies } from '../src/precompute'
import { normalizeViteManifest } from '../src/vite'
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

  it('should throw error when neither manifest nor precomputed provided', () => {
    expect(() => {
      createRenderer(() => ({}), {
        renderToString: () => '<div>test</div>',
        buildAssetsURL: id => `/_nuxt/${id}`,
      })
    }).toThrow('Either manifest or precomputed data must be provided')
  })
})
