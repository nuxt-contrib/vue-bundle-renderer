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

/**
 * The merged dependency records as parallel arrays, carried alongside the
 * rendered output so render loops can walk arrays and index fragment caches by
 * slot instead of walking dictionary objects and hashing ids.
 */
interface MergedOrder {
  styleIds: string[]
  styleSlots: number[]
  styleMetas: ResourceMeta[]
  scriptIds: string[]
  scriptSlots: number[]
  scriptMetas: ResourceMeta[]
  preloadIds: string[]
  preloadSlots: number[]
  preloadMetas: ResourceMeta[]
  prefetchIds: string[]
  prefetchSlots: number[]
  prefetchMetas: ResourceMeta[]
}

interface RenderedOutputs {
  order?: MergedOrder
  styles?: string
  scripts?: string
  hints?: string
  hintsWithoutScripts?: string
  headerLink?: string
  headerLinkWithoutScripts?: string
}

export interface RendererContext {
  buildAssetsURL: (id: string) => string
  manifest?: Manifest
  precomputed?: PrecomputedData
  _dependencies: Record<string, ModuleDependencies>
  _dependencySets: Map<string, ModuleDependencies>
  _dependencySetAliases: Map<string, ModuleDependencies>
  _dependencySetsCacheSize: number
  _entrypoints: string[]
  _renderedCache: WeakMap<ModuleDependencies, RenderedOutputs>
  _fragments: Record<FragmentKind, string[]>
  _flatDependencies: Map<string, FlatDependencies>
  _mergeSlots: MergeSlots
  updateManifest: (manifest: Manifest) => void
}

/**
 * A module's dependency contribution as parallel id/meta arrays, including the
 * prefetch entries pulled in through its dynamic imports. Merging requests is
 * then an indexed array walk rather than a `for..in` over dictionary objects.
 */
interface FlatDependencies {
  scriptIds: string[]
  scriptMetas: ResourceMeta[]
  scriptSlots: number[]
  styleIds: string[]
  styleMetas: ResourceMeta[]
  styleSlots: number[]
  preloadIds: string[]
  preloadMetas: ResourceMeta[]
  preloadSlots: number[]
  prefetchIds: string[]
  prefetchMetas: ResourceMeta[]
  prefetchSlots: number[]
}

/** Interned resource slots, plus the stamp lanes a merge marks to deduplicate. */
interface MergeSlots {
  slotOf: Map<string, number>
  scripts: Int32Array
  styles: Int32Array
  preload: Int32Array
  prefetch: Int32Array
  epoch: number
}

function createMergeSlots(capacity = 16): MergeSlots {
  return {
    slotOf: new Map(),
    scripts: new Int32Array(capacity),
    styles: new Int32Array(capacity),
    preload: new Int32Array(capacity),
    prefetch: new Int32Array(capacity),
    epoch: 0,
  }
}

function slotFor(slots: MergeSlots, id: string): number {
  let slot = slots.slotOf.get(id)
  if (slot === undefined) {
    slot = slots.slotOf.size
    slots.slotOf.set(id, slot)
    if (slot >= slots.scripts.length) {
      const capacity = slots.scripts.length * 2
      for (const kind of ['scripts', 'styles', 'preload', 'prefetch'] as const) {
        const grown = new Int32Array(capacity)
        grown.set(slots[kind])
        slots[kind] = grown
      }
    }
  }
  return slot
}

type FragmentKind = 'style' | 'script' | 'preloadHint' | 'prefetchHint' | 'preloadHeader' | 'prefetchHeader'

