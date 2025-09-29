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
}

export interface RendererContext {
  buildAssetsURL: (id: string) => string
  manifest?: Manifest
  precomputed?: PrecomputedData
  _dependencies: Record<string, ModuleDependencies>
  _dependencySets: Record<string, ModuleDependencies>
  _entrypoints: string[]
  updateManifest: (manifest: Manifest) => void
}

interface LinkAttributes {
  rel: string | null
  href: string
  as?: string | null
  type?: string | null
  crossorigin?: '' | null
}

export function createRendererContext({ manifest, precomputed, buildAssetsURL }: RenderOptions): RendererContext {
  if (!manifest && !precomputed) {
    throw new Error('Either manifest or precomputed data must be provided')
  }

  const ctx: RendererContext = {
    // Options
    buildAssetsURL: buildAssetsURL || withLeadingSlash,
    manifest,
    precomputed,
    updateManifest,
    // Internal cache
    _dependencies: {},
    _dependencySets: {},
    _entrypoints: [],
  }

  function updateManifest(manifest: Manifest) {
    const manifestEntries = Object.entries(manifest) as [string, ResourceMeta][]
    ctx.manifest = manifest
    ctx._dependencies = {}
    ctx._dependencySets = {}
    ctx._entrypoints = manifestEntries.filter(e => e[1].isEntry).map(([module]) => module)
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
  for (const depId of meta.imports || []) {
    const depDeps = getModuleDependencies(depId, rendererContext)
    for (const key in depDeps.styles) {
      dependencies.styles[key] = depDeps.styles[key]
    }
    for (const key in depDeps.preload) {
      dependencies.preload[key] = depDeps.preload[key]
    }
    for (const key in depDeps.prefetch) {
      dependencies.prefetch[key] = depDeps.prefetch[key]
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
  let cacheKey = ''
  const sortedIds = [...ids].sort()
  for (let i = 0; i < sortedIds.length; i++) {
    if (i > 0) cacheKey += ','
    cacheKey += sortedIds[i]
  }

  if (rendererContext._dependencySets[cacheKey]) {
    return rendererContext._dependencySets[cacheKey]
  }

  const allDeps: ModuleDependencies = {
    scripts: {},
    styles: {},
    preload: {},
    prefetch: {},
  }

  for (const id of ids) {
    const deps = getModuleDependencies(id, rendererContext)
    for (const key in deps.scripts) {
      allDeps.scripts[key] = deps.scripts[key]
    }
    for (const key in deps.styles) {
      allDeps.styles[key] = deps.styles[key]
    }
    for (const key in deps.preload) {
      allDeps.preload[key] = deps.preload[key]
    }
    for (const key in deps.prefetch) {
      allDeps.prefetch[key] = deps.prefetch[key]
    }

    for (const dynamicDepId of rendererContext.manifest?.[id]?.dynamicImports || []) {
      const dynamicDeps = getModuleDependencies(dynamicDepId, rendererContext)
      for (const key in dynamicDeps.scripts) {
        allDeps.prefetch[key] = dynamicDeps.scripts[key]
      }
      for (const key in dynamicDeps.styles) {
        allDeps.prefetch[key] = dynamicDeps.styles[key]
      }
      for (const key in dynamicDeps.preload) {
        allDeps.prefetch[key] = dynamicDeps.preload[key]
      }
    }
  }

  const filteredPrefetch: ModuleDependencies['prefetch'] = {}
  for (const id in allDeps.prefetch) {
    const dep = allDeps.prefetch[id]
    if (dep.prefetch) {
      filteredPrefetch[id] = dep
    }
  }
  allDeps.prefetch = filteredPrefetch

  // Don't render prefetch links if we're preloading them
  for (const id in allDeps.preload) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete allDeps.prefetch[id]
  }
  // Don't preload/prefetch styles if we are synchronously loading them
  for (const style in allDeps.styles) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete allDeps.preload[style]
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete allDeps.prefetch[style]
  }

  rendererContext._dependencySets[cacheKey] = allDeps
  return allDeps
}

export function getRequestDependencies(ssrContext: SSRContext, rendererContext: RendererContext): ModuleDependencies {
  if (ssrContext._requestDependencies) {
    return ssrContext._requestDependencies
  }
  const ids = new Set<string>(Array.from([
    ...rendererContext._entrypoints,
    ...ssrContext.modules /* vite */ || ssrContext._registeredComponents /* webpack */ || [],
  ]))
  const deps = getAllDependencies(ids, rendererContext)
  ssrContext._requestDependencies = deps
  return deps
}

export function renderStyles(ssrContext: SSRContext, rendererContext: RendererContext): string {
  const { styles } = getRequestDependencies(ssrContext, rendererContext)
  let result = ''
  for (const key in styles) {
    const resource = styles[key]!
    result += `<link rel="stylesheet" href="${rendererContext.buildAssetsURL(resource.file)}" crossorigin>`
  }
  return result
}

export function getResources(ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  return [...getPreloadLinks(ssrContext, rendererContext), ...getPrefetchLinks(ssrContext, rendererContext)]
}

export function renderResourceHints(ssrContext: SSRContext, rendererContext: RendererContext): string {
  const { preload, prefetch } = getRequestDependencies(ssrContext, rendererContext)
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

  return result
}

export function renderResourceHeaders(ssrContext: SSRContext, rendererContext: RendererContext): Record<string, string> {
  const { preload, prefetch } = getRequestDependencies(ssrContext, rendererContext)
  const links: string[] = []

  // Render preload headers
  for (const key in preload) {
    const resource = preload[key]!
    const href = rendererContext.buildAssetsURL(resource.file)
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
    const href = rendererContext.buildAssetsURL(resource.file)
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

  return {
    link: links.join(', '),
  }
}

export function getPreloadLinks(ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  const { preload } = getRequestDependencies(ssrContext, rendererContext)
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

export function getPrefetchLinks(ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  const { prefetch } = getRequestDependencies(ssrContext, rendererContext)
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
  const { scripts } = getRequestDependencies(ssrContext, rendererContext)
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
  return result
}

export type RenderFunction = (ssrContext: SSRContext, rendererContext: RendererContext) => unknown

type CreateApp<App> = (ssrContext: SSRContext) => App | Promise<App>
type ImportOf<T> = T | { default: T } | Promise<T> | Promise<{ default: T }>

type RenderToString<App> = (app: App, ssrContext: SSRContext) => string | Promise<string>

export function createRenderer<App>(createApp: ImportOf<CreateApp<App>>, renderOptions: RenderOptions & { renderToString: RenderToString<App> }) {
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
