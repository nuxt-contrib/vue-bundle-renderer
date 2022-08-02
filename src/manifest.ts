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

const IS_JS_RE = /\.[cm]?js(\?[^.]+)?$/
const HAS_EXT_RE = /[^./]+\.[^./]+$/
const IS_CSS_RE = /\.(css|postcss|sass|scss|less|stylus|styl)(\?[^.]+)?$/

export function isJS (file: string) {
  return IS_JS_RE.test(file) || !HAS_EXT_RE.test(file)
}

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
}

const IMAGE_RE = /^jpe?g|png|svg|gif|webp|ico$/
const FONT_RE = /^woff2?|ttf|otf|eot$/
const AUDIO_RE = /^mp3|wav|ogg|flac|aac|m4a|wma|aiff|aif|au|raw|vox|opus$/
const VIDEO_RE = /^mp4|webm|ogv|mkv|avi|mov|flv|wmv|mpg|mpeg|m4v|3gp|3g2|mxf|rm|rmvb|asf|asx|m3u8|m3u|pls|cue|m3u8$/

const contentTypeMap: Record<string, string> = {
  ico: 'image/x-icon',
  jpg: 'image/jpeg',
  svg: 'image/svg+xml'
}

export function getContentType (asType: ManifestChunk['asType'], extension: string) {
  if (asType === 'font') {
    return `font/${extension}`
  }
  if (asType === 'image') {
    return contentTypeMap[extension] || `image/${extension}`
  }
}

export function getAsType (ext: string): ManifestChunk['asType'] {
  if (ext === 'js' || ext === 'cjs' || ext === 'mjs') {
    return 'script'
  } else if (ext === 'css') {
    return 'style'
  } else if (IMAGE_RE.test(ext)) {
    return 'image'
  } else if (FONT_RE.test(ext)) {
    return 'font'
  } else if (AUDIO_RE.test(ext)) {
    return 'audio'
  } else if (VIDEO_RE.test(ext)) {
    return 'video'
  }
  // not exhausting all possibilities here, but above covers common cases
}

export const parseResource = (path: string) => {
  const chunk: Omit<ManifestChunk, 'file'> = {}

  const extension = path.replace(/\?.*/, '').split('.').pop() || ''

  const asType = getAsType(extension)
  if (asType) {
    chunk.asType = asType

    if (asType === 'script') {
      chunk.isModule = true
    }
  }

  const contentType = getContentType(asType, extension)
  if (contentType) {
    chunk.contentType = contentType
  }

  return chunk
}