function createFragmentCaches(): Record<FragmentKind, string[]> {
  return {
    style: [],
    script: [],
    preloadHint: [],
    prefetchHint: [],
    preloadHeader: [],
    prefetchHeader: [],
  }
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
    _dependencySetAliases: new Map(),
    _dependencySetsCacheSize: cacheSize,
    _entrypoints: [],
    _renderedCache: new WeakMap(),
    _fragments: createFragmentCaches(),
    _flatDependencies: new Map(),
    _mergeSlots: createMergeSlots(),
  }

  function collectEntrypoints(manifest: Manifest) {
    const entrypoints: string[] = []
    for (const id in manifest) {
      if (manifest[id].isEntry) {
        entrypoints.push(id)
      }
    }
    ctx._entrypoints = entrypoints
  }

  function updateManifest(manifest: Manifest) {
    ctx.manifest = manifest
    ctx._dependencies = {}
    ctx._dependencySets.clear()
    ctx._dependencySetAliases.clear()
    ctx._renderedCache = new WeakMap()
    ctx._fragments = createFragmentCaches()
    ctx._flatDependencies.clear()
    ctx._mergeSlots = createMergeSlots()
    collectEntrypoints(manifest)
  }

  if (precomputed) {
    ctx._dependencies = precomputed.dependencies
    ctx._entrypoints = precomputed.entrypoints
  }
  else if (manifest) {
    collectEntrypoints(manifest)
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

function setAlias(rendererContext: RendererContext, aliasKey: string, deps: ModuleDependencies, cacheSize: number) {
  const aliases = rendererContext._dependencySetAliases
  aliases.set(aliasKey, deps)
  if (aliases.size > cacheSize) {
    const oldest = aliases.keys().next().value
    if (oldest !== undefined) {
      aliases.delete(oldest)
    }
  }
}

function collectInto(source: Record<string, ResourceMeta>, ids: string[], metas: ResourceMeta[], slots: number[], mergeSlots: MergeSlots) {
  for (const id in source) {
    ids.push(id)
    metas.push(source[id]!)
    slots.push(slotFor(mergeSlots, id))
  }
}

function getFlatDependencies(id: string, rendererContext: RendererContext): FlatDependencies {
  const cached = rendererContext._flatDependencies.get(id)
  if (cached !== undefined) {
    return cached
  }

  const deps = getModuleDependencies(id, rendererContext)
  const mergeSlots = rendererContext._mergeSlots
  const flat: FlatDependencies = {
    scriptIds: [],
    scriptMetas: [],
    scriptSlots: [],
    styleIds: [],
    styleMetas: [],
    styleSlots: [],
    preloadIds: [],
    preloadMetas: [],
    preloadSlots: [],
    prefetchIds: [],
    prefetchMetas: [],
    prefetchSlots: [],
  }
  collectInto(deps.scripts, flat.scriptIds, flat.scriptMetas, flat.scriptSlots, mergeSlots)
  collectInto(deps.styles, flat.styleIds, flat.styleMetas, flat.styleSlots, mergeSlots)
  collectInto(deps.preload, flat.preloadIds, flat.preloadMetas, flat.preloadSlots, mergeSlots)
  collectInto(deps.prefetch, flat.prefetchIds, flat.prefetchMetas, flat.prefetchSlots, mergeSlots)

  const dynamicImports = rendererContext.manifest?.[id]?.dynamicImports || rendererContext.precomputed?.modules[id]?.dynamicImports
  if (dynamicImports) {
    for (const dynamicDepId of dynamicImports) {
      const dynamicDeps = getModuleDependencies(dynamicDepId, rendererContext)
      collectInto(dynamicDeps.scripts, flat.prefetchIds, flat.prefetchMetas, flat.prefetchSlots, mergeSlots)
      collectInto(dynamicDeps.styles, flat.prefetchIds, flat.prefetchMetas, flat.prefetchSlots, mergeSlots)
      collectInto(dynamicDeps.preload, flat.prefetchIds, flat.prefetchMetas, flat.prefetchSlots, mergeSlots)
    }
  }

  rendererContext._flatDependencies.set(id, flat)
  return flat
}

export function getAllDependencies(ids: Set<string>, rendererContext: RendererContext): ModuleDependencies {
  const cacheSize = rendererContext._dependencySetsCacheSize

  // The canonical key is sorted so that requests differing only in order share
  // an entry; the alias key is not, and is verified on hit.
  let aliasKey = ''
  if (cacheSize > 0 && ids.size > 1) {
    for (const id of ids) aliasKey += `${id},`
    const aliased = rendererContext._dependencySetAliases.get(aliasKey)
    if (aliased !== undefined) {
      return aliased
    }
  }

  return resolveDependencies(ids, rendererContext, aliasKey)
}

function resolveDependencies(ids: Set<string>, rendererContext: RendererContext, aliasKey: string): ModuleDependencies {
  const cacheSize = rendererContext._dependencySetsCacheSize
  const useCache = cacheSize > 0

  let cacheKey = ''
  if (useCache) {
    if (ids.size <= 1) {
      // A one-element set is already sorted.
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
      if (aliasKey) {
        setAlias(rendererContext, aliasKey, cached, cacheSize)
      }
      return cached
    }
  }

  const styleIds: string[] = []
  const styleMetas: ResourceMeta[] = []
  const styleSlots: number[] = []
  const scriptIds: string[] = []
  const scriptMetas: ResourceMeta[] = []
  const scriptSlots: number[] = []
  // Deduplicated in first-seen order; filtered into records once `styles` is
  // fully known.
  const preloadIds: string[] = []
  const preloadMetas: ResourceMeta[] = []
  const preloadSlots: number[] = []
  const prefetchIds: string[] = []
  const prefetchMetas: ResourceMeta[] = []
  const prefetchSlots: number[] = []

  const mergeSlots = rendererContext._mergeSlots
  const epoch = ++mergeSlots.epoch
  let scriptSeen = mergeSlots.scripts
  let styleSeen = mergeSlots.styles
  let preloadSeen = mergeSlots.preload
  let prefetchSeen = mergeSlots.prefetch

  for (const id of ids) {
    const flat = getFlatDependencies(id, rendererContext)
    if (mergeSlots.scripts !== scriptSeen) {
      // Flattening a new module can allocate new slot arrays.
      scriptSeen = mergeSlots.scripts
      styleSeen = mergeSlots.styles
      preloadSeen = mergeSlots.preload
      prefetchSeen = mergeSlots.prefetch
    }
    for (let i = 0; i < flat.scriptIds.length; i++) {
      const slot = flat.scriptSlots[i]!
      if (scriptSeen[slot] === epoch) continue
      scriptSeen[slot] = epoch
      scriptIds.push(flat.scriptIds[i]!)
      scriptMetas.push(flat.scriptMetas[i]!)
      scriptSlots.push(slot)
    }
    for (let i = 0; i < flat.styleIds.length; i++) {
      const slot = flat.styleSlots[i]!
      if (styleSeen[slot] === epoch) continue
      styleSeen[slot] = epoch
      styleIds.push(flat.styleIds[i]!)
      styleMetas.push(flat.styleMetas[i]!)
      styleSlots.push(slot)
    }
    for (let i = 0; i < flat.preloadIds.length; i++) {
      const slot = flat.preloadSlots[i]!
      if (preloadSeen[slot] === epoch) continue
      preloadSeen[slot] = epoch
      preloadIds.push(flat.preloadIds[i]!)
      preloadMetas.push(flat.preloadMetas[i]!)
      preloadSlots.push(slot)
    }
    for (let i = 0; i < flat.prefetchIds.length; i++) {
      const slot = flat.prefetchSlots[i]!
      if (prefetchSeen[slot] === epoch) continue
      prefetchSeen[slot] = epoch
      prefetchIds.push(flat.prefetchIds[i]!)
      prefetchMetas.push(flat.prefetchMetas[i]!)
      prefetchSlots.push(slot)
    }
  }

  // Don't prefetch resources that are preloaded or synchronously loaded as
  // styles, and don't preload styles that are synchronously loaded.
  let kept = 0
  for (let i = 0; i < preloadIds.length; i++) {
    const slot = preloadSlots[i]!
    if (styleSeen[slot] !== epoch) {
      preloadIds[kept] = preloadIds[i]!
      preloadMetas[kept] = preloadMetas[i]!
      preloadSlots[kept] = slot
      kept++
    }
  }
  preloadIds.length = kept
  preloadMetas.length = kept
  preloadSlots.length = kept

  kept = 0
  for (let i = 0; i < prefetchIds.length; i++) {
    const dep = prefetchMetas[i]!
    const slot = prefetchSlots[i]!
    if (dep.prefetch && preloadSeen[slot] !== epoch && styleSeen[slot] !== epoch) {
      prefetchIds[kept] = prefetchIds[i]!
      prefetchMetas[kept] = dep
      prefetchSlots[kept] = slot
      kept++
    }
  }
  prefetchIds.length = kept
  prefetchMetas.length = kept
  prefetchSlots.length = kept

  const order: MergedOrder = {
    styleIds,
    styleMetas,
    styleSlots,
    scriptIds,
    scriptMetas,
    scriptSlots,
    preloadIds,
    preloadMetas,
    preloadSlots,
    prefetchIds,
    prefetchMetas,
    prefetchSlots,
  }

  const allDeps = {} as ModuleDependencies
  defineLazyRecord(allDeps, 'scripts', scriptIds, scriptMetas)
  defineLazyRecord(allDeps, 'styles', styleIds, styleMetas)
  defineLazyRecord(allDeps, 'preload', preloadIds, preloadMetas)
  defineLazyRecord(allDeps, 'prefetch', prefetchIds, prefetchMetas)
  rendererContext._renderedCache.set(allDeps, { order })

  if (useCache) {
    rendererContext._dependencySets.set(cacheKey, allDeps)
    if (rendererContext._dependencySets.size > cacheSize) {
      // Map preserves insertion order; the first key is the oldest entry.
      const oldest = rendererContext._dependencySets.keys().next().value
      if (oldest !== undefined) {
        rendererContext._dependencySets.delete(oldest)
      }
    }
    if (aliasKey) {
      setAlias(rendererContext, aliasKey, allDeps, cacheSize)
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

  // On a cache hit the merged id set is never needed, so probe the alias map
  // before paying for the set.
  let aliasKey = ''
  if (!hasExcluded && rendererContext._dependencySetsCacheSize > 0) {
    for (const id of rendererContext._entrypoints) aliasKey += `${id},`
    if (requestIds) {
      for (const id of requestIds) aliasKey += `${id},`
    }
    const aliased = rendererContext._dependencySetAliases.get(aliasKey)
    if (aliased !== undefined) {
      ssrContext._requestDependencies = aliased
      return aliased
    }
  }
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
  const deps = resolveDependencies(ids, rendererContext, aliasKey)
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

/** Materialise `key` on first access and replace the accessor with a data property. */
function defineLazyRecord(target: ModuleDependencies, key: keyof ModuleDependencies, ids: string[], metas: ResourceMeta[]) {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      const record: Record<string, ResourceMeta> = {}
      for (let i = 0; i < ids.length; i++) {
        record[ids[i]!] = metas[i]!
      }
      Object.defineProperty(target, key, { value: record, writable: true, enumerable: true, configurable: true })
      return record
    },
    set(value: Record<string, ResourceMeta>) {
      Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true })
    },
  })
}

