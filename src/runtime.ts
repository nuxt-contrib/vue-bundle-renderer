import { withLeadingSlash } from 'ufo'
import type { Manifest, ResourceMeta } from './types'
import type { PrecomputedData } from './precompute'

export interface ModuleDependencies {
  scripts: Record<string, ResourceMeta>
  styles: Record<string, ResourceMeta>
  preload: Record<string, ResourceMeta>
  prefetch: Record<string, ResourceMeta>
}

export interface SSRContext {
  renderResourceHints?: (...args: unknown[]) => unknown
  renderScripts?: (...args: unknown[]) => unknown
  renderStyles?: (...args: unknown[]) => unknown
  // @vitejs/plugin-vue: https://vitejs.dev/guide/ssr.html#generating-preload-directives
  modules?: Set<string>
  // vue-loader (webpack)
  _registeredComponents?: Set<string>
  // Cache
  _requestDependencies?: ModuleDependencies
  [key: string]: unknown
}

export interface RenderOptions {
  buildAssetsURL?: (id: string) => string
  /** @deprecated Use `precomputed` instead for better performance */
  manifest?: Manifest
  /** Precomputed dependency data */
  precomputed?: PrecomputedData
  /**
   * Maximum number of entries kept in the per-request module-set cache
   * (`_dependencySets`). The cache is keyed by the sorted module ids of a
   * request; on high-cardinality sites it can grow without bound and pin
   * manifest references for the lifetime of the renderer. A bounded LRU
   * keeps a hot working set without unbounded growth.
   *
   * Set to `0` (or any non-positive / non-finite value) to disable the
   * cache entirely; useful for prerender runs or for sites whose request
   * variation makes the cache pure overhead.
   *
   * @default 1000
   */
  dependencySetsCacheSize?: number
}

interface RenderedOutputs {
  styles?: string
  scripts?: string
  hints?: string
  headerLink?: string
}

export interface RendererContext {
  buildAssetsURL: (id: string) => string
  manifest?: Manifest
  precomputed?: PrecomputedData
  _dependencies: Record<string, ModuleDependencies>
  _dependencySets: Map<string, ModuleDependencies>
  _dependencySetsCacheSize: number
  _entrypoints: string[]
  _renderedCache: WeakMap<ModuleDependencies, RenderedOutputs>
  updateManifest: (manifest: Manifest) => void
}

interface LinkAttributes {
  rel: string | null
  href: string
  as?: string | null
  type?: string | null
  crossorigin?: '' | null
}

export function createRendererContext({ manifest, precomputed, buildAssetsURL, dependencySetsCacheSize }: RenderOptions): RendererContext {
  if (!manifest && !precomputed) {
    throw new Error('Either manifest or precomputed data must be provided')
  }

  const cacheSize = typeof dependencySetsCacheSize === 'number' && Number.isFinite(dependencySetsCacheSize) && dependencySetsCacheSize > 0
    ? Math.floor(dependencySetsCacheSize)
    : dependencySetsCacheSize === undefined
      ? 1000
      : 0

  const ctx: RendererContext = {
    // Options
    buildAssetsURL: buildAssetsURL || withLeadingSlash,
    manifest,
    precomputed,
    updateManifest,
    // Internal cache
    _dependencies: {},
    _dependencySets: new Map(),
    _dependencySetsCacheSize: cacheSize,
    _entrypoints: [],
    _renderedCache: new WeakMap(),
  }

  function updateManifest(manifest: Manifest) {
    ctx.manifest = manifest
    ctx._dependencies = {}
    ctx._dependencySets.clear()
    ctx._renderedCache = new WeakMap()
    const entrypoints: string[] = []
    for (const id in manifest) {
      if (manifest[id].isEntry) {
        entrypoints.push(id)
      }
    }
    ctx._entrypoints = entrypoints
  }

  if (precomputed) {
    ctx._dependencies = precomputed.dependencies
    ctx._entrypoints = precomputed.entrypoints
  }
  else if (manifest) {
    updateManifest(manifest)
  }

  return ctx
}

