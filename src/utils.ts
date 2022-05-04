const IS_JS_RE = /\.[cm]?js(\?[^.]+)?$/
const HAS_EXT_RE = /[^./]+\.[^./]+$/
const IS_CSS_RE = /\.(css|postcss|sass|scss|less|stylus|styl)(\?[^.]+)?$/

export function isJS (file: string) {
  return IS_JS_RE.test(file) || !HAS_EXT_RE.test(file)
}

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
}

const contentTypeMap: Record<string, string> = {
  ico: 'image/x-icon',
  jpg: 'image/jpeg',
  svg: 'image/svg+xml'
}

export function getContentType (asType: string | null, extension: string) {
  if (asType === 'font') {
    return `font/${extension}`
  }
  if (asType === 'image') {
    return contentTypeMap[extension] || `image/${extension}`
  }
}

const IMAGE_RE = /jpe?g|png|svg|gif|webp|ico/
const FONT_RE = /woff2?|ttf|otf|eot/

export function getAsType (ext: string): 'script' | 'style' | 'image' | 'font' | undefined {
  if (ext === 'js' || ext === 'cjs' || ext === 'mjs') {
    return 'script'
  } else if (ext === 'css') {
    return 'style'
  } else if (IMAGE_RE.test(ext)) {
    return 'image'
  } else if (FONT_RE.test(ext)) {
    return 'font'
  } else {
    // not exhausting all possibilities here, but above covers common cases
    return undefined
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
  `<${attrs.href}>${Object.entries(attrs).map(([key, value]) => key === 'href' || value === null ? '' : value ? `; ${key}="${value}"` : '; ').join('')}`

export interface ParsedResource {
  path: string
  isModule: boolean
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
  asType: 'audio' | 'document' | 'embed' | 'fetch' | 'font' | 'image' | 'object' | 'script' | 'style' | 'track' | 'worker' | 'video' | null
  contentType: string | null
}

export const parseResource = (path: string): ParsedResource => {
  const extension = path.replace(/\?.*/, '').split('.').pop() || ''
  const asType = getAsType(extension) || null
  return {
    path,
    asType,
    isModule: extension === 'mjs',
    contentType: getContentType(asType, extension) || null
  }
}
