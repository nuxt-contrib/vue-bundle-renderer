import { createMapper, AsyncFileMapper } from './mapper'
import { normalizeFile, isCSS, isJS, isModule, ensureTrailingSlash } from './utils'

// Webpack client manifest format
export type ClientManifest = {
  publicPath: string;
  all: Array<string>;
  initial: Array<string>;
  async: Array<string>;
  modules: {
    [id: string]: Array<number>;
  },
  hasNoCssVersion?: {
    [file: string]: boolean;
  }
}

// Newer (Vite/vue3) client manifest format:
type SourceFile = string
type OutputFile = string

export interface ManifestMeta {
  file: OutputFile
  src?: SourceFile
  isEntry?: boolean
  isDynamicEntry?: boolean
  dynamicImports?: SourceFile[]
  imports?: SourceFile[]
  css?: string[]
  assets?: string[]
}

export type Manifest = Record<SourceFile, ManifestMeta>

export type Resource = {
  file: string;
  extension: string;
  fileWithoutQuery: string;
  asType: string;
}

export type SSRContext = {
  getPreloadFiles?: Function,
  renderResourceHints?: Function,
  renderState?: Function,
  renderScripts?: Function,
  renderStyles?: Function,
  nonce?: string,
  head?: string,
  styles?: string,
  // Vite: https://vitejs.dev/guide/ssr.html#generating-preload-directives
  modules?: Set<SourceFile>,
  _mappedFiles?: Array<Resource>,
  _registeredComponents?: Set<any>,
}

export type RenderContext = {
  preloadFiles?: Array<any>,
  prefetchFiles?: Array<any>,
  shouldPrefetch?: (file: string, type: string) => boolean,
  shouldPreload?: (file: string, type: string) => boolean,
  publicPath?: string,
  clientManifest?: ClientManifest,
  manifest?: Manifest,
  mapFiles?: AsyncFileMapper,
  basedir?: string,
}

export type RenderOptions = Partial<RenderContext>

export function createRenderContext ({ clientManifest, publicPath, basedir, manifest }: RenderOptions) {
  const renderContext: RenderContext = {
    publicPath,
    basedir
  }

  if (clientManifest && clientManifest.publicPath) {
    // Legacy format
    renderContext.clientManifest = clientManifest

    renderContext.publicPath = renderContext.publicPath || renderContext.clientManifest.publicPath

    // preload/prefetch directives
    renderContext.preloadFiles = (renderContext.clientManifest.initial || []).map(normalizeFile)
    renderContext.prefetchFiles = (renderContext.clientManifest.async || []).map(normalizeFile)

    // Initial async chunk mapping
    renderContext.mapFiles = createMapper(renderContext.clientManifest)
  } else if (manifest || clientManifest) {
    // Explicit or detected modern manifest format
    renderContext.manifest = manifest || (clientManifest as unknown as Manifest)
    // Pre-compute entry files
    const entryFiles = Array.from(Object.values(renderContext.manifest || {}))
      .filter(i => i.isEntry)
    renderContext.preloadFiles = entryFiles.map(i => normalizeFile(i.file))
    renderContext.prefetchFiles = entryFiles.flatMap(e => [
      ...e.dynamicImports || [],
      ...e.imports || []
    ]).map(i => normalizeFile(renderContext.manifest![i].file))
  }

  renderContext.publicPath = ensureTrailingSlash(renderContext.publicPath || '/')

  return renderContext
}

export function renderStyles (ssrContext: SSRContext, renderContext: RenderContext): string {
  const initial = renderContext.preloadFiles || []
  const async = getUsedAsyncFiles(ssrContext, renderContext)
  const cssFiles = initial.concat(async).filter(({ file }) => isCSS(file))

  return cssFiles.map(({ file }) => {
    return `<link rel="stylesheet" href="${renderContext.publicPath}${file}">`
  }).join('')
}

export function renderResourceHints (ssrContext: SSRContext, renderContext: RenderContext): string {
  return renderPreloadLinks(ssrContext, renderContext) + renderPrefetchLinks(ssrContext, renderContext)
}

