import { describe } from 'vitest'
import { precomputeDependencies } from '../src/precompute'
import { bench } from './_harness'
import { POOL_SIZE, SET_SIZES, fullRequest, makeContext, relativeBuildAssetsURL } from './_renderer'
import { buildFixedSizeSetPool, buildSyntheticManifest } from './_synthetic'

const syntheticManifest = buildSyntheticManifest({ components: 2000, pages: 5000 })
const syntheticPrecomputed = precomputeDependencies(syntheticManifest)

// Separate file so the two buildAssetsURL functions never share call sites in one process.
describe(`full request, cold: cache disabled, relative URL (${POOL_SIZE} sets per iteration)`, () => {
  const ctx = makeContext({ precomputed: syntheticPrecomputed, buildAssetsURL: relativeBuildAssetsURL, dependencySetsCacheSize: 0 })
  for (const size of SET_SIZES) {
    const pool = buildFixedSizeSetPool(syntheticManifest, size, POOL_SIZE, 1337 + size)
    bench(`${size} modules per request`, () => {
      for (let i = 0; i < pool.length; i++) {
        fullRequest(pool[i]!, ctx)
      }
    }, { heavy: size >= 50 })
  }
})
