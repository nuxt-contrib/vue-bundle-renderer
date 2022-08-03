import { Manifest } from './manifest'

export { normalizeViteManifest } from './vite'
export { normalizeWebpackManifest } from './webpack'
export type { Manifest, ResourceMeta } from './manifest'

export function defineManifest (manifest: Manifest): Manifest {
  return manifest
}
