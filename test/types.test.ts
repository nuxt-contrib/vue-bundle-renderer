import { expectTypeOf } from 'expect-type'
import { describe, it } from 'vitest'

import type { Manifest as ViteManifest } from 'vite'
import type { Manifest, ManifestChunk } from '../src/manifest'

describe('manifest', () => {
  it('matches vite types', () => {
    expectTypeOf<ViteManifest>().toMatchTypeOf<Manifest>()
    expectTypeOf<ViteManifest>().toEqualTypeOf<Record<string, Omit<ManifestChunk, 'asType' | 'isModule' | 'contentType'>>>()
  })
})
