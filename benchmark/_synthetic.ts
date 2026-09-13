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

const SCRIPT_EXTS = ['js', 'mjs', 'cjs']
const STYLE_EXTS = ['css', 'scss', 'less']
const IMAGE_EXTS = ['png', 'svg', 'jpg', 'webp']
const FONT_EXTS = ['woff2', 'woff', 'ttf']
const MEDIA_EXTS = ['mp4', 'webm', 'mp3']
const OTHER_EXTS = ['json', 'wasm', 'txt', 'pdf']

type AssetKind = 'script' | 'style' | 'image' | 'font' | 'media' | 'other' | 'extensionless'

const KIND_WEIGHTS: [AssetKind, number][] = [
  ['script', 0.45],
  ['style', 0.25],
  ['image', 0.15],
  ['font', 0.05],
  ['media', 0.03],
  ['other', 0.05],
  ['extensionless', 0.02],
]

const EXTENSIONS_BY_KIND: Record<AssetKind, readonly string[]> = {
  script: SCRIPT_EXTS,
  style: STYLE_EXTS,
  image: IMAGE_EXTS,
  font: FONT_EXTS,
  media: MEDIA_EXTS,
  other: OTHER_EXTS,
  extensionless: [''],
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

// Bundler-shaped asset paths, weighted towards scripts and styles.
export function buildAssetPathPool(size: number, seed: number, kind?: AssetKind): string[] {
  const rng = mulberry32(seed)
  const pool: string[] = []
  for (let i = 0; i < size; i++) {
    let k: AssetKind = kind || 'other'
    if (!kind) {
      let r = rng()
      for (const [candidate, weight] of KIND_WEIGHTS) {
        r -= weight
        if (r <= 0) {
          k = candidate
          break
        }
      }
    }
    const hash = Math.floor(rng() * 0xFFFFFFFF).toString(16).padStart(8, '0')
    const dir = rng() < 0.5 ? '' : rng() < 0.5 ? 'assets/' : `chunks/${Math.floor(rng() * 10)}/`
    const query = rng() < 0.1 ? `?v=${Math.floor(rng() * 1000)}` : ''
    const ext = pick(rng, EXTENSIONS_BY_KIND[k])
    pool.push(`${dir}${k}-${i}.${hash}${ext ? `.${ext}` : ''}${query}`)
  }
  return pool
}
