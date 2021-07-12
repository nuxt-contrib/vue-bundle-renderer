import { Resource } from './renderer'

export function isJS (file: string) {
  return /\.[m?]js(\?[^.]+)?$/.test(file)
}

export function isCSS (file: string) {
  return /\.css(\?[^.]+)?$/.test(file)
}

export function normalizeFile (file: string): Resource {
  const withoutQuery = file.replace(/\?.*/, '')
  const extension = withoutQuery.split('.').pop() || ''
  return {
    file,
    extension,
    fileWithoutQuery: withoutQuery,
    asType: getPreloadType(extension)
  }
}

export function ensureTrailingSlash (path: string) {
  if (path === '') {
    return path
  }
  return path.replace(/([^/])$/, '$1/')
}

export function getPreloadType (ext: string): string {
  if (ext === 'js') {
    return 'script'
  } else if (ext === 'css') {
    return 'style'
  } else if (/jpe?g|png|svg|gif|webp|ico/.test(ext)) {
    return 'image'
  } else if (/woff2?|ttf|otf|eot/.test(ext)) {
    return 'font'
  } else {
    // not exhausting all possibilities here, but above covers common cases
    return ''
  }
}