export function renderPreloadLinks (ssrContext: SSRContext, renderContext: RenderContext): string {
  const files = getPreloadFiles(ssrContext, renderContext)
  const shouldPreload = renderContext.shouldPreload
  if (files.length) {
    return files.map(({ file, extension, fileWithoutQuery, asType }) => {
      let extra = ''
      // by default, we only preload scripts or css
      if (!shouldPreload && asType !== 'script' && asType !== 'style') {
        return ''
      }
      // user wants to explicitly control what to preload
      if (shouldPreload && !shouldPreload(fileWithoutQuery, asType)) {
        return ''
      }
      if (asType === 'font') {
        extra = ` type="font/${extension}" crossorigin`
      }
      return `<link rel="${isModule(file) ? 'modulepreload' : 'preload'}" href="${
        renderContext.publicPath}${file
        }"${
        asType !== '' ? ` as="${asType}"` : ''
        }${
        extra
        }>`
    }).join('')
  } else {
    return ''
  }
}

export function renderPrefetchLinks (ssrContext: SSRContext, renderContext: RenderContext): string {
  const shouldPrefetch = renderContext.shouldPrefetch
  if (renderContext.prefetchFiles) {
    const usedAsyncFiles = getUsedAsyncFiles(ssrContext, renderContext)
    const alreadyRendered = (file: string) => {
      return usedAsyncFiles && usedAsyncFiles.some(f => f.file === file)
    }
    return renderContext.prefetchFiles.map(({ file, fileWithoutQuery, asType }) => {
      if (shouldPrefetch && !shouldPrefetch(fileWithoutQuery, asType)) {
        return ''
      }
      if (alreadyRendered(file)) {
        return ''
      }
      return `<link ${isModule(file) ? 'type="module" ' : ''}rel="prefetch" href="${renderContext.publicPath}${file}">`
    }).join('')
  } else {
    return ''
  }
}

export function renderScripts (ssrContext: SSRContext, renderContext: RenderContext): string {
  if (renderContext.preloadFiles) {
    const initial = renderContext.preloadFiles.filter(({ file }) => isJS(file))
    if (!initial.length) {
      return ''
    }
    const async = getUsedAsyncFiles(ssrContext, renderContext).filter(({ file }) => isJS(file))
    const needed = [initial[0]].concat(async, initial.slice(1))
    return needed.map(({ file }) => {
      return `<script${isModule(file) ? ' type="module"' : ''} src="${renderContext.publicPath}${file}" defer></script>`
    }).join('')
  } else {
    return ''
  }
}

export function getPreloadFiles (ssrContext: SSRContext, renderContext: RenderContext): Array<Resource> {
  const usedAsyncFiles = getUsedAsyncFiles(ssrContext, renderContext)
  if (renderContext.preloadFiles || usedAsyncFiles) {
    return (renderContext.preloadFiles || []).concat(usedAsyncFiles)
  } else {
    return []
  }
}

export function getUsedAsyncFiles (ssrContext: SSRContext, renderContext: RenderContext): Array<Resource> {
  if (ssrContext.modules && renderContext.manifest) {
    return Array.from(ssrContext.modules).flatMap(
      (usedSourceFile) => {
        const meta = renderContext.manifest![usedSourceFile]
        if (!meta) {
          return []
        }
        return [
          meta.file,
          ...(meta.imports || []).map(i => renderContext.manifest![i].file),
          ...meta.css || [],
          ...meta.assets || []
        ].map(normalizeFile)
      }
    )
  }
  if (!ssrContext._mappedFiles && ssrContext._registeredComponents && renderContext.mapFiles) {
    const registered = Array.from(ssrContext._registeredComponents)
    ssrContext._mappedFiles = renderContext.mapFiles(registered).map(normalizeFile)
  }
  return ssrContext._mappedFiles || []
}

export type RenderToStringFunction = (ssrContext: SSRContext, renderContext: RenderContext) => string

export function createRenderer (createApp: any, renderOptions: RenderOptions & { renderToString: Function }) {
  const renderContext = createRenderContext(renderOptions)

  return {
    async renderToString (ssrContext: SSRContext) {
      ssrContext._registeredComponents = ssrContext._registeredComponents || new Set()

      const _createApp = await Promise.resolve(createApp).then(r => r.default || r)
      const app = await _createApp(ssrContext)
      const html = await renderOptions.renderToString(app, ssrContext)

      const wrap = (fn: RenderToStringFunction) => () => fn(ssrContext, renderContext)

      return {
        html,
        renderResourceHints: wrap(renderResourceHints),
        renderStyles: wrap(renderStyles),
        renderScripts: wrap(renderScripts)
      }
    }
  }
}
