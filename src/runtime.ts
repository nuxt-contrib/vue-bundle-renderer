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
  styleSlots: number[]
  scriptSlots: number[]
  preloadSlots: number[]
  prefetchSlots: number[]
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
  _dependencySetAliases: Map<string, DependencySetAlias>
  _aliasIdHashes: Map<string, number>
  _dependencySetsCacheSize: number
  _entrypoints: string[]
  _renderedCache: WeakMap<ModuleDependencies, RenderedOutputs>
  _fragments: Record<FragmentKind, string[]>
  _flatDependencies: Map<string, FlatDependencies>
  _mergeSlots: MergeSlots
  _idScratch: string[]
  updateManifest: (manifest: Manifest) => void
}

/**
 * A module's dependency contribution as parallel id/meta arrays, including the
 * prefetch entries pulled in through its dynamic imports. Merging requests is
 * then an indexed array walk rather than a `for..in` over dictionary objects.
 */
interface FlatDependencies {
  scriptSlots: number[]
  styleSlots: number[]
  preloadSlots: number[]
  prefetchSlots: number[]
}

/** Interned resource slots, plus the stamp lanes a merge marks to deduplicate. */
interface MergeSlots {
  slotOf: Map<string, number>
  idOf: string[]
  metaOf: ResourceMeta[]
  scripts: Uint8Array
  styles: Uint8Array
  preload: Uint8Array
  prefetch: Uint8Array
  epoch: number
}

function createMergeSlots(capacity = 16): MergeSlots {
  return {
    slotOf: new Map(),
    idOf: [],
    metaOf: [],
    scripts: new Uint8Array(capacity),
    styles: new Uint8Array(capacity),
    preload: new Uint8Array(capacity),
    prefetch: new Uint8Array(capacity),
    epoch: 0,
  }
}

