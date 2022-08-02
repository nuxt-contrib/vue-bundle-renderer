import { expectTypeOf } from 'expect-type'
import { describe, it } from 'vitest'

import type { Manifest as ViteManifest } from 'vite'
import type { Manifest, ResourceMeta } from '../src/manifest'
import { createRendererManifest } from '../src'

import viteManifest from './fixtures/vite-manifest.json'
import webpackManifest from './fixtures/webpack-manifest.json'

describe('manifest', () => {
  it('matches vite types', () => {
    expectTypeOf<ViteManifest>().toMatchTypeOf<Manifest>()
    expectTypeOf<ViteManifest>().toEqualTypeOf<Record<string, Omit<ResourceMeta, 'contentType' | 'module' | 'mimeType'>>>()
  })
})

describe('createRendererManifest', () => {
  it.skip('only accepts correct bundler option', () => {
    // @ts-expect-error
    createRendererManifest(viteManifest)
    // @ts-expect-error
    createRendererManifest(viteManifest, { bundler: 'webpack' })
    expectTypeOf(createRendererManifest(viteManifest, { bundler: 'vite' })).toEqualTypeOf<Manifest>()
    // @ts-expect-error
    createRendererManifest(webpackManifest)
    // @ts-expect-error
    createRendererManifest(webpackManifest, { bundler: 'vite' })
    expectTypeOf(createRendererManifest(webpackManifest, { bundler: 'webpack' })).toEqualTypeOf<Manifest>()
  })
})
