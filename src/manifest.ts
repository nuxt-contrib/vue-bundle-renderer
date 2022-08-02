export interface ResourceMeta {
  // https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/manifest.ts#L8-L19
  src?: string
  file: string
  css?: string[]
  assets?: string[]
  isEntry?: boolean
  isDynamicEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
  // Augmentation for vue-bundle-renderer
  module?: boolean
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
  contentType?: 'audio' | 'document' | 'embed' | 'fetch' | 'font' | 'image' | 'object' | 'script' | 'style' | 'track' | 'worker' | 'video'
  mimeType?: string
}

export interface Manifest {
  [key: string]: ResourceMeta
}