function slotFor(slots: MergeSlots, id: string, meta: ResourceMeta): number {
  let slot = slots.slotOf.get(id)
  if (slot === undefined) {
    slot = slots.slotOf.size
    slots.slotOf.set(id, slot)
    slots.idOf.push(id)
    slots.metaOf.push(meta)
    if (slot >= slots.scripts.length) {
      const capacity = slots.scripts.length * 2
      for (const kind of ['scripts', 'styles', 'preload', 'prefetch'] as const) {
        const grown = new Uint8Array(capacity)
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
    _aliasIdHashes: new Map(),
    _dependencySetsCacheSize: cacheSize,
    _entrypoints: [],
    _renderedCache: new WeakMap(),
    _fragments: createFragmentCaches(),
    _flatDependencies: new Map(),
    _mergeSlots: createMergeSlots(),
    _idScratch: [],
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
    ctx._aliasIdHashes.clear()
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

/** Keyed by a hash of the request's ids, so every lookup verifies them. */
interface DependencySetAlias {
  ids: string[]
  deps: ModuleDependencies
}

/** Past this, the table is dropped wholesale; stale alias keys stop matching. */
const MAX_ALIAS_ID_HASHES = 65536

function aliasHash(rendererContext: RendererContext, entrypoints: string[], requestIds: Iterable<string> | undefined): string {
  const hashes = rendererContext._aliasIdHashes
  if (hashes.size > MAX_ALIAS_ID_HASHES) {
    hashes.clear()
    rendererContext._dependencySetAliases.clear()
  }
  let sum = 0
  let mixed = 1
  let count = 0
  for (const id of entrypoints) {
    let hash = hashes.get(id)
    if (hash === undefined) {
      hash = (hashes.size * 2654435761) | 0
      hashes.set(id, hash)
    }
    sum = (sum + hash) | 0
    mixed = (mixed ^ (hash + count)) | 0
    count++
  }
  if (requestIds) {
    for (const id of requestIds) {
      let hash = hashes.get(id)
      if (hash === undefined) {
        hash = (hashes.size * 2654435761) | 0
        hashes.set(id, hash)
      }
      sum = (sum + hash) | 0
      mixed = (mixed ^ (hash + count)) | 0
      count++
    }
  }
  return `${count}:${sum}:${mixed}`
}

function readAlias(rendererContext: RendererContext, aliasKey: string, moduleIds: string[] | undefined, entrypoints: string[], requestIds: Iterable<string> | undefined): ModuleDependencies | undefined {
  const entry = rendererContext._dependencySetAliases.get(aliasKey)
  if (entry === undefined) {
    return undefined
  }
  const { ids } = entry
  let i = 0
  if (moduleIds) {
    if (moduleIds.length !== ids.length) {
      return undefined
    }
    for (; i < moduleIds.length; i++) {
      if (ids[i] !== moduleIds[i]) {
        return undefined
      }
    }
    return entry.deps
  }
  for (const id of entrypoints) {
    if (ids[i++] !== id) {
      return undefined
    }
  }
  if (requestIds) {
    for (const id of requestIds) {
      if (ids[i++] !== id) {
        return undefined
      }
    }
  }
  return i === ids.length ? entry.deps : undefined
}

function setAlias(rendererContext: RendererContext, aliasKey: string, ids: string[], deps: ModuleDependencies, cacheSize: number) {
  const aliases = rendererContext._dependencySetAliases
  aliases.set(aliasKey, { ids: [...ids], deps })
  if (aliases.size > cacheSize) {
    const oldest = aliases.keys().next().value
    if (oldest !== undefined) {
      aliases.delete(oldest)
    }
  }
}

function collectInto(source: Record<string, ResourceMeta>, slots: number[], mergeSlots: MergeSlots) {
  for (const id in source) {
    slots.push(slotFor(mergeSlots, id, source[id]!))
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
    scriptSlots: [],
    styleSlots: [],
    preloadSlots: [],
    prefetchSlots: [],
  }
  collectInto(deps.scripts, flat.scriptSlots, mergeSlots)
  collectInto(deps.styles, flat.styleSlots, mergeSlots)
  collectInto(deps.preload, flat.preloadSlots, mergeSlots)
  collectInto(deps.prefetch, flat.prefetchSlots, mergeSlots)

  const dynamicImports = rendererContext.manifest?.[id]?.dynamicImports || rendererContext.precomputed?.modules[id]?.dynamicImports
  if (dynamicImports) {
    for (const dynamicDepId of dynamicImports) {
      const dynamicDeps = getModuleDependencies(dynamicDepId, rendererContext)
      collectInto(dynamicDeps.scripts, flat.prefetchSlots, mergeSlots)
      collectInto(dynamicDeps.styles, flat.prefetchSlots, mergeSlots)
      collectInto(dynamicDeps.preload, flat.prefetchSlots, mergeSlots)
    }
  }

  rendererContext._flatDependencies.set(id, flat)
  return flat
}

export function getAllDependencies(ids: Set<string>, rendererContext: RendererContext): ModuleDependencies {
  const cacheSize = rendererContext._dependencySetsCacheSize

  // The canonical key is sorted so that requests differing only in order share
  // an entry; the alias key is not, and is verified on hit.
  const moduleIds = rendererContext._idScratch
  moduleIds.length = 0
  for (const id of ids) moduleIds.push(id)

  let aliasKey = ''
  if (cacheSize > 0 && ids.size > 1) {
    aliasKey = aliasHash(rendererContext, moduleIds, undefined)
    const aliased = readAlias(rendererContext, aliasKey, moduleIds, moduleIds, undefined)
    if (aliased !== undefined) {
      return aliased
    }
  }

  return resolveDependencies(moduleIds, rendererContext, aliasKey)
}

/** The id list may contain duplicates: merging deduplicates at resource level. */
function resolveDependencies(moduleIds: string[], rendererContext: RendererContext, aliasKey: string): ModuleDependencies {
  const cacheSize = rendererContext._dependencySetsCacheSize
  const useCache = cacheSize > 0

  let cacheKey = ''
  if (useCache) {
    if (moduleIds.length <= 1) {
      // A one-element list is already sorted.
      cacheKey = moduleIds[0] || ''
    }
    else {
      cacheKey = [...new Set(moduleIds)].sort().join(',')
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
        setAlias(rendererContext, aliasKey, moduleIds, cached, cacheSize)
      }
      return cached
    }
  }

  const styleSlots: number[] = []
  const scriptSlots: number[] = []
  // Deduplicated in first-seen order; filtered into records once `styles` is
  // fully known.
  const preloadSlots: number[] = []
  const prefetchSlots: number[] = []

  const mergeSlots = rendererContext._mergeSlots
  // The epoch is a byte, so the lanes are cleared when it wraps.
  let epoch = mergeSlots.epoch + 1
  if (epoch > 255) {
    epoch = 1
    mergeSlots.scripts.fill(0)
    mergeSlots.styles.fill(0)
    mergeSlots.preload.fill(0)
    mergeSlots.prefetch.fill(0)
  }
  mergeSlots.epoch = epoch
  let scriptSeen = mergeSlots.scripts
  let styleSeen = mergeSlots.styles
  let preloadSeen = mergeSlots.preload
  let prefetchSeen = mergeSlots.prefetch

  for (let m = 0; m < moduleIds.length; m++) {
    const flat = getFlatDependencies(moduleIds[m]!, rendererContext)
    if (mergeSlots.scripts !== scriptSeen) {
      // Flattening a new module can allocate new slot arrays.
      scriptSeen = mergeSlots.scripts
      styleSeen = mergeSlots.styles
      preloadSeen = mergeSlots.preload
      prefetchSeen = mergeSlots.prefetch
    }
    for (let i = 0; i < flat.scriptSlots.length; i++) {
      const slot = flat.scriptSlots[i]!
      if (scriptSeen[slot] === epoch) continue
      scriptSeen[slot] = epoch
      scriptSlots.push(slot)
    }
    for (let i = 0; i < flat.styleSlots.length; i++) {
      const slot = flat.styleSlots[i]!
      if (styleSeen[slot] === epoch) continue
      styleSeen[slot] = epoch
      styleSlots.push(slot)
    }
    for (let i = 0; i < flat.preloadSlots.length; i++) {
      const slot = flat.preloadSlots[i]!
      if (preloadSeen[slot] === epoch) continue
      preloadSeen[slot] = epoch
      preloadSlots.push(slot)
    }
    for (let i = 0; i < flat.prefetchSlots.length; i++) {
      const slot = flat.prefetchSlots[i]!
      if (prefetchSeen[slot] === epoch) continue
      prefetchSeen[slot] = epoch
      prefetchSlots.push(slot)
    }
  }

  // Don't prefetch resources that are preloaded or synchronously loaded as
  // styles, and don't preload styles that are synchronously loaded.
  let kept = 0
  for (let i = 0; i < preloadSlots.length; i++) {
    const slot = preloadSlots[i]!
    if (styleSeen[slot] !== epoch) {
      preloadSlots[kept] = slot
      kept++
    }
  }
  preloadSlots.length = kept

  kept = 0
  const metaOf = mergeSlots.metaOf
  for (let i = 0; i < prefetchSlots.length; i++) {
    const slot = prefetchSlots[i]!
    const dep = metaOf[slot]!
    if (dep.prefetch && preloadSeen[slot] !== epoch && styleSeen[slot] !== epoch) {
      prefetchSlots[kept] = slot
      kept++
    }
  }
  prefetchSlots.length = kept

  const order: MergedOrder = {
    styleSlots,
    scriptSlots,
    preloadSlots,
    prefetchSlots,
  }

  const allDeps = {} as ModuleDependencies
  defineLazyRecord(allDeps, 'scripts', mergeSlots, scriptSlots)
  defineLazyRecord(allDeps, 'styles', mergeSlots, styleSlots)
  defineLazyRecord(allDeps, 'preload', mergeSlots, preloadSlots)
  defineLazyRecord(allDeps, 'prefetch', mergeSlots, prefetchSlots)
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
      setAlias(rendererContext, aliasKey, moduleIds, allDeps, cacheSize)
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
  const requestIds = ssrContext.modules /* vite */ || ssrContext._registeredComponents /* webpack */

  // Probe the alias map before building the id list.
  let aliasKey = ''
  if (!hasExcluded && rendererContext._dependencySetsCacheSize > 0) {
    aliasKey = aliasHash(rendererContext, rendererContext._entrypoints, requestIds)
    const aliased = readAlias(rendererContext, aliasKey, undefined, rendererContext._entrypoints, requestIds)
    if (aliased !== undefined) {
      ssrContext._requestDependencies = aliased
      return aliased
    }
  }
  const moduleIds = rendererContext._idScratch
  moduleIds.length = 0
  if (hasExcluded) {
    for (const id of rendererContext._entrypoints) {
      if (!excluded!.has(id)) {
        moduleIds.push(id)
      }
    }
    if (requestIds) {
      for (const id of requestIds) {
        if (!excluded!.has(id)) {
          moduleIds.push(id)
        }
      }
    }
  }
  else {
    for (const id of rendererContext._entrypoints) moduleIds.push(id)
    if (requestIds) {
      for (const id of requestIds) moduleIds.push(id)
    }
  }
  const deps = resolveDependencies(moduleIds, rendererContext, aliasKey)
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
function defineLazyRecord(target: ModuleDependencies, key: keyof ModuleDependencies, mergeSlots: MergeSlots, slots: number[]) {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    get() {
      const { idOf, metaOf } = mergeSlots
      const record: Record<string, ResourceMeta> = {}
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]!
        record[idOf[slot]!] = metaOf[slot]!
      }
      Object.defineProperty(target, key, { value: record, writable: true, enumerable: true, configurable: true })
      return record
    },
    set(value: Record<string, ResourceMeta>) {
      Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true })
    },
  })
}

