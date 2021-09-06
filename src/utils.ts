const IS_JS_RE = /\.[cm]?js(\?[^.]+)?$/
const IS_MODULE_RE = /\.mjs(\?[^.]+)?$/
const HAS_EXT_RE = /[^./]+\.[^./]+$/
const IS_CSS_RE = /\.css(\?[^.]+)?$/

export function isJS (file: string) {
  return IS_JS_RE.test(file) || !HAS_EXT_RE.test(file)
}

export function isModule (file: string) {
  return IS_MODULE_RE.test(file) || !HAS_EXT_RE.test(file)
}

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
}

export function getExtension (file: string) {
  const withoutQuery = file.replace(/\?.*/, '')
  return withoutQuery.split('.').pop() || ''
}

export function ensureTrailingSlash (path: string) {
  if (path === '') {
    return path
  }
  return path.replace(/([^/])$/, '$1/')
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