function collectOrder(source: Record<string, ResourceMeta>, ids: string[], metas: ResourceMeta[], slots: number[], mergeSlots: MergeSlots) {
  for (const id in source) {
    ids.push(id)
    metas.push(source[id]!)
    slots.push(slotFor(mergeSlots, id))
  }
}

/** Records supplied by a caller carry no order, so derive and memoize one. */
function getOrder(rendererContext: RendererContext, deps: ModuleDependencies, rendered: RenderedOutputs): MergedOrder {
  if (rendered.order) {
    return rendered.order
  }
  const mergeSlots = rendererContext._mergeSlots
  const order: MergedOrder = {
    styleIds: [],
    styleMetas: [],
    styleSlots: [],
    scriptIds: [],
    scriptMetas: [],
    scriptSlots: [],
    preloadIds: [],
    preloadMetas: [],
    preloadSlots: [],
    prefetchIds: [],
    prefetchMetas: [],
    prefetchSlots: [],
  }
  collectOrder(deps.styles, order.styleIds, order.styleMetas, order.styleSlots, mergeSlots)
  collectOrder(deps.scripts, order.scriptIds, order.scriptMetas, order.scriptSlots, mergeSlots)
  collectOrder(deps.preload, order.preloadIds, order.preloadMetas, order.preloadSlots, mergeSlots)
  collectOrder(deps.prefetch, order.prefetchIds, order.prefetchMetas, order.prefetchSlots, mergeSlots)
  rendered.order = order
  return order
}

