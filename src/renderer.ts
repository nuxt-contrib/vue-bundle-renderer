import { createMapper, AsyncFileMapper } from './mapper'
import { normalizeFile, isCSS, isJS, isModule, ensureTrailingSlash } from './utils'

export interface ResourceMeta {
  file: string
  src?: string
  isEntry?: boolean
  isDynamicEntry?: boolean
  dynamicImports?: string[]
  imports?: string[]
  css?: string[]
  assets?: string[]
}

export type ClientManifest = Record<string, ResourceMeta>

// Vue2 Webpack client manifest format
export interface LegacyClientManifest {
  publicPath: string;
  all: Array<string>;
  initial: Array<string>;
  async: Array<string>;
  modules: { [id: string]: Array<number>; },
  hasNoCssVersion?: { [file: string]: boolean; }
}

export interface Resource {
  file: string;
  extension: string;
  fileWithoutQuery: string;
  asType: string;
}

export interface SSRContext {
  getPreloadFiles?: Function,
  renderResourceHints?: Function,
  renderState?: Function,
  renderScripts?: Function,
  renderStyles?: Function,
  nonce?: string,
  head?: string,
  styles?: string,
  // Vite: https://vitejs.dev/guide/ssr.html#generating-preload-directives
  modules?: Set<string>,
  _mappedFiles?: Array<Resource>,
  _registeredComponents?: Set<any>,
}

export interface RenderContext {
  preloadFiles: Array<any>,
  prefetchFiles: Array<any>,
  shouldPrefetch?: (file: string, type: string) => boolean,
  shouldPreload?: (file: string, type: string) => boolean,
  publicPath?: string,
  clientManifest: ClientManifest,
  mapFiles?: AsyncFileMapper,
  basedir?: string,
}

export type RenderOptions = Partial<RenderContext>

export function createRenderContext ({ clientManifest, publicPath, basedir }: RenderOptions) {
  const renderContext: Partial<RenderContext> = {
    clientManifest: normalizeClientManifest(clientManifest!),
    publicPath,
    basedir
  }

  renderContext.publicPath = ensureTrailingSlash(renderContext.publicPath || '/')

  return renderContext
}

function isLegacyClientManifest (clientManifest: ClientManifest | LegacyClientManifest): clientManifest is LegacyClientManifest {
  return 'all' in clientManifest && 'initial' in clientManifest
}

function normalizeClientManifest (legacyClientManifest: ClientManifest | LegacyClientManifest = {}): ClientManifest {
  if (!isLegacyClientManifest(legacyClientManifest)) {
    return legacyClientManifest
  }

  // Upgrade legacy manifest
  // https://github.com/nuxt-contrib/vue-bundle-renderer/issues/12
  const clientManifest: ClientManifest = {}

  // Initialize with all keys
  for (const outfile of legacyClientManifest.all) {
    clientManifest[outfile] = {
      file: outfile
    }
  }
  // Set initial entries
  for (const outfile of legacyClientManifest.initial) {
    clientManifest[outfile].isEntry = true
  }
  // Set dynamic async entries
  for (const outfile of legacyClientManifest.async) {
    clientManifest[outfile].isDynamicEntry = true
  }
  // Map modules to virtual entries
  for (const [moduleId, importIndexes] of Object.entries(legacyClientManifest.modules)) {
    clientManifest['module:' + moduleId] = {
      file: '',
      imports: importIndexes.map(index => legacyClientManifest.all[index])
    }
  }
  // Link
  for (const [assetId, importIndexes] of Object.entries(legacyClientManifest.modules)) {
    clientManifest['asset:' + assetId] = {
      file: '',
      imports: importIndexes.map(index => legacyClientManifest.all[index])
    }
  }

  return clientManifest
}

export function renderStyles (ssrContext: SSRContext, renderContext: RenderContext): string {
  const initial = renderContext.preloadFiles
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
    return (renderContext.preloadFiles).concat(usedAsyncFiles)
  } else {
    return []
  }
}

export function getUsedAsyncFiles (ssrContext: SSRContext, renderContext: RenderContext): Array<Resource> {
  if (ssrContext.modules && renderContext.clientManifest) {
    return Array.from(ssrContext.modules).flatMap(
      (usedSourceFile) => {
        const meta = renderContext.clientManifest![usedSourceFile]
        if (!meta) {
          return []
        }
        return [
          meta.file,
          ...(meta.imports || []).map(i => renderContext.clientManifest![i].file),
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
