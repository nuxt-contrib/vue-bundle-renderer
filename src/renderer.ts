import type { Manifest, ManifestChunk } from 'vite'
import { withLeadingSlash } from 'ufo'
import { isModule, isJS, isCSS, getPreloadType, getContentType, renderLinkToString, LinkAttributes, renderLinkToHeader, renderScriptToString } from './utils'

// Uncomment for better type hinting in development
// const type = Symbol('type')
// type As<T, L> = T & { [type]: L }
export type Identifier = string // & As<string, 'Identifier'>
export type OutputPath = string // & As<string, 'OutputPath'>

export interface Resource {
  file: string
  extension: string
  fileWithoutQuery: string
  asType: string
}

export interface ModuleDependencies {
  scripts: Record<string, {
    path: OutputPath
    type?: 'module' | 'script'
  }>
  styles: Record<string, { path: OutputPath }>
  preload: Record<string, {
    path: OutputPath
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
    type?: 'module' | 'script' | 'style' | 'font' | 'fetch' | 'image'
    contentType?: string
  }>
  prefetch: Record<string, {
    path: OutputPath
    type?: 'module' | 'script'
  }>
}

export interface SSRContext {
  renderResourceHints?: Function
  renderScripts?: Function
  renderStyles?: Function
  // @vitejs/plugin-vue: https://vitejs.dev/guide/ssr.html#generating-preload-directives
  modules?: Set<Identifier>
  // vue-loader (webpack)
  _registeredComponents?: Set<Identifier>
  // Cache
  _requestDependencies?: ModuleDependencies
  [key: string]: any
}

export interface RendererContext {
  shouldPrefetch: (file: string, type: ModuleDependencies['prefetch'][string]['type']) => boolean
  shouldPreload: (file: string, type: ModuleDependencies['preload'][string]['type']) => boolean
  buildAssetsURL: (id: string) => string
  manifest: Manifest
  _dependencies: Record<string, ModuleDependencies>
  _dependencySets: Record<string, ModuleDependencies>
  _entrypoints: Identifier[]
  _dynamicEntrypoints: Identifier[]
}

export type RenderOptions = Partial<Exclude<RendererContext, 'entrypoints'>> & { manifest: Manifest }

export function createRendererContext ({ manifest, buildAssetsURL, shouldPrefetch, shouldPreload }: RenderOptions): RendererContext {
  const manifestEntries = Object.entries(manifest) as [Identifier, ManifestChunk][]

  return {
    // User customisation of output
    shouldPrefetch: shouldPrefetch || (() => true),
    shouldPreload: shouldPreload || ((_file: string, asType: ModuleDependencies['preload'][string]['type']) => ['module', 'script', 'style'].includes(asType as string)),
    // Manifest
    buildAssetsURL: buildAssetsURL ?? withLeadingSlash,
    manifest,
    // Internal cache
    _dependencies: {},
    _dependencySets: {},
    _entrypoints: manifestEntries.filter(e => e[1].isEntry).map(([module]) => module),
    _dynamicEntrypoints: manifestEntries.filter(e => e[1].isDynamicEntry).map(([module]) => module)
  }
}

export function getModuleDependencies (id: Identifier, rendererContext: RendererContext): ModuleDependencies {
  if (rendererContext._dependencies[id]) {
    return rendererContext._dependencies[id]
  }

  const dependencies: ModuleDependencies = {
    scripts: {},
    styles: {},
    preload: {},
    prefetch: {}
  }

  const meta = rendererContext.manifest[id]

  if (!meta) {
    rendererContext._dependencies[id] = dependencies
    return dependencies
  }

  if (meta.file) {
    // Add to scripts + preload
    const type = isModule(meta.file) ? 'module' : 'script'
    dependencies.scripts[id] = { path: meta.file, type }
    dependencies.preload[id] = { path: meta.file, type }
  }

  // Add styles + preload
  for (const css of meta.css || []) {
    dependencies.styles[css] = { path: css }
    dependencies.preload[css] = { path: css, type: 'style' }
    dependencies.prefetch[css] = { path: css }
  }
  // Add assets as preload
  for (const asset of meta.assets || []) {
    dependencies.preload[asset] = { path: asset, type: getPreloadType(asset), contentType: getContentType(asset) }
    dependencies.prefetch[asset] = { path: asset }
  }
  // Resolve nested dependencies and merge
  for (const depId of meta.imports || []) {
    const depDeps = getModuleDependencies(depId, rendererContext)
    Object.assign(dependencies.styles, depDeps.styles)
    Object.assign(dependencies.preload, depDeps.preload)
    Object.assign(dependencies.prefetch, depDeps.prefetch)
  }
  const filteredPreload: ModuleDependencies['preload'] = {}
  for (const id in dependencies.preload) {
    const dep = dependencies.preload[id]
    if (rendererContext.shouldPreload(dep.path, dep.type)) {
      filteredPreload[id] = dependencies.preload[id]
    }
  }
  dependencies.preload = filteredPreload

  rendererContext._dependencies[id] = dependencies
  return dependencies
}