export function renderStyles(ssrContext: SSRContext, rendererContext: RendererContext): string {
  const deps = getRequestDependencies(ssrContext, rendererContext)
  const rendered = getRenderedOutputs(rendererContext, deps)
  if (rendered.styles !== undefined) {
    return rendered.styles
  }
  const order = getOrder(rendererContext, deps, rendered)
  let result = ''
  const cache = rendererContext._fragments.style
  for (let i = 0; i < order.styleSlots.length; i++) {
    const slot = order.styleSlots[i]!
    let fragment = cache[slot]
    if (fragment === undefined) {
      fragment = cache[slot] = `<link rel="stylesheet" href="${rendererContext.buildAssetsURL(order.styleMetas[i]!.file)}" crossorigin>`
    }
    result += fragment
  }
  rendered.styles = result
  return result
}

export function getResources(ssrContext: SSRContext, rendererContext: RendererContext): LinkAttributes[] {
  return [...getPreloadLinks(ssrContext, rendererContext), ...getPrefetchLinks(ssrContext, rendererContext)]
}

export interface ResourceHintOptions extends RequestDependenciesOptions {
  /**
   * Whether to include hints for the client runtime, i.e. those rendered as
   * `rel="modulepreload"` or `as="script"`.
   *
   * @default true
   */
  scripts?: boolean
}

