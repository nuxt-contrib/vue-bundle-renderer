import type { Manifest, ManifestChunk } from 'vite'
import { withLeadingSlash } from 'ufo'
import { renderLinkToString, renderLinkToHeader, renderScriptToString, parseResource } from './utils'
import type { LinkAttributes, ParsedResource } from './utils'

export interface ModuleDependencies {
  scripts: Record<string, ParsedResource>
  styles: Record<string, ParsedResource>
  preload: Record<string, ParsedResource>
  prefetch: Record<string, ParsedResource>
}

export interface SSRContext {
  renderResourceHints?: Function
  renderScripts?: Function
  renderStyles?: Function
  // @vitejs/plugin-vue: https://vitejs.dev/guide/ssr.html#generating-preload-directives
  modules?: Set<string>
  // vue-loader (webpack)
  _registeredComponents?: Set<string>
  // Cache
  _requestDependencies?: ModuleDependencies
  [key: string]: any
}

export interface RenderOptions {
  shouldPrefetch?: (resource: ParsedResource) => boolean
  shouldPreload?: (resource: ParsedResource) => boolean
  buildAssetsURL?: (id: string) => string
  manifest: Manifest
}

export interface RendererContext extends Required<RenderOptions> {
  _dependencies: Record<string, ModuleDependencies>
  _dependencySets: Record<string, ModuleDependencies>
  _parsedResources: Record<string, ParsedResource>
  _entrypoints: string[]
  updateManifest: (manifest: Manifest) => void
}

const defaultShouldPrefetch = () => true
const defaultShouldPreload = (resource: ParsedResource) => ['module', 'script', 'style'].includes(resource.asType || '')

export function createRendererContext ({ manifest, buildAssetsURL, shouldPrefetch, shouldPreload }: RenderOptions): RendererContext {
  const ctx: RendererContext = {
    // User customisation of output
    shouldPrefetch: shouldPrefetch || defaultShouldPrefetch,
    shouldPreload: shouldPreload || defaultShouldPreload,
    // Manifest
    buildAssetsURL: buildAssetsURL || withLeadingSlash,
    manifest: undefined!,
    updateManifest,
    // Internal cache
    _dependencies: undefined!,
    _dependencySets: undefined!,
    _parsedResources: undefined!,
    _entrypoints: undefined!
  }

  function updateManifest (manifest: Manifest) {
    const manifestEntries = Object.entries(manifest) as [string, ManifestChunk][]
    ctx.manifest = manifest
    ctx._dependencies = {}
    ctx._dependencySets = {}
    ctx._parsedResources = {}
    ctx._entrypoints = manifestEntries.filter(e => e[1].isEntry).map(([module]) => module)
  }

  updateManifest(manifest)

  return ctx
}

export function getModuleDependencies (id: string, rendererContext: RendererContext): ModuleDependencies {
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

  // Add to scripts + preload
  if (meta.file) {
    dependencies.scripts[id] = dependencies.preload[id] = rendererContext._parsedResources[meta.file] || parseResource(meta.file)
  }

  // Add styles + preload
  for (const css of meta.css || []) {
    dependencies.styles[css] = dependencies.preload[css] = dependencies.prefetch[css] = rendererContext._parsedResources[css] || parseResource(css)
  }
  // Add assets as preload
  for (const asset of meta.assets || []) {
    dependencies.preload[asset] = dependencies.prefetch[asset] = rendererContext._parsedResources[asset] || parseResource(asset)
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
    if (rendererContext.shouldPreload(dep)) {
      filteredPreload[id] = dep
    }
  }
  dependencies.preload = filteredPreload

  rendererContext._dependencies[id] = dependencies
  return dependencies
}

export function getAllDependencies (ids: Set<string>, rendererContext: RendererContext): ModuleDependencies {
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
    }
  }

  const filteredPrefetch: ModuleDependencies['prefetch'] = {}
  for (const id in allDeps.prefetch) {
    const dep = allDeps.prefetch[id]
    if (rendererContext.shouldPrefetch(dep)) {
      filteredPrefetch[id] = dep
    }
  }
  allDeps.prefetch = filteredPrefetch

  // Don't render prefetch links if we're preloading them
  for (const id in allDeps.prefetch) {
    if (id in allDeps.preload) {
      delete allDeps.prefetch[id]
    }
  }

  // Don't render preload links if we're adding them as stylesheets
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
  const ids = new Set<string>(Array.from([
    ...rendererContext._entrypoints,
    ...ssrContext.modules /* vite */ || ssrContext._registeredComponents /* webpack */ || []
  ]))
  const deps = getAllDependencies(ids, rendererContext)
  ssrContext._requestDependencies = deps
  return deps
}

export function renderStyles (ssrContext: SSRContext, rendererContext: RendererContext): string {
  const { styles } = getRequestDependencies(ssrContext, rendererContext)
  return Object.values(styles).map(resource =>
    renderLinkToString({ rel: 'stylesheet', href: rendererContext.buildAssetsURL(resource.path) })
  ).join('')
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
    .map(resource => ({
      rel: resource.isModule ? 'modulepreload' : 'preload',
      as: resource.asType,
      type: resource.contentType,
      crossorigin: resource.asType === 'font' || resource.isModule ? '' : null,
      href: rendererContext.buildAssetsURL(resource.path)
    }))
}

export function getPrefetchLinks (ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  const { prefetch } = getRequestDependencies(ssrContext, rendererContext)
  return Object.values(prefetch).map(resource => ({
    rel: 'prefetch' + (resource.asType === 'style' ? ' stylesheet' : ''),
    as: resource.asType !== 'style' ? resource.asType : null,
    type: resource.contentType,
    crossorigin: resource.asType === 'font' || resource.isModule ? '' : null,
    href: rendererContext.buildAssetsURL(resource.path)
  }))
}

export function renderScripts (ssrContext: SSRContext, rendererContext: RendererContext): string {
  const { scripts } = getRequestDependencies(ssrContext, rendererContext)
  return Object.values(scripts).map(resource => renderScriptToString({
    type: resource.isModule ? 'module' : null,
    src: rendererContext.buildAssetsURL(resource.path),
    defer: resource.isModule ? null : '',
    crossorigin: ''
  })).join('')
}

export type RenderFunction = (ssrContext: SSRContext, rendererContext: RendererContext) => any

export function createRenderer (createApp: any, renderOptions: RenderOptions & { renderToString: Function }) {
  const rendererContext = createRendererContext(renderOptions)

  return {
    rendererContext,
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