export function getAllDependencies (ids: Set<Identifier>, rendererContext: RendererContext): ModuleDependencies {
  const cacheKey = Array.from(ids).join(',')
  if (rendererContext._dependencySets[cacheKey]) {
    return rendererContext._dependencySets[cacheKey]
  }

  const allDeps: ModuleDependencies = {
    scripts: {},
    styles: {},
    preload: {},
    prefetch: {}
  }

  for (const id of ids) {
    const deps = getModuleDependencies(id, rendererContext)
    Object.assign(allDeps.scripts, deps.scripts)
    Object.assign(allDeps.styles, deps.styles)
    Object.assign(allDeps.preload, deps.preload)
    Object.assign(allDeps.prefetch, deps.prefetch)

    for (const dynamicDepId of rendererContext.manifest[id]?.dynamicImports || []) {
      const dynamicDeps = getModuleDependencies(dynamicDepId, rendererContext)
      Object.assign(allDeps.prefetch, dynamicDeps.scripts)
      Object.assign(allDeps.prefetch, dynamicDeps.styles)
      Object.assign(allDeps.prefetch, dynamicDeps.preload)
      Object.assign(allDeps.prefetch, dynamicDeps.prefetch)
    }
  }

  for (const id in allDeps.prefetch) {
    if (id in allDeps.preload) {
      delete allDeps.prefetch[id]
    }
  }

  // Don't render preload links for stylesheets within the HTML
  for (const id in allDeps.styles) {
    if (id in allDeps.preload) {
      delete allDeps.preload[id]
    }
  }

  rendererContext._dependencySets[cacheKey] = allDeps
  return allDeps
}

export function getRequestDependencies (ssrContext: SSRContext, rendererContext: RendererContext): ModuleDependencies {
  if (ssrContext._requestDependencies) {
    return ssrContext._requestDependencies
  }
  const ids = new Set<Identifier>(Array.from([
    ...rendererContext._entrypoints,
    ...ssrContext.modules /* vite */ || ssrContext._registeredComponents /* webpack */ || []
  ]))
  const deps = getAllDependencies(ids, rendererContext)
  ssrContext._requestDependencies = deps
  return deps
}

export function renderStyles (ssrContext: SSRContext, rendererContext: RendererContext): string {
  const { styles } = getRequestDependencies(ssrContext, rendererContext)
  return Object.values(styles).map(({ path }) => renderLinkToString({ rel: 'stylesheet', href: rendererContext.buildAssetsURL(path) })).join('')
}

export function getResources (ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  return [...getPreloadLinks(ssrContext, rendererContext), ...getPrefetchLinks(ssrContext, rendererContext)]
}

export function renderResourceHints (ssrContext: SSRContext, rendererContext: RendererContext): string {
  return getResources(ssrContext, rendererContext).map(renderLinkToString).join('')
}

export function renderResourceHeaders (ssrContext: SSRContext, rendererContext: RendererContext): Record<string, string> {
  return {
    link: getResources(ssrContext, rendererContext).map(renderLinkToHeader).join(', ')
  }
}

export function getPreloadLinks (ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  const { preload } = getRequestDependencies(ssrContext, rendererContext)
  return Object.values(preload)
    .map(file => ({
      rel: file.type === 'module' ? 'modulepreload' : 'preload',
      as: file.type ? file.type === 'module' ? 'script' : file.type : null,
      type: file.contentType || null,
      crossorigin: file.type === 'font' || file.type === 'module' ? '' : null,
      href: rendererContext.buildAssetsURL(file.path)
    }))
}

export function getPrefetchLinks (ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  const { prefetch } = getRequestDependencies(ssrContext, rendererContext)
  return Object.values(prefetch).map(({ path }) => ({
    rel: 'prefetch' + (isCSS(path) ? ' stylesheet' : ''),
    as: isJS(path) ? 'script' : null,
    href: rendererContext.buildAssetsURL(path)
  }))
}

export function renderScripts (ssrContext: SSRContext, rendererContext: RendererContext): string {
  const { scripts } = getRequestDependencies(ssrContext, rendererContext)
  return Object.values(scripts).map(({ path, type }) => renderScriptToString({
    type: type === 'module' ? 'module' : null,
    src: rendererContext.buildAssetsURL(path),
    defer: type !== 'module' ? '' : null,
    crossorigin: ''
  })).join('')
}

export type RenderFunction = (ssrContext: SSRContext, rendererContext: RendererContext) => any

export function createRenderer (createApp: any, renderOptions: RenderOptions & { renderToString: Function }) {
  const rendererContext = createRendererContext(renderOptions)

  return {
    async renderToString (ssrContext: SSRContext) {
      ssrContext._registeredComponents = ssrContext._registeredComponents || new Set()

      const _createApp = await Promise.resolve(createApp).then(r => r.default || r)
      const app = await _createApp(ssrContext)
      const html = await renderOptions.renderToString(app, ssrContext)

      const wrap = <T extends RenderFunction>(fn: T) => () => fn(ssrContext, rendererContext) as ReturnType<T>

      return {
        html,
        renderResourceHeaders: wrap(renderResourceHeaders),
        renderResourceHints: wrap(renderResourceHints),
        renderStyles: wrap(renderStyles),
        renderScripts: wrap(renderScripts)
      }
    }
  }
}