function collectOrder(source: Record<string, ResourceMeta>, slots: number[], mergeSlots: MergeSlots) {
  for (const id in source) {
    slots.push(slotFor(mergeSlots, id, source[id]!))
  }
}

/** Records supplied by a caller carry no order, so derive and memoize one. */
function getOrder(rendererContext: RendererContext, deps: ModuleDependencies, rendered: RenderedOutputs): MergedOrder {
  if (rendered.order) {
    return rendered.order
  }
  const mergeSlots = rendererContext._mergeSlots
  const order: MergedOrder = {
    styleSlots: [],
    scriptSlots: [],
    preloadSlots: [],
    prefetchSlots: [],
  }
  collectOrder(deps.styles, order.styleSlots, mergeSlots)
  collectOrder(deps.scripts, order.scriptSlots, mergeSlots)
  collectOrder(deps.preload, order.preloadSlots, mergeSlots)
  collectOrder(deps.prefetch, order.prefetchSlots, mergeSlots)
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
  const metaOf = rendererContext._mergeSlots.metaOf
  let result = ''
  const cache = rendererContext._fragments.style
  for (let i = 0; i < order.styleSlots.length; i++) {
    const slot = order.styleSlots[i]!
    let fragment = cache[slot]
    if (fragment === undefined) {
      fragment = cache[slot] = `<link rel="stylesheet" href="${rendererContext.buildAssetsURL(metaOf[slot]!.file)}" crossorigin>`
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
  const metaOf = rendererContext._mergeSlots.metaOf
  let result = ''

  // Render preload links
  const preloadCache = rendererContext._fragments.preloadHint
  for (let i = 0; i < order.preloadSlots.length; i++) {
    const slot = order.preloadSlots[i]!
    if (!withScripts && isScriptResource(metaOf[slot]!)) {
      continue
    }
    let fragment = preloadCache[slot]
    if (fragment === undefined) {
      const resource = metaOf[slot]!
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
    const slot = order.prefetchSlots[i]!
    if (!withScripts && isScriptResource(metaOf[slot]!)) {
      continue
    }
    let fragment = prefetchCache[slot]
    if (fragment === undefined) {
      const resource = metaOf[slot]!
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
  const metaOf = rendererContext._mergeSlots.metaOf
  let link = ''

  // Render preload headers
  const preloadCache = rendererContext._fragments.preloadHeader
  for (let i = 0; i < order.preloadSlots.length; i++) {
    const slot = order.preloadSlots[i]!
    if (!withScripts && isScriptResource(metaOf[slot]!)) {
      continue
    }
    let header = preloadCache[slot]
    if (header === undefined) {
      const resource = metaOf[slot]!
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
    const slot = order.prefetchSlots[i]!
    if (!withScripts && isScriptResource(metaOf[slot]!)) {
      continue
    }
    let header = prefetchCache[slot]
    if (header === undefined) {
      const resource = metaOf[slot]!
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
  const metaOf = rendererContext._mergeSlots.metaOf
  const withScripts = options?.scripts !== false
  const result: LinkAttributes[] = []
  for (let i = 0; i < order.preloadSlots.length; i++) {
    const resource = metaOf[order.preloadSlots[i]!]!
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
  const metaOf = rendererContext._mergeSlots.metaOf
  const withScripts = options?.scripts !== false
  const result: LinkAttributes[] = []
  for (let i = 0; i < order.prefetchSlots.length; i++) {
    const resource = metaOf[order.prefetchSlots[i]!]!
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
  const metaOf = rendererContext._mergeSlots.metaOf
  let result = ''
  const cache = rendererContext._fragments.script
  for (let i = 0; i < order.scriptSlots.length; i++) {
    const slot = order.scriptSlots[i]!
    let fragment = cache[slot]
    if (fragment === undefined) {
      const resource = metaOf[order.scriptSlots[i]!]!
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