function isScriptResource(resource: ResourceMeta): boolean {
  return !!resource.module || resource.resourceType === 'script'
}

export function renderResourceHints(ssrContext: SSRContext, rendererContext: RendererContext, options?: ResourceHintOptions): string {
  const deps = getRequestDependencies(ssrContext, rendererContext, options)
  const rendered = getRenderedOutputs(rendererContext, deps)
  const withScripts = options?.scripts !== false
  const cached = withScripts ? rendered.hints : rendered.hintsWithoutScripts
  if (cached !== undefined) {
    return cached
  }
  const order = getOrder(rendererContext, deps, rendered)
  let result = ''

  // Render preload links
  const preloadCache = rendererContext._fragments.preloadHint
  for (let i = 0; i < order.preloadSlots.length; i++) {
    const resource = order.preloadMetas[i]!
    if (!withScripts && isScriptResource(resource)) {
      continue
    }
    const slot = order.preloadSlots[i]!
    let fragment = preloadCache[slot]
    if (fragment === undefined) {
      const href = rendererContext.buildAssetsURL(resource.file)
      const rel = resource.module ? 'modulepreload' : 'preload'
      const crossorigin = (resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module) ? ' crossorigin' : ''

      fragment = resource.resourceType && resource.mimeType
        ? `<link rel="${rel}" as="${resource.resourceType}" type="${resource.mimeType}"${crossorigin} href="${href}">`
        : resource.resourceType
          ? `<link rel="${rel}" as="${resource.resourceType}"${crossorigin} href="${href}">`
          : `<link rel="${rel}"${crossorigin} href="${href}">`
      preloadCache[slot] = fragment
    }
    result += fragment
  }
  // Render prefetch links
  const prefetchCache = rendererContext._fragments.prefetchHint
  for (let i = 0; i < order.prefetchSlots.length; i++) {
    const resource = order.prefetchMetas[i]!
    if (!withScripts && isScriptResource(resource)) {
      continue
    }
    const slot = order.prefetchSlots[i]!
    let fragment = prefetchCache[slot]
    if (fragment === undefined) {
      const href = rendererContext.buildAssetsURL(resource.file)
      const crossorigin = (resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module) ? ' crossorigin' : ''

      fragment = resource.resourceType && resource.mimeType
        ? `<link rel="prefetch" as="${resource.resourceType}" type="${resource.mimeType}"${crossorigin} href="${href}">`
        : resource.resourceType
          ? `<link rel="prefetch" as="${resource.resourceType}"${crossorigin} href="${href}">`
          : `<link rel="prefetch"${crossorigin} href="${href}">`
      prefetchCache[slot] = fragment
    }
    result += fragment
  }

  if (withScripts) {
    rendered.hints = result
  }
  else {
    rendered.hintsWithoutScripts = result
  }
  return result
}

const NON_ASCII_RE = /[^\0-\u007F]+/g

