import { bench, describe } from 'vitest'
import type { Manifest, ResourceMeta } from '../src/types'
import { createRendererContext, getRequestDependencies } from '../src/runtime'

// coverage for the dependency-merge layer under *varying* request input,
function buildSyntheticManifest({ components = 200, pages = 500 } = {}): Manifest {
  const m: Record<string, ResourceMeta> = {
    'vendor.mjs': { file: 'vendor.mjs', resourceType: 'script', module: true, preload: true },
    'entry.mjs': {
      file: 'entry.mjs',
      isEntry: true,
      resourceType: 'script',
      module: true,
      preload: true,
      imports: ['vendor.mjs'],
      css: ['entry.css'],
    },
    'entry.css': { file: 'entry.css', resourceType: 'style', preload: true, prefetch: true },
  }
  for (let i = 0; i < components; i++) {
    const id = `components/c-${i}.vue`
    m[id] = {
      file: `c-${i}.mjs`,
      resourceType: 'script',
      module: true,
      preload: true,
      imports: ['vendor.mjs'],
      css: [`c-${i}.css`],
    }
    m[`c-${i}.css`] = { file: `c-${i}.css`, resourceType: 'style', preload: true, prefetch: true }
  }
  for (let i = 0; i < pages; i++) {
    const id = `pages/p-${i}.vue`
    const dynImports: string[] = []
    for (let j = 0; j < 4; j++) {
      dynImports.push(`components/c-${(i * 7 + j) % components}.vue`)
    }
    m[id] = {
      file: `p-${i}.mjs`,
      resourceType: 'script',
      module: true,
      preload: true,
      isDynamicEntry: true,
      imports: ['vendor.mjs'],
      dynamicImports: dynImports,
      css: [`p-${i}.css`],
    }
    m[`p-${i}.css`] = { file: `p-${i}.css`, resourceType: 'style', preload: true, prefetch: true }
  }
  return m
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = seed
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const manifest = buildSyntheticManifest()
const pageKeys = Object.keys(manifest).filter(k => k.startsWith('pages/'))
const componentKeys = Object.keys(manifest).filter(k => k.startsWith('components/'))

// pre-build a pool of distinct module sets so the bench loop allocates
// nothing of its own.
function buildSetPool(size: number, seed: number) {
  const rng = mulberry32(seed)
  const pool: Set<string>[] = []
  for (let i = 0; i < size; i++) {
    const set = new Set<string>([pageKeys[Math.floor(rng() * pageKeys.length)]!])
    const extra = 3 + Math.floor(rng() * 4)
    for (let j = 0; j < extra; j++) {
      set.add(componentKeys[Math.floor(rng() * componentKeys.length)]!)
    }
    pool.push(set)
  }
  return pool
}

const highCardinalityPool = buildSetPool(4096, 42)
const lowCardinalityPool = buildSetPool(10, 7)

// each bench simulates a batch of SSR requests so vitest's per-iteration
// overhead amortises across a realistic chunk of work.

const BATCH = 1000

describe('getRequestDependencies', () => {
  // low-cardinality: a stable set of route shells repeated
  bench('low cardinality (10 sets repeated)', () => {
    const ctx = createRendererContext({ manifest })
    for (let i = 0; i < BATCH; i++) {
      getRequestDependencies({ modules: lowCardinalityPool[i % lowCardinalityPool.length]! }, ctx)
    }
  })

  // high-cardinality: one distinct set per request
  bench('high cardinality (4096 distinct sets)', () => {
    const ctx = createRendererContext({ manifest })
    for (let i = 0; i < highCardinalityPool.length; i++) {
      getRequestDependencies({ modules: highCardinalityPool[i]! }, ctx)
    }
  })
})
