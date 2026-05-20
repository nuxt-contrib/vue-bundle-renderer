import { bench, describe } from 'vitest'
import { normalizeViteManifest } from '../src'
import { precomputeDependencies } from '../src/precompute'

import viteManifest from '../test/fixtures/vite-manifest.json'
import { buildSyntheticManifest } from './_synthetic'

const normalizedSmall = normalizeViteManifest(viteManifest)
const normalizedLarge = buildSyntheticManifest({ components: 2000, pages: 5000 })

describe('precomputeDependencies', () => {
  bench('vite (small)', () => {
    precomputeDependencies(normalizedSmall)
  })

  bench('synthetic 2000/5000', () => {
    precomputeDependencies(normalizedLarge)
  })
})