export function renderResourceHeaders(ssrContext: SSRContext, rendererContext: RendererContext, options?: ResourceHintOptions): Record<string, string> {
  const deps = getRequestDependencies(ssrContext, rendererContext, options)
  const rendered = getRenderedOutputs(rendererContext, deps)
  const withScripts = options?.scripts !== false
  const cached = withScripts ? rendered.headerLink : rendered.headerLinkWithoutScripts
  if (cached !== undefined) {
    return { link: cached }
  }
  const order = getOrder(rendererContext, deps, rendered)
  let link = ''

  // Render preload headers
  const preloadCache = rendererContext._fragments.preloadHeader
  for (let i = 0; i < order.preloadSlots.length; i++) {
    const resource = order.preloadMetas[i]!
    if (!withScripts && isScriptResource(resource)) {
      continue
    }
    const slot = order.preloadSlots[i]!
    let header = preloadCache[slot]
    if (header === undefined) {
      const href = rendererContext.buildAssetsURL(resource.file).replace(NON_ASCII_RE, encodeURIComponent)
      const rel = resource.module ? 'modulepreload' : 'preload'
      header = `<${href}>; rel="${rel}"`

      if (resource.resourceType) {
        header += `; as="${resource.resourceType}"`
      }
      if (resource.mimeType) {
        header += `; type="${resource.mimeType}"`
      }
      if (resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module) {
        header += '; crossorigin'
      }
      preloadCache[slot] = header
    }

    link = link ? `${link}, ${header}` : header
  }

  // Render prefetch headers
  const prefetchCache = rendererContext._fragments.prefetchHeader
  for (let i = 0; i < order.prefetchSlots.length; i++) {
    const resource = order.prefetchMetas[i]!
    if (!withScripts && isScriptResource(resource)) {
      continue
    }
    const slot = order.prefetchSlots[i]!
    let header = prefetchCache[slot]
    if (header === undefined) {
      const href = rendererContext.buildAssetsURL(resource.file).replace(NON_ASCII_RE, encodeURIComponent)
      header = `<${href}>; rel="prefetch"`

      if (resource.resourceType) {
        header += `; as="${resource.resourceType}"`
      }
      if (resource.mimeType) {
        header += `; type="${resource.mimeType}"`
      }
      if (resource.resourceType === 'style' || resource.resourceType === 'font' || resource.resourceType === 'script' || resource.module) {
        header += '; crossorigin'
      }
      prefetchCache[slot] = header
    }

    link = link ? `${link}, ${header}` : header
  }
  if (withScripts) {
    rendered.headerLink = link
  }
  else {
    rendered.headerLinkWithoutScripts = link
  }
  return { link }
}

export function getPreloadLinks(ssrContext: SSRContext, rendererContext: RendererContext, options?: ResourceHintOptions): LinkAttributes[] {
  const deps = getRequestDependencies(ssrContext, rendererContext, options)
  const order = getOrder(rendererContext, deps, getRenderedOutputs(rendererContext, deps))
  const withScripts = options?.scripts !== false
  const result: LinkAttributes[] = []
  for (let i = 0; i < order.preloadMetas.length; i++) {
    const resource = order.preloadMetas[i]!
    if (!withScripts && isScriptResource(resource)) {
      continue
    }
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

export function getPrefetchLinks(ssrContext: SSRContext, rendererContext: RendererContext, options?: ResourceHintOptions): LinkAttributes[] {
  const deps = getRequestDependencies(ssrContext, rendererContext, options)
  const order = getOrder(rendererContext, deps, getRenderedOutputs(rendererContext, deps))
  const withScripts = options?.scripts !== false
  const result: LinkAttributes[] = []
  for (let i = 0; i < order.prefetchMetas.length; i++) {
    const resource = order.prefetchMetas[i]!
    if (!withScripts && isScriptResource(resource)) {
      continue
    }
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
  const order = getOrder(rendererContext, deps, rendered)
  let result = ''
  const cache = rendererContext._fragments.script
  for (let i = 0; i < order.scriptSlots.length; i++) {
    const slot = order.scriptSlots[i]!
    let fragment = cache[slot]
    if (fragment === undefined) {
      const resource = order.scriptMetas[i]!
      fragment = cache[slot] = resource.module
        ? `<script type="module" src="${rendererContext.buildAssetsURL(resource.file)}" crossorigin></script>`
        : `<script src="${rendererContext.buildAssetsURL(resource.file)}" defer crossorigin></script>`
    }
    result += fragment
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
