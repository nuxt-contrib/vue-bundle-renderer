export interface ResourceMeta {
  // https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/manifest.ts#L8-L19
  src?: string
  name?: string
  file: string
  css?: string[]
  assets?: string[]
  isEntry?: boolean
  isDynamicEntry?: boolean
  sideEffects?: boolean
  imports?: string[]
  dynamicImports?: string[]
  // Augmentations for vue-bundle-renderer
  module?: boolean
  prefetch?: boolean
  preload?: boolean
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
  resourceType?: 'audio' | 'document' | 'embed' | 'fetch' | 'font' | 'image' | 'object' | 'script' | 'style' | 'track' | 'worker' | 'video'
  mimeType?: string
}

export interface Manifest {
  [key: string]: ResourceMeta
}

export function defineManifest(manifest: Manifest): Manifest {
  return manifest
}
