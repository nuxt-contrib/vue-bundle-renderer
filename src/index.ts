import type { Manifest as ViteManifest } from 'vite'
import { Manifest } from './manifest'
import { normalizeViteManifest } from './vite'
import { normalizeWebpackManifest, WebpackClientManifest } from './webpack'

export type { Manifest, ResourceMeta } from './manifest'

export * from './webpack'
export * from './vite'

export function createRendererManifest (manifest: ViteManifest | Manifest, options: { bundler: 'vite' }): Manifest
export function createRendererManifest (manifest: WebpackClientManifest, options: { bundler: 'webpack' }): Manifest
export function createRendererManifest (manifest: any, options: { bundler: 'vite' | 'webpack' }) {
  if (options.bundler === 'vite') {
    return normalizeViteManifest(manifest as ViteManifest | Manifest)
  }
  if (options.bundler === 'webpack') {
    return normalizeWebpackManifest(manifest as WebpackClientManifest)
  }
  throw new Error('Unknown bundler')
}
