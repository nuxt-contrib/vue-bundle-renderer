import { expectTypeOf } from 'expect-type'
import { describe, it } from 'vitest'

import type { Manifest as ViteManifest } from 'vite'
import type { Manifest, ResourceMeta } from '../src/types'

describe('manifest', () => {
  it('matches vite types', () => {
    expectTypeOf<ViteManifest>().toMatchTypeOf<Manifest>()
    expectTypeOf<ViteManifest>().toEqualTypeOf<Record<string, Omit<ResourceMeta, 'resourceType' | 'module' | 'mimeType' | 'sideEffects'>>>()
  })
})
