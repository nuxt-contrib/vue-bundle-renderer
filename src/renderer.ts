import { normalizeFile, isModule, ensureTrailingSlash, unique, isJS, isCSS } from './utils'

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
  publicPath: string
  all: Array<string>
  initial: Array<string>
  async: Array<string>
  modules: { [id: string]: Array<number> },
  hasNoCssVersion?: { [file: string]: boolean }
}

export interface Resource {
  file: string
  extension: string
  fileWithoutQuery: string
  asType: string
}

export interface SSRContext {
  getPreloadFiles?: Function
  renderResourceHints?: Function
  renderState?: Function
  renderScripts?: Function
  renderStyles?: Function
  nonce?: string
  head?: string
  styles?: string
  // Vite: https://vitejs.dev/guide/ssr.html#generating-preload-directives
  modules?: Set<string>,
  _usedResources?: {
    sources: string[]
    dynamicImports: string[]
    modules: ResourceMeta[]
    assets: string[]
    styles: string[]
  },
  _registeredComponents?: Set<string>,
}

export interface RenderContext {
  shouldPrefetch: (file: string, type: string) => boolean
  shouldPreload: (file: string, type: string) => boolean
  publicPath?: string
  clientManifest: ClientManifest
  basedir?: string
  _entrypoints: string[]
  _dynamicEntrypoints: string[]
}

export type RenderOptions = Partial<Exclude<RenderContext, 'entrypoints'>>

export function createRenderContext ({ clientManifest, publicPath, basedir, shouldPrefetch, shouldPreload }: RenderOptions): RenderContext {
  const manifest = normalizeClientManifest(clientManifest!)
  return {
    // User customisation of output
    shouldPrefetch: shouldPrefetch || (() => true),
    shouldPreload: shouldPreload || ((_file: string, asType: string) => ['script', 'style'].includes(asType)),
    // Manifest
    publicPath: ensureTrailingSlash(publicPath || (clientManifest as any).publicPath || '/'),
    clientManifest: manifest,
    basedir,
    // Internal cache
    _entrypoints: Object.entries(manifest).filter(([, meta]) => meta.isEntry).map(([module]) => module),
    _dynamicEntrypoints: Object.entries(manifest).filter(([, meta]) => meta.isDynamicEntry).map(([module]) => module)
  }
}

export function isLegacyClientManifest (clientManifest: ClientManifest | LegacyClientManifest): clientManifest is LegacyClientManifest {
  return 'all' in clientManifest && 'initial' in clientManifest
}

export function normalizeClientManifest (manifest: ClientManifest | LegacyClientManifest = { }): ClientManifest {
  if (!isLegacyClientManifest(manifest)) {
    return manifest
  }

  // Upgrade legacy manifest
  // https://github.com/nuxt-contrib/vue-bundle-renderer/issues/12
  const clientManifest: ClientManifest = {}

  // Initialize with all keys
  for (const outfile of manifest.all) {
    if (isJS(outfile)) {
      clientManifest[outfile] = {
        file: outfile
      }
    }
  }

  // Prepare first entrypoint to receive extra data
  const first = manifest.initial.find(isJS)
  if (first) {
    clientManifest[first].css = []
    clientManifest[first].assets = []
    clientManifest[first].dynamicImports = []
  }

  for (const outfile of manifest.initial) {
    if (isJS(outfile)) {
      clientManifest[outfile].isEntry = true
    } else if (isCSS(outfile) && first) {
      clientManifest[first].css!.push(outfile)
    } else if (first) {
      clientManifest[first].assets!.push(outfile)
    }
  }

  for (const outfile of manifest.async) {
    if (isJS(outfile)) {
      clientManifest[outfile].isDynamicEntry = true
    } else if (first) {
      // Add assets (CSS/JS) as dynamic imports to first entrypoints
      // as a workaround so can be prefetched.
      const identifier = `_${outfile}`
      const key = isCSS(outfile) ? 'css' : 'assets'
      clientManifest[identifier] = {
        file: '',
        [key]: [outfile]
      }
      clientManifest[first].dynamicImports!.push(identifier)
    }
  }

  // Map modules to virtual entries
  for (const [moduleId, importIndexes] of Object.entries(manifest.modules)) {
    clientManifest[moduleId] = {
      file: '',
      imports: importIndexes.map(index => manifest.all[index])
    }
  }

  return clientManifest
}

