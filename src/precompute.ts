import type { Manifest, ResourceMeta } from './types'
import type { ModuleDependencies } from './runtime'

export interface PrecomputedData {
  /** Pre-resolved dependencies for each module */
  dependencies: Record<string, ModuleDependencies>
  /** List of entry point module IDs */
  entrypoints: string[]
  /** Module metadata needed at runtime (file paths, etc.) */
  modules: Record<string, Pick<ResourceMeta, 'file' | 'resourceType' | 'mimeType' | 'module' | 'dynamicImports'>>
}

const EMPTY: readonly string[] = []

/**
 * Build-time utility to precompute all module dependencies from a manifest.
 * This eliminates recursive dependency resolution at runtime.
 *
 * @param manifest The build manifest
 * @returns Serializable precomputed data for runtime use
 */
export function precomputeDependencies(manifest: Manifest): PrecomputedData {
  const dependencies: Record<string, ModuleDependencies> = {}
  const computing = new Set<string>()

  function computeDependencies(id: string): ModuleDependencies {
    if (dependencies[id]) {
      return dependencies[id]
    }

    if (computing.has(id)) {
      // Circular dependency detected, return empty to break cycle
      return { scripts: {}, styles: {}, preload: {}, prefetch: {} }
    }

    computing.add(id)

    const deps: ModuleDependencies = {
      scripts: {},
      styles: {},
      preload: {},
      prefetch: {},
    }

    const meta = manifest[id]
    if (!meta) {
      dependencies[id] = deps
      computing.delete(id)
      return deps
    }

    // Add to scripts + preload
    if (meta.file) {
      if (meta.preload) {
        deps.preload[id] = meta
      }
      if (meta.isEntry || meta.sideEffects) {
        deps.scripts[id] = meta
      }
    }

    // Add styles + preload
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

    // Add assets as preload
    for (const asset of meta.assets || EMPTY) {
      const assetResource = manifest[asset]
      if (assetResource) {
        if (assetResource.preload) {
          deps.preload[asset] = assetResource
        }
        deps.prefetch[asset] = assetResource
      }
    }

    // Resolve nested dependencies and merge
    for (const depId of meta.imports || EMPTY) {
      const depDeps = computeDependencies(depId)
      Object.assign(deps.styles, depDeps.styles)
      Object.assign(deps.preload, depDeps.preload)
      Object.assign(deps.prefetch, depDeps.prefetch)
    }

    dependencies[id] = deps
    computing.delete(id)
    return deps
  }

  // Pre-compute dependencies, entry points, and the minimal module metadata
  // the runtime needs
  const entrypoints: string[] = []
  const modules: PrecomputedData['modules'] = {}
  for (const moduleId in manifest) {
    computeDependencies(moduleId)
    const meta = manifest[moduleId]!
    if (meta.isEntry) {
      entrypoints.push(moduleId)
    }
    const module: PrecomputedData['modules'][string] = {
      file: meta.file,
      resourceType: meta.resourceType,
      mimeType: meta.mimeType,
      module: meta.module,
    }
    if (meta.dynamicImports?.length) {
      module.dynamicImports = meta.dynamicImports
    }
    modules[moduleId] = module
  }

  return {
    dependencies,
    entrypoints,
    modules,
  }
}