export function getModuleDependencies(id: string, rendererContext: RendererContext): ModuleDependencies {
  if (rendererContext._dependencies[id]) {
    return rendererContext._dependencies[id]
  }

  const dependencies: ModuleDependencies = rendererContext._dependencies[id] = {
    scripts: {},
    styles: {},
    preload: {},
    prefetch: {},
  }

  if (!rendererContext.manifest) {
    return dependencies
  }

  const meta = rendererContext.manifest[id]

  if (!meta) {
    return dependencies
  }

  // Add to scripts + preload
  if (meta.file) {
    dependencies.preload[id] = meta
    if (meta.isEntry || meta.sideEffects) {
      dependencies.scripts[id] = meta
    }
  }

  // Add styles + preload
  for (const css of meta.css || []) {
    dependencies.styles[css] = dependencies.preload[css] = dependencies.prefetch[css] = rendererContext.manifest[css]
  }
  // Add assets as preload
  for (const asset of meta.assets || []) {
    dependencies.preload[asset] = dependencies.prefetch[asset] = rendererContext.manifest[asset]
  }
  // Resolve nested dependencies and merge
  if (meta.imports) {
    for (const depId of meta.imports) {
      const depDeps = getModuleDependencies(depId, rendererContext)
      Object.assign(dependencies.styles, depDeps.styles)
      Object.assign(dependencies.preload, depDeps.preload)
      Object.assign(dependencies.prefetch, depDeps.prefetch)
    }
  }
  const filteredPreload: ModuleDependencies['preload'] = {}
  for (const id in dependencies.preload) {
    const dep = dependencies.preload[id]
    if (dep.preload) {
      filteredPreload[id] = dep
    }
  }
  dependencies.preload = filteredPreload

  return dependencies
}

export function getAllDependencies(ids: Set<string>, rendererContext: RendererContext): ModuleDependencies {
  const cacheSize = rendererContext._dependencySetsCacheSize
  const useCache = cacheSize > 0

  let cacheKey = ''
  if (useCache) {
    if (ids.size <= 1) {
      // Fast path for the common single-entrypoint request: skip the
      // [...ids].sort() allocation entirely. A one-element set is already
      // sorted, so the only entry is the cache key.
      for (const id of ids) cacheKey = id
    }
    else {
      cacheKey = [...ids].sort().join(',')
    }

    const cached = rendererContext._dependencySets.get(cacheKey)
    if (cached !== undefined) {
      // Below capacity nothing can be evicted, so skip the MRU promotion
      // to keep the hot path cheap. At or above capacity we promote so
      // the next eviction drops the genuinely least-recently-used key.
      if (rendererContext._dependencySets.size >= cacheSize) {
        rendererContext._dependencySets.delete(cacheKey)
        rendererContext._dependencySets.set(cacheKey, cached)
      }
      return cached
    }
  }

  const allDeps: ModuleDependencies = {
    scripts: {},
    styles: {},
    preload: {},
    prefetch: {},
  }

  for (const id of ids) {
    const deps = getModuleDependencies(id, rendererContext)
    Object.assign(allDeps.scripts, deps.scripts)
    Object.assign(allDeps.styles, deps.styles)
    Object.assign(allDeps.preload, deps.preload)
    Object.assign(allDeps.prefetch, deps.prefetch)

    const dynamicImports = rendererContext.manifest?.[id]?.dynamicImports || rendererContext.precomputed?.modules[id]?.dynamicImports
    if (dynamicImports) {
      for (const dynamicDepId of dynamicImports) {
        const dynamicDeps = getModuleDependencies(dynamicDepId, rendererContext)
        Object.assign(allDeps.prefetch, dynamicDeps.scripts)
        Object.assign(allDeps.prefetch, dynamicDeps.styles)
        Object.assign(allDeps.prefetch, dynamicDeps.preload)
      }
    }
  }

  // Don't prefetch resources that are preloaded or synchronously loaded as
  // styles, and don't preload styles that are synchronously loaded.
  const mergedPreload = allDeps.preload
  const styles = allDeps.styles

  const filteredPrefetch: ModuleDependencies['prefetch'] = {}
  for (const id in allDeps.prefetch) {
    const dep = allDeps.prefetch[id]
    if (dep.prefetch && !(id in mergedPreload) && !(id in styles)) {
      filteredPrefetch[id] = dep
    }
  }
  allDeps.prefetch = filteredPrefetch

  const filteredPreload: ModuleDependencies['preload'] = {}
  for (const id in mergedPreload) {
    if (!(id in styles)) {
      filteredPreload[id] = mergedPreload[id]
    }
  }
  allDeps.preload = filteredPreload

  if (useCache) {
    rendererContext._dependencySets.set(cacheKey, allDeps)
    if (rendererContext._dependencySets.size > cacheSize) {
      // Map preserves insertion order; the first key is the oldest entry.
      const oldest = rendererContext._dependencySets.keys().next().value
      if (oldest !== undefined) {
        rendererContext._dependencySets.delete(oldest)
      }
    }
  }
  return allDeps
}

export interface RequestDependenciesOptions {
  /**
   * Module ids to exclude from dependency resolution. Excluded ids are
   * subtracted from the merged id set before resolution, so chunks reachable
   * only through them are also dropped. Has no effect on `renderStyles`,
   * `renderScripts`, or `getResources`, which deliberately ignore this option.
   */
  exclude?: Iterable<string>
}