export function getUsedResources (ssrContext: SSRContext, renderContext: RenderContext): NonNullable<SSRContext['_usedResources']> {
  if (ssrContext._usedResources) { return ssrContext._usedResources }

  const sources = unique([
    ...renderContext._entrypoints,
    ...Array.from(ssrContext.modules || ssrContext._registeredComponents || [])
      .flatMap(m => [m, ...renderContext.clientManifest[m]?.imports || []])
  ]).filter(Boolean)

  const modules = sources.map(m => renderContext.clientManifest[m]).filter(Boolean)
  const dynamicImports = unique(modules.flatMap(m => m.dynamicImports || []))
  const assets = unique(modules.flatMap(m => m.assets || []))
  const styles = unique(modules.flatMap(m => m.css || []))

  ssrContext._usedResources = { sources, modules, dynamicImports, assets, styles }
  return ssrContext._usedResources
}

export function getEntrypoints (ssrContext: SSRContext, renderContext: RenderContext): ResourceMeta[] {
  const { modules } = getUsedResources(ssrContext, renderContext)
  return modules.filter(m => m.isEntry || m.isDynamicEntry)
}

export function renderStyles (ssrContext: SSRContext, renderContext: RenderContext): string {
  const { styles } = getUsedResources(ssrContext, renderContext)
  return styles.map(file => `<link rel="stylesheet" href="${renderContext.publicPath}${file}">`).join('')
}

export function renderResourceHints (ssrContext: SSRContext, renderContext: RenderContext): string {
  return renderPreloadLinks(ssrContext, renderContext) + renderPrefetchLinks(ssrContext, renderContext)
}

export function renderPreloadLinks (ssrContext: SSRContext, renderContext: RenderContext): string {
  const { modules, assets, styles } = getUsedResources(ssrContext, renderContext)
  return [...modules.map(m => m.file), ...assets, ...styles]
    .map((file) => {
      const { extension, fileWithoutQuery, asType } = normalizeFile(file)
      if (!file || !renderContext.shouldPreload(fileWithoutQuery, asType)) { return '' }

      const rel = isModule(file) ? 'modulepreload' : 'preload'
      const as = asType ? ` as="${asType}"` : ''
      const type = asType === 'font' ? ` type="font/${extension}" crossorigin` : ''

      return `<link rel="${rel}" href="${renderContext.publicPath}${file}"${as}${type}>`
    }).join('')
}

export function getAsyncFiles (ssrContext: SSRContext, renderContext: RenderContext): ResourceMeta[] {
  const { sources, dynamicImports } = getUsedResources(ssrContext, renderContext)
  return unique([...renderContext._dynamicEntrypoints, ...dynamicImports])
    .filter(s => !sources.includes(s))
    .map(m => renderContext.clientManifest[m]).filter(Boolean)
}

export function renderPrefetchLinks (ssrContext: SSRContext, renderContext: RenderContext): string {
  const dynamicImports = getAsyncFiles(ssrContext, renderContext)
  const filesToPrefetch = dynamicImports
    .flatMap(m => [m.file, ...m.css || [], ...m.assets || []])
    .filter(file => file && renderContext.shouldPrefetch(file, normalizeFile(file).asType))

  return filesToPrefetch.map(file =>
    `<link ${isModule(file) ? 'type="module" ' : ''}rel="prefetch" href="${renderContext.publicPath}${file}">`
  ).join('')
}

export function renderScripts (ssrContext: SSRContext, renderContext: RenderContext): string {
  return getEntrypoints(ssrContext, renderContext).map(({ file }) =>
    `<script${isModule(file) ? ' type="module"' : ''} src="${renderContext.publicPath}${file}" defer></script>`
  ).join('')
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
