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

export interface ParsedResource {
  path: string
  isModule: boolean
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
  asType: 'audio' | 'document' | 'embed' | 'fetch' | 'font' | 'image' | 'object' | 'script' | 'style' | 'track' | 'worker' | 'video' | null
  contentType: string | null
}

const contentTypeMap: Record<string, string> = {
  ico: 'image/x-icon',
  jpg: 'image/jpeg',
  svg: 'image/svg+xml'
}

export function getContentType (asType: ParsedResource['asType'], extension: string) {
  if (asType === 'font') {
    return `font/${extension}`
  }
  if (asType === 'image') {
    return contentTypeMap[extension] || `image/${extension}`
  }
}

export function getAsType (ext: string): ParsedResource['asType'] {
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
  } else {
    // not exhausting all possibilities here, but above covers common cases
    return null
  }
}

// Utilities to render script and link tags, and link headers
export const renderScriptToString = (attrs: Record<string, string | null>) =>
  `<script${Object.entries(attrs).map(([key, value]) => value === null ? '' : value ? ` ${key}="${value}"` : ' ' + key).join('')}></script>`

export type LinkAttributes = {
  rel: string | null
  href: string
  as?: string | null
  type?: string | null
  crossorigin?: '' | null
}

export const renderLinkToString = (attrs: LinkAttributes) =>
  `<link${Object.entries(attrs).map(([key, value]) => value === null ? '' : value ? ` ${key}="${value}"` : ' ' + key).join('')}>`

export const renderLinkToHeader = (attrs: LinkAttributes) =>
  `<${attrs.href}>${Object.entries(attrs).map(([key, value]) => key === 'href' || value === null ? '' : value ? `; ${key}="${value}"` : `; ${key}`).join('')}`

export const parseResource = (path: string): ParsedResource => {
  const extension = path.replace(/\?.*/, '').split('.').pop() || ''
  const asType = getAsType(extension)
  return {
    path,
    asType,
    isModule: extension === 'mjs',
    contentType: getContentType(asType, extension) || null
  }
}