export function getRequestDependencies(ssrContext: SSRContext, rendererContext: RendererContext, options?: RequestDependenciesOptions): ModuleDependencies {
  const excluded = options?.exclude ? new Set(options.exclude) : undefined
  const hasExcluded = excluded && excluded.size > 0

  if (!hasExcluded && ssrContext._requestDependencies) {
    return ssrContext._requestDependencies
  }
  let ids: Set<string>
  const requestIds = ssrContext.modules /* vite */ || ssrContext._registeredComponents /* webpack */
  if (hasExcluded) {
    ids = new Set<string>()
    for (const id of rendererContext._entrypoints) {
      if (!excluded!.has(id)) {
        ids.add(id)
      }
    }
    if (requestIds) {
      for (const id of requestIds) {
        if (!excluded!.has(id)) {
          ids.add(id)
        }
      }
    }
  }
  else {
    ids = new Set<string>(rendererContext._entrypoints)
    if (requestIds) {
      for (const id of requestIds) ids.add(id)
    }
  }
  const deps = getAllDependencies(ids, rendererContext)
  if (!hasExcluded) {
    ssrContext._requestDependencies = deps
  }
  return deps
}

function getRenderedOutputs(rendererContext: RendererContext, deps: ModuleDependencies): RenderedOutputs {
  let entry = rendererContext._renderedCache.get(deps)
  if (!entry) {
    entry = {}
    rendererContext._renderedCache.set(deps, entry)
  }
  return entry
}

export function renderStyles(ssrContext: SSRContext, rendererContext: RendererContext): string {
  const deps = getRequestDependencies(ssrContext, rendererContext)
  const rendered = getRenderedOutputs(rendererContext, deps)
  if (rendered.styles !== undefined) {
    return rendered.styles
  }
  const { styles } = deps
  let result = ''
  for (const key in styles) {
    const resource = styles[key]!
    result += `<link rel="stylesheet" href="${rendererContext.buildAssetsURL(resource.file)}" crossorigin>`
  }
  rendered.styles = result
  return result
}

export function getResources(ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  return [...getPreloadLinks(ssrContext, rendererContext), ...getPrefetchLinks(ssrContext, rendererContext)]
}

export function renderResourceHints(ssrContext: SSRContext, rendererContext: RendererContext, options?: RequestDependenciesOptions): string {
  const deps = getRequestDependencies(ssrContext, rendererContext, options)
  const rendered = getRenderedOutputs(rendererContext, deps)
  if (rendered.hints !== undefined) {
    return rendered.hints
  }
  const { preload, prefetch } = deps
  let result = ''

  // Render preload links
  for (const key in preload) {
    const resource = preload[key]!
    const href = rendererContext.buildAssetsURL(resource.file)
    const rel = resource.module ? 'modulepreload' : 'preload'
    const crossorigin = (resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module) ? ' crossorigin' : ''

    if (resource.resourceType && resource.mimeType) {
      result += `<link rel="${rel}" as="${resource.resourceType}" type="${resource.mimeType}"${crossorigin} href="${href}">`
    }
    else if (resource.resourceType) {
      result += `<link rel="${rel}" as="${resource.resourceType}"${crossorigin} href="${href}">`
    }
    else {
      result += `<link rel="${rel}"${crossorigin} href="${href}">`
    }
  }
  // Render prefetch links
  for (const key in prefetch) {
    const resource = prefetch[key]!
    const href = rendererContext.buildAssetsURL(resource.file)
    const crossorigin = (resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module) ? ' crossorigin' : ''

    if (resource.resourceType && resource.mimeType) {
      result += `<link rel="prefetch" as="${resource.resourceType}" type="${resource.mimeType}"${crossorigin} href="${href}">`
    }
    else if (resource.resourceType) {
      result += `<link rel="prefetch" as="${resource.resourceType}"${crossorigin} href="${href}">`
    }
    else {
      result += `<link rel="prefetch"${crossorigin} href="${href}">`
    }
  }

  rendered.hints = result
  return result
}

const NON_ASCII_RE = /[^\0-\u007F]+/g

