import type { Manifest } from './types'
import type { ModuleDependencies } from './runtime'

const EMPTY: readonly string[] = []

type Resolved = Record<string, ModuleDependencies>

/** A module on the DFS path with at least one import still unresolved. */
interface Frame {
  id: string
  order: number
  /** Own resources plus every import resolved outside the current cycle. */
  deps: ModuleDependencies
}

interface Tarjan {
  index: Map<string, Frame>
  stack: Frame[]
  count: number
}

function collectComponent(manifest: Manifest, root: string, component: Map<string, ModuleDependencies>): ModuleDependencies {
  const deps: ModuleDependencies = { scripts: {}, styles: {}, preload: {}, prefetch: {} }
  const visited = new Set<string>()
  const walk = (moduleId: string) => {
    visited.add(moduleId)
    const partial = component.get(moduleId)!
    if (moduleId === root) {
      Object.assign(deps.scripts, partial.scripts)
    }
    Object.assign(deps.styles, partial.styles)
    Object.assign(deps.preload, partial.preload)
    Object.assign(deps.prefetch, partial.prefetch)
    for (const depId of manifest[moduleId]!.imports || EMPTY) {
      if (component.has(depId) && !visited.has(depId)) {
        walk(depId)
      }
    }
  }
  walk(root)
  return deps
}

/**
 * Tarjan's strongly connected components algorithm. Returns the lowlink of
 * `moduleId`, or `Infinity` once `moduleId` is resolved without ever joining
 * the stack. A module only joins the stack when it has an unresolved import,
 * so acyclic graphs never allocate Tarjan state.
 */
function visit(manifest: Manifest, resolved: Resolved, moduleId: string, tarjan: Tarjan | undefined): number {
  const deps: ModuleDependencies = { scripts: {}, styles: {}, preload: {}, prefetch: {} }
  const meta = manifest[moduleId]
  if (!meta) {
    resolved[moduleId] = deps
    return Infinity
  }

  if (meta.file) {
    if (meta.preload) {
      deps.preload[moduleId] = meta
    }
    if (meta.isEntry || meta.sideEffects) {
      deps.scripts[moduleId] = meta
    }
  }
  for (const css of meta.css || EMPTY) {
    const cssResource = manifest[css]
    if (cssResource) {
      deps.styles[css] = deps.prefetch[css] = cssResource
      if (cssResource.preload) {
        deps.preload[css] = cssResource
      }
    }
  }
  for (const asset of meta.assets || EMPTY) {
    const assetResource = manifest[asset]
    if (assetResource) {
      deps.prefetch[asset] = assetResource
      if (assetResource.preload) {
        deps.preload[asset] = assetResource
      }
    }
  }

  let frame: Frame | undefined
  let lowlink = Infinity
  for (const depId of meta.imports || EMPTY) {
    let depDeps = resolved[depId]
    if (!depDeps) {
      if (!frame) {
        tarjan ||= { index: new Map(), stack: [], count: 0 }
        frame = { id: moduleId, order: tarjan.count++, deps }
        lowlink = frame.order
        tarjan.index.set(moduleId, frame)
        tarjan.stack.push(frame)
      }
      const depFrame = tarjan!.index.get(depId)
      // A visited module that is not yet resolved is still on the stack.
      const depLowlink = depFrame ? depFrame.order : visit(manifest, resolved, depId, tarjan)
      if (depLowlink < lowlink) {
        lowlink = depLowlink
      }
      depDeps = resolved[depId]
      if (!depDeps) {
        continue
      }
    }
    Object.assign(deps.styles, depDeps.styles)
    Object.assign(deps.preload, depDeps.preload)
    Object.assign(deps.prefetch, depDeps.prefetch)
  }

  if (!frame) {
    resolved[moduleId] = deps
    return Infinity
  }
  if (lowlink !== frame.order) {
    return lowlink
  }

  const stack = tarjan!.stack
  if (stack[stack.length - 1] === frame) {
    stack.pop()
    resolved[moduleId] = deps
    return lowlink
  }

  const component = new Map<string, ModuleDependencies>()
  let member: Frame
  do {
    member = stack.pop()!
    component.set(member.id, member.deps)
  } while (member !== frame)

  for (const root of component.keys()) {
    resolved[root] = collectComponent(manifest, root, component)
  }
  return lowlink
}

/**
 * Resolves `id` and every module it statically imports into `resolved`.
 * Styles, preload and prefetch cover every reachable module, so modules in an
 * import cycle all include the whole cycle.
 */
export function resolveModuleDependencies(manifest: Manifest, id: string, resolved: Resolved): ModuleDependencies {
  if (!resolved[id]) {
    visit(manifest, resolved, id, undefined)
  }
  return resolved[id]!
}
