import { describe } from 'vitest'
import { precomputeDependencies } from '../src/precompute'
import { bench } from './_harness'
import { POOL_SIZE, SET_SIZES, fullRequest, makeContext, warm } from './_renderer'
import { buildFixedSizeSetPool, buildSyntheticManifest } from './_synthetic'

const syntheticManifest = buildSyntheticManifest({ components: 2000, pages: 5000 })
const syntheticPrecomputed = precomputeDependencies(syntheticManifest)

describe(`full request, hot: deps + rendered output cached (${POOL_SIZE} sets per iteration)`, () => {
  const ctx = makeContext({ precomputed: syntheticPrecomputed })
  const pools = SET_SIZES.map(size => buildFixedSizeSetPool(syntheticManifest, size, POOL_SIZE, 1337 + size))
  for (const pool of pools) {
    warm(pool, ctx)
  }

  for (const [index, size] of SET_SIZES.entries()) {
    const pool = pools[index]!
    bench(`${size} modules per request`, () => {
      for (let i = 0; i < pool.length; i++) {
        fullRequest(pool[i]!, ctx)
      }
    })
  }
})
