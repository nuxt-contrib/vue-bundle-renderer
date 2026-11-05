import type { Manifest, ResourceMeta } from './types'
import type { ModuleDependencies } from './runtime'

const EMPTY: readonly string[] = []

function addOwnResources(manifest: Manifest, id: string, meta: ResourceMeta, deps: ModuleDependencies, includeScript: boolean) {
  if (meta.file) {
    if (meta.preload) {
      deps.preload[id] = meta
    }
    if (includeScript && (meta.isEntry || meta.sideEffects)) {
      deps.scripts[id] = meta
    }
  }

  for (const css of meta.css || EMPTY) {
    const cssResource = manifest[css]
    if (cssResource) {
      deps.styles[css] = cssResource
      if (cssResource.preload) {
        deps.preload[css] = cssResource
      }
      deps.prefetch[css] = cssResource
    }
  }

  for (const asset of meta.assets || EMPTY) {
    const assetResource = manifest[asset]
    if (assetResource) {
      if (assetResource.preload) {
        deps.preload[asset] = assetResource
      }
      deps.prefetch[asset] = assetResource
    }
  }
}

function mergeInto(deps: ModuleDependencies, source: ModuleDependencies) {
  Object.assign(deps.styles, source.styles)
  Object.assign(deps.preload, source.preload)
  Object.assign(deps.prefetch, source.prefetch)
}

interface ResolveState {
  manifest: Manifest
  resolved: Record<string, ModuleDependencies>
  index: Map<string, number>
  stack: string[]
}

function collectComponent(state: ResolveState, root: string, component: Set<string>): ModuleDependencies {
  const { manifest, resolved } = state
  const deps: ModuleDependencies = { scripts: {}, styles: {}, preload: {}, prefetch: {} }
  const visited = new Set<string>()
  const walk = (moduleId: string) => {
    visited.add(moduleId)
    const meta = manifest[moduleId]
    if (!meta) {
      return
    }
    addOwnResources(manifest, moduleId, meta, deps, moduleId === root)
    for (const depId of meta.imports || EMPTY) {
      if (!component.has(depId)) {
        mergeInto(deps, resolved[depId]!)
      }
      else if (!visited.has(depId)) {
        walk(depId)
      }
    }
  }
  walk(root)
  return deps
}

/** Tarjan's strongly connected components algorithm; returns the lowlink of `moduleId`. */
function visit(state: ResolveState, moduleId: string): number {
  const { manifest, resolved, index, stack } = state
  const order = index.size
  let lowlink = order
  index.set(moduleId, order)
  stack.push(moduleId)

  const meta = manifest[moduleId]
  const imports = meta?.imports || EMPTY
  for (const depId of imports) {
    if (resolved[depId]) {
      continue
    }
    const depOrder = index.get(depId)
    // A visited module that is not yet resolved is still on the stack.
    const depLowlink = depOrder === undefined ? visit(state, depId) : depOrder
    if (depLowlink < lowlink) {
      lowlink = depLowlink
    }
  }

  if (lowlink !== order) {
    return lowlink
  }

  if (stack[stack.length - 1] === moduleId) {
    stack.pop()
    const deps: ModuleDependencies = { scripts: {}, styles: {}, preload: {}, prefetch: {} }
    if (meta) {
      addOwnResources(manifest, moduleId, meta, deps, true)
      for (const depId of imports) {
        const depDeps = resolved[depId]
        if (depDeps) {
          mergeInto(deps, depDeps)
        }
      }
    }
    resolved[moduleId] = deps
    return lowlink
  }

  const component = new Set<string>()
  let member: string
  do {
    member = stack.pop()!
    component.add(member)
  } while (member !== moduleId)

  for (const root of component) {
    resolved[root] = collectComponent(state, root, component)
  }
  return lowlink
}

/**
 * Resolves `id` and every module it statically imports into `resolved`.
 * Styles, preload and prefetch cover every reachable module, in pre-order of
 * `imports`, so modules in an import cycle all include the whole cycle.
 */
export function resolveModuleDependencies(manifest: Manifest, id: string, resolved: Record<string, ModuleDependencies>): ModuleDependencies {
  if (!resolved[id]) {
    visit({ manifest, resolved, index: new Map(), stack: [] }, id)
  }
  return resolved[id]!
}
