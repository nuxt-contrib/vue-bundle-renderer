import { describe } from 'vitest'
import { getAsType, isCSS, isJS, parseResource } from '../src/utils'
import { bench, sink } from './_harness'
import { buildAssetPathPool } from './_synthetic'

const POOL_SIZE = 1000

const mixedPaths = buildAssetPathPool(POOL_SIZE, 1)
const scriptPaths = buildAssetPathPool(POOL_SIZE, 2, 'script')
const stylePaths = buildAssetPathPool(POOL_SIZE, 3, 'style')
const imagePaths = buildAssetPathPool(POOL_SIZE, 4, 'image')
const extensionlessPaths = buildAssetPathPool(POOL_SIZE, 5, 'extensionless')

const mixedExtensions = mixedPaths.map((p) => {
  const base = p.split('?', 1)[0]!
  const dot = base.lastIndexOf('.')
  return dot === -1 ? '' : base.slice(dot + 1)
})

describe(`isJS / isCSS (${POOL_SIZE} paths)`, () => {
  bench('isJS on mixed paths', () => {
    let hits = 0
    for (let i = 0; i < mixedPaths.length; i++) {
      if (isJS(mixedPaths[i]!)) hits++
    }
    sink(hits)
  })

  bench('isJS on script paths', () => {
    let hits = 0
    for (let i = 0; i < scriptPaths.length; i++) {
      if (isJS(scriptPaths[i]!)) hits++
    }
    sink(hits)
  })

  bench('isJS on extensionless paths', () => {
    let hits = 0
    for (let i = 0; i < extensionlessPaths.length; i++) {
      if (isJS(extensionlessPaths[i]!)) hits++
    }
    sink(hits)
  })

  bench('isCSS on mixed paths', () => {
    let hits = 0
    for (let i = 0; i < mixedPaths.length; i++) {
      if (isCSS(mixedPaths[i]!)) hits++
    }
    sink(hits)
  })

  bench('isCSS on style paths', () => {
    let hits = 0
    for (let i = 0; i < stylePaths.length; i++) {
      if (isCSS(stylePaths[i]!)) hits++
    }
    sink(hits)
  })
})

describe(`getAsType (${POOL_SIZE} extensions)`, () => {
  bench('mixed extensions', () => {
    for (let i = 0; i < mixedExtensions.length; i++) {
      sink(getAsType(mixedExtensions[i]!))
    }
  })
})

describe(`parseResource (${POOL_SIZE} paths)`, () => {
  bench('mixed paths', () => {
    for (let i = 0; i < mixedPaths.length; i++) {
      sink(parseResource(mixedPaths[i]!))
    }
  })

  bench('script paths', () => {
    for (let i = 0; i < scriptPaths.length; i++) {
      sink(parseResource(scriptPaths[i]!))
    }
  })

  bench('style paths', () => {
    for (let i = 0; i < stylePaths.length; i++) {
      sink(parseResource(stylePaths[i]!))
    }
  })

  bench('image paths', () => {
    for (let i = 0; i < imagePaths.length; i++) {
      sink(parseResource(imagePaths[i]!))
    }
  })
})
