import { ManifestChunk as ViteManifestChunk } from 'vite'

export interface ManifestChunk extends ViteManifestChunk {
  isModule?: boolean
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
  asType?: 'audio' | 'document' | 'embed' | 'fetch' | 'font' | 'image' | 'object' | 'script' | 'style' | 'track' | 'worker' | 'video'
  contentType?: string
}

export interface Manifest {
  [key: string]: ManifestChunk
}
