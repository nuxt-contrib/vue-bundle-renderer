import { bench, describe } from 'vitest'
import { createRendererContext, getRequestDependencies } from '../src/runtime'
import { buildSetPool, buildSyntheticManifest } from './_synthetic'

// coverage for the dependency-merge layer under *varying* request input,

const manifest = buildSyntheticManifest()

const highCardinalityPool = buildSetPool(manifest, 4096, 42)
const lowCardinalityPool = buildSetPool(manifest, 10, 7)

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

  // Smaller cap, same pool: pool/cap ratio is much larger, so most lookups
  // are misses and eviction runs on every other call. Tracks the cost of
  // the eviction policy itself.
  bench('high cardinality, cache size=100', () => {
    const ctx = createRendererContext({ manifest, dependencySetsCacheSize: 100 })
    for (let i = 0; i < highCardinalityPool.length; i++) {
      getRequestDependencies({ modules: highCardinalityPool[i]! }, ctx)
    }
  })

  // Cache disabled: short-circuits the cache lookup entirely. Documents the
  // option's behaviour and catches regressions in the disabled path.
  bench('high cardinality, cache disabled', () => {
    const ctx = createRendererContext({ manifest, dependencySetsCacheSize: 0 })
    for (let i = 0; i < highCardinalityPool.length; i++) {
      getRequestDependencies({ modules: highCardinalityPool[i]! }, ctx)
    }
  })
})
