import { describe } from 'vitest'
import { createRendererContext, getRequestDependencies } from '../src/runtime'
import { bench, sink } from './_harness'
import { buildSetPool, buildSyntheticManifest } from './_synthetic'

const manifest = buildSyntheticManifest()

const distinctSets = buildSetPool(manifest, 4096, 42)
const repeatedSets = buildSetPool(manifest, 64, 7)

const REQUESTS = 1000

describe('getRequestDependencies', () => {
  const warmContext = createRendererContext({ manifest })
  for (const modules of repeatedSets) {
    getRequestDependencies({ modules }, warmContext)
  }

  bench(`warm cache: ${repeatedSets.length} sets repeated over ${REQUESTS} requests`, () => {
    for (let i = 0; i < REQUESTS; i++) {
      sink(getRequestDependencies({ modules: repeatedSets[i % repeatedSets.length]! }, warmContext))
    }
  })

  bench(`cold cache: ${distinctSets.length} distinct sets, default cache size`, () => {
    const ctx = createRendererContext({ manifest })
    for (let i = 0; i < distinctSets.length; i++) {
      sink(getRequestDependencies({ modules: distinctSets[i]! }, ctx))
    }
  }, { heavy: true })

  bench(`cold cache: ${distinctSets.length} distinct sets, cache size 100 (eviction on most calls)`, () => {
    const ctx = createRendererContext({ manifest, dependencySetsCacheSize: 100 })
    for (let i = 0; i < distinctSets.length; i++) {
      sink(getRequestDependencies({ modules: distinctSets[i]! }, ctx))
    }
  }, { heavy: true })

  bench(`cache disabled: ${distinctSets.length} distinct sets`, () => {
    const ctx = createRendererContext({ manifest, dependencySetsCacheSize: 0 })
    for (let i = 0; i < distinctSets.length; i++) {
      sink(getRequestDependencies({ modules: distinctSets[i]! }, ctx))
    }
  }, { heavy: true })

  const exclude = ['entry.mjs']
  bench(`exclude option: ${repeatedSets.length} sets repeated over ${REQUESTS} requests`, () => {
    for (let i = 0; i < REQUESTS; i++) {
      sink(getRequestDependencies({ modules: repeatedSets[i % repeatedSets.length]! }, warmContext, { exclude }))
    }
  })
})
