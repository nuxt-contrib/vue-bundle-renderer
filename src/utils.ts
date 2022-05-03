const IS_JS_RE = /\.[cm]?js(\?[^.]+)?$/
const IS_MODULE_RE = /\.mjs(\?[^.]+)?$/
const HAS_EXT_RE = /[^./]+\.[^./]+$/
const IS_CSS_RE = /\.(css|postcss|sass|scss|less|stylus|styl)(\?[^.]+)?$/

export function isJS (file: string) {
  return IS_JS_RE.test(file) || !HAS_EXT_RE.test(file)
}

export function isModule (file: string) {
  return IS_MODULE_RE.test(file) || !HAS_EXT_RE.test(file)
}

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
}

const contentTypeMap: Record<string, string> = {
  ico: 'image/x-icon',
  jpg: 'image/jpeg',
  svg: 'image/svg+xml'
}

export function getContentType (file: string) {
  const extension = file.replace(/\?.*/, '').split('.').pop() || ''
  const type = getPreloadType(extension)
  if (type === 'font') {
    return `font/${extension}`
  }
  if (type === 'image') {
    return contentTypeMap[extension] || `image/${extension}`
  }
}

export function getPreloadType (ext: string): 'script' | 'style' | 'image' | 'font' | undefined {
  if (ext === 'js' || ext === 'cjs' || ext === 'mjs') {
    return 'script'
  } else if (ext === 'css') {
    return 'style'
  } else if (/jpe?g|png|svg|gif|webp|ico/.test(ext)) {
    return 'image'
  } else if (/woff2?|ttf|otf|eot/.test(ext)) {
    return 'font'
  } else {
    // not exhausting all possibilities here, but above covers common cases
    return undefined
  }
}

// Utilities to render script and link tags, and link headers
export const renderScriptToString = (attrs: Record<string, string | null>) =>
  `<script${Object.entries(attrs).map(([key, value]) => value === null ? '' : value ? ` ${key}="${value}"` : ' ' + key).join('')}></script>`

export type LinkAttributes = Record<string, string | null> & { href: string }
export const renderLinkToString = (attrs: LinkAttributes) =>
  `<link${Object.entries(attrs).map(([key, value]) => value === null ? '' : value ? ` ${key}="${value}"` : ' ' + key).join('')}>`

export const renderLinkToHeader = (attrs: LinkAttributes) =>
  `<${attrs.href}>${Object.entries(attrs).map(([key, value]) => key === 'href' || value === null ? '' : value ? `; ${key}="${value}"` : '; ').join('')}`