export function renderResourceHeaders(ssrContext: SSRContext, rendererContext: RendererContext, options?: RequestDependenciesOptions): Record<string, string> {
  const deps = getRequestDependencies(ssrContext, rendererContext, options)
  const rendered = getRenderedOutputs(rendererContext, deps)
  if (rendered.headerLink !== undefined) {
    return { link: rendered.headerLink }
  }
  const { preload, prefetch } = deps
  const links: string[] = []

  // Render preload headers
  for (const key in preload) {
    const resource = preload[key]!
    const href = rendererContext.buildAssetsURL(resource.file).replace(NON_ASCII_RE, encodeURIComponent)
    const rel = resource.module ? 'modulepreload' : 'preload'
    let header = `<${href}>; rel="${rel}"`

    if (resource.resourceType) {
      header += `; as="${resource.resourceType}"`
    }
    if (resource.mimeType) {
      header += `; type="${resource.mimeType}"`
    }
    if (resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module) {
      header += '; crossorigin'
    }

    links.push(header)
  }

  // Render prefetch headers
  for (const key in prefetch) {
    const resource = prefetch[key]!
    const href = rendererContext.buildAssetsURL(resource.file).replace(NON_ASCII_RE, encodeURIComponent)
    let header = `<${href}>; rel="prefetch"`

    if (resource.resourceType) {
      header += `; as="${resource.resourceType}"`
    }
    if (resource.mimeType) {
      header += `; type="${resource.mimeType}"`
    }
    if (resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module) {
      header += '; crossorigin'
    }

    links.push(header)
  }

  rendered.headerLink = links.join(', ')
  return {
    link: rendered.headerLink,
  }
}

export function getPreloadLinks(ssrContext: SSRContext, rendererContext: RendererContext, options?: RequestDependenciesOptions): LinkAttributes[] {
  const { preload } = getRequestDependencies(ssrContext, rendererContext, options)
  const result: LinkAttributes[] = []
  for (const key in preload) {
    const resource = preload[key]!
    result.push({
      rel: resource.module ? 'modulepreload' : 'preload',
      as: resource.resourceType,
      type: resource.mimeType ?? null,
      crossorigin: resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module ? '' : null,
      href: rendererContext.buildAssetsURL(resource.file),
    })
  }
  return result
}

export function getPrefetchLinks(ssrContext: SSRContext, rendererContext: RendererContext, options?: RequestDependenciesOptions): LinkAttributes[] {
  const { prefetch } = getRequestDependencies(ssrContext, rendererContext, options)
  const result: LinkAttributes[] = []
  for (const key in prefetch) {
    const resource = prefetch[key]!
    result.push({
      rel: 'prefetch',
      as: resource.resourceType,
      type: resource.mimeType ?? null,
      crossorigin: resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module ? '' : null,
      href: rendererContext.buildAssetsURL(resource.file),
    })
  }
  return result
}

export function renderScripts(ssrContext: SSRContext, rendererContext: RendererContext): string {
  const deps = getRequestDependencies(ssrContext, rendererContext)
  const rendered = getRenderedOutputs(rendererContext, deps)
  if (rendered.scripts !== undefined) {
    return rendered.scripts
  }
  const { scripts } = deps
  let result = ''
  for (const key in scripts) {
    const resource = scripts[key]!
    if (resource.module) {
      result += `<script type="module" src="${rendererContext.buildAssetsURL(resource.file)}" crossorigin></script>`
    }
    else {
      result += `<script src="${rendererContext.buildAssetsURL(resource.file)}" defer crossorigin></script>`
    }
  }
  rendered.scripts = result
  return result
}

export type RenderFunction = (ssrContext: SSRContext, rendererContext: RendererContext) => unknown

type CreateApp<App> = (ssrContext: SSRContext) => App | Promise<App>
type ImportOf<T> = T | { default: T } | Promise<T> | Promise<{ default: T }>

type RenderToString<App> = (app: App, ssrContext: SSRContext) => string | Promise<string>

export interface Renderer {
  rendererContext: RendererContext
  renderToString: (ssrContext: SSRContext) => Promise<{
    html: string
    renderResourceHeaders: () => Record<string, string>
    renderResourceHints: () => string
    renderStyles: () => string
    renderScripts: () => string
  }>
}

export function createRenderer<App>(createApp: ImportOf<CreateApp<App>>, renderOptions: RenderOptions & { renderToString: RenderToString<App> }): Renderer {
  const rendererContext = createRendererContext(renderOptions)

  return {
    rendererContext,
    async renderToString(ssrContext: SSRContext) {
      ssrContext._registeredComponents = ssrContext._registeredComponents || new Set()

      const _createApp = await Promise.resolve(createApp).then(r => 'default' in r ? r.default : r)
      const app = await _createApp(ssrContext)
      const html = await renderOptions.renderToString(app, ssrContext)

      const wrap = <T extends RenderFunction> (fn: T) => () => fn(ssrContext, rendererContext) as ReturnType<T>

      return {
        html,
        renderResourceHeaders: wrap(renderResourceHeaders),
        renderResourceHints: wrap(renderResourceHints),
        renderStyles: wrap(renderStyles),
        renderScripts: wrap(renderScripts),
      }
    },
  }
}
