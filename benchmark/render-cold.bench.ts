import { describe } from 'vitest'
import { getResources, renderResourceHeaders, renderResourceHints, renderScripts, renderStyles } from '../src/runtime'
import { precomputeDependencies } from '../src/precompute'
import { bench, sink } from './_harness'
import { POOL_SIZE, SET_SIZES, fullRequest, makeContext } from './_renderer'
import { buildFixedSizeSetPool, buildSyntheticManifest } from './_synthetic'

const syntheticManifest = buildSyntheticManifest({ components: 2000, pages: 5000 })
const syntheticPrecomputed = precomputeDependencies(syntheticManifest)

const ctx = makeContext({ precomputed: syntheticPrecomputed, dependencySetsCacheSize: 0 })

describe(`full request, cold: cache disabled (${POOL_SIZE} sets per iteration)`, () => {
  for (const size of SET_SIZES) {
    const pool = buildFixedSizeSetPool(syntheticManifest, size, POOL_SIZE, 1337 + size)
    bench(`${size} modules per request`, () => {
      for (let i = 0; i < pool.length; i++) {
        fullRequest(pool[i]!, ctx)
      }
    }, { heavy: size >= 50 })
  }
})

describe(`individual render functions, cold: cache disabled, 50 modules (${POOL_SIZE} sets per iteration)`, () => {
  const pool = buildFixedSizeSetPool(syntheticManifest, 50, POOL_SIZE, 1387)

  bench('renderStyles', () => {
    for (let i = 0; i < pool.length; i++) {
      sink(renderStyles({ modules: pool[i]! }, ctx))
    }
  }, { heavy: true })

  bench('renderScripts', () => {
    for (let i = 0; i < pool.length; i++) {
      sink(renderScripts({ modules: pool[i]! }, ctx))
    }
  }, { heavy: true })

  bench('renderResourceHints', () => {
    for (let i = 0; i < pool.length; i++) {
      sink(renderResourceHints({ modules: pool[i]! }, ctx))
    }
  }, { heavy: true })

  bench('renderResourceHeaders', () => {
    for (let i = 0; i < pool.length; i++) {
      sink(renderResourceHeaders({ modules: pool[i]! }, ctx))
    }
  }, { heavy: true })

  bench('getResources', () => {
    for (let i = 0; i < pool.length; i++) {
      sink(getResources({ modules: pool[i]! }, ctx))
    }
  }, { heavy: true })
})
