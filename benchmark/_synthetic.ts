import type { Manifest, ResourceMeta } from '../src/types'

export function buildSyntheticManifest({ components = 200, pages = 500 } = {}): Manifest {
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

export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = seed
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Builds `size` distinct module-key sets to feed into render / dependency
// benches. Each set anchors on a random page and is padded with 3..6 random
// components, matching what `dependencies.bench.ts` has always done.
export function buildSetPool(manifest: Manifest, size: number, seed: number): Set<string>[] {
  const pageKeys = Object.keys(manifest).filter(k => k.startsWith('pages/'))
  const componentKeys = Object.keys(manifest).filter(k => k.startsWith('components/'))
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

// Builds `poolSize` distinct module-key sets of exactly `setSize` modules
// (one page key + components until the set reaches the requested size).
// Used by render benches to keep the per-call work fixed across the pool.
export function buildFixedSizeSetPool(
  manifest: Manifest,
  setSize: number,
  poolSize: number,
  seed: number,
): Set<string>[] {
  const pageKeys = Object.keys(manifest).filter(k => k.startsWith('pages/'))
  const componentKeys = Object.keys(manifest).filter(k => k.startsWith('components/'))
  const rng = mulberry32(seed)
  const pool: Set<string>[] = []
  for (let i = 0; i < poolSize; i++) {
    const set = new Set<string>()
    set.add(pageKeys[Math.floor(rng() * pageKeys.length)]!)
    while (set.size < setSize) {
      set.add(componentKeys[Math.floor(rng() * componentKeys.length)]!)
    }
    pool.push(set)
  }
  return pool
}
