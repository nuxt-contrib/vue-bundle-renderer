import { describe, expect, it } from 'vitest'

import { createRendererContext, getAllDependencies } from '../src/runtime'
import { normalizeViteManifest } from '../src/vite'
import viteManifest from './fixtures/vite-manifest.json'

const baseManifest = normalizeViteManifest(viteManifest)

function dummyManifest(extraIds: string[]) {
  const m = { ...baseManifest }
  for (const id of extraIds) {
    if (!m[id]) {
      m[id] = { file: `${id}.mjs`, resourceType: 'script', module: true, preload: true }
    }
  }
  return m
}

describe('_dependencySets LRU', () => {
  it('evicts the oldest entry when size exceeds the cap', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `mod-${i}.mjs`)
    const ctx = createRendererContext({
      manifest: dummyManifest(ids),
      dependencySetsCacheSize: 3,
    })

    for (const id of ids.slice(0, 3)) {
      getAllDependencies(new Set([id]), ctx)
    }
    const firstKey = [...ctx._dependencySets.keys()][0]
    expect(ctx._dependencySets.size).toBe(3)
    expect(firstKey).toContain('mod-0.mjs')

    getAllDependencies(new Set([ids[3]]), ctx)
    expect(ctx._dependencySets.size).toBe(3)
    expect([...ctx._dependencySets.keys()].some(k => k.includes('mod-0.mjs'))).toBe(false)
    expect([...ctx._dependencySets.keys()].some(k => k.includes('mod-3.mjs'))).toBe(true)
  })

  it('promotes a cache hit to MRU once the cache is at capacity', () => {
    // Below the cap there is nothing to evict, so the implementation skips
    // the MRU shuffle on the hot path. Once we are at capacity, promotion
    // kicks in and protects the touched entry from the next eviction.
    const ids = Array.from({ length: 4 }, (_, i) => `keep-${i}.mjs`)
    const ctx = createRendererContext({
      manifest: dummyManifest(ids),
      dependencySetsCacheSize: 3,
    })

    for (const id of ids.slice(0, 3)) {
      getAllDependencies(new Set([id]), ctx)
    }
    // Cache is now at capacity. Touching the oldest entry must promote it.
    getAllDependencies(new Set([ids[0]]), ctx)
    // Insert a fourth distinct entry; the oldest now is keep-1, not keep-0.
    getAllDependencies(new Set([ids[3]]), ctx)

    const keys = [...ctx._dependencySets.keys()]
    expect(keys.some(k => k.includes('keep-0.mjs'))).toBe(true)
    expect(keys.some(k => k.includes('keep-1.mjs'))).toBe(false)
  })

  it('preserves insertion order on cache hits while below capacity', () => {
    // Documents the hot-path optimisation: while there is room to grow,
    // cache hits do not reshuffle the Map. Insertion order is preserved.
    const ids = Array.from({ length: 3 }, (_, i) => `order-${i}.mjs`)
    const ctx = createRendererContext({
      manifest: dummyManifest(ids),
      dependencySetsCacheSize: 10,
    })

    for (const id of ids) {
      getAllDependencies(new Set([id]), ctx)
    }
    const before = [...ctx._dependencySets.keys()]
    getAllDependencies(new Set([ids[0]]), ctx)
    getAllDependencies(new Set([ids[0]]), ctx)
    expect([...ctx._dependencySets.keys()]).toEqual(before)
  })

  it('skips the cache entirely when dependencySetsCacheSize is 0', () => {
    const ctx = createRendererContext({
      manifest: baseManifest,
      dependencySetsCacheSize: 0,
    })

    const a = getAllDependencies(new Set(['pages/index.vue']), ctx)
    const b = getAllDependencies(new Set(['pages/index.vue']), ctx)

    expect(ctx._dependencySets.size).toBe(0)
    // Identical input still produces equivalent output, just not the same reference.
    expect(a).not.toBe(b)
    expect(Object.keys(a.styles)).toEqual(Object.keys(b.styles))
  })

  it('treats negative and non-finite cache sizes as disabled', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const ctx = createRendererContext({
        manifest: baseManifest,
        dependencySetsCacheSize: value,
      })
      getAllDependencies(new Set(['pages/index.vue']), ctx)
      expect(ctx._dependencySets.size, `value=${value}`).toBe(0)
    }
  })

  it('defaults to a cap of 1000 when no option is provided', () => {
    const ctx = createRendererContext({ manifest: baseManifest })
    expect(ctx._dependencySetsCacheSize).toBe(1000)
  })

  it('updateManifest resets the cache', () => {
    const ctx = createRendererContext({
      manifest: baseManifest,
      dependencySetsCacheSize: 10,
    })
    getAllDependencies(new Set(['pages/index.vue']), ctx)
    expect(ctx._dependencySets.size).toBeGreaterThan(0)

    ctx.updateManifest(baseManifest)
    expect(ctx._dependencySets.size).toBe(0)
  })

  it('keeps the cache bounded under a high-cardinality workload', () => {
    // Structural equivalent of "the renderer does not leak memory under
    // high-cardinality SSR". Drives 5000 distinct module sets through the
    // renderer at cap=50 and asserts the cache never grows past the cap.
    // If a future change reintroduces unbounded growth this test will catch
    // it without depending on `process.memoryUsage()` (which is jittery).
    const cap = 50
    const ids = Array.from({ length: 200 }, (_, i) => `m-${i}.mjs`)
    const ctx = createRendererContext({
      manifest: dummyManifest(ids),
      dependencySetsCacheSize: cap,
    })

    let maxSize = 0
    for (let i = 0; i < 5000; i++) {
      const set = new Set<string>()
      // 5 ids per set, deterministically chosen to produce many distinct sets.
      for (let j = 0; j < 5; j++) set.add(ids[(i * 7 + j * 13) % ids.length]!)
      getAllDependencies(set, ctx)
      if (ctx._dependencySets.size > maxSize) maxSize = ctx._dependencySets.size
    }

    expect(maxSize).toBeLessThanOrEqual(cap)
    expect(ctx._dependencySets.size).toBeLessThanOrEqual(cap)
  })
})
