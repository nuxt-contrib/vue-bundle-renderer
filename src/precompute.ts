import type { Manifest, ResourceMeta } from './types'
import type { ModuleDependencies } from './runtime'

export interface PrecomputedData {
  /** Pre-resolved dependencies for each module */
  dependencies: Record<string, ModuleDependencies>
  /** List of entry point module IDs */
  entrypoints: string[]
  /** Module metadata needed at runtime (file paths, etc.) */
  modules: Record<string, Pick<ResourceMeta, 'file' | 'resourceType' | 'mimeType' | 'module'>>
}

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
      deps.preload[id] = meta
      if (meta.isEntry || meta.sideEffects) {
        deps.scripts[id] = meta
      }
    }

    // Add styles + preload
    for (const css of meta.css || []) {
      const cssResource = manifest[css]
      if (cssResource) {
        deps.styles[css] = cssResource
        deps.preload[css] = cssResource
        deps.prefetch[css] = cssResource
      }
    }

    // Add assets as preload
    for (const asset of meta.assets || []) {
      const assetResource = manifest[asset]
      if (assetResource) {
        deps.preload[asset] = assetResource
        deps.prefetch[asset] = assetResource
      }
    }

    // Resolve nested dependencies and merge
    for (const depId of meta.imports || []) {
      const depDeps = computeDependencies(depId)
      Object.assign(deps.styles, depDeps.styles)
      Object.assign(deps.preload, depDeps.preload)
      Object.assign(deps.prefetch, depDeps.prefetch)
    }

    // Filter preload based on preload flag
    const filteredPreload: ModuleDependencies['preload'] = {}
    for (const depId in deps.preload) {
      const dep = deps.preload[depId]
      if (dep.preload) {
        filteredPreload[depId] = dep
      }
    }
    deps.preload = filteredPreload

    dependencies[id] = deps
    computing.delete(id)
    return deps
  }

  // Pre-compute dependencies for all modules in manifest
  for (const moduleId of Object.keys(manifest)) {
    computeDependencies(moduleId)
  }

  // Extract entry points
  const entrypoints = new Set<string>()
  for (const key in manifest) {
    const meta = manifest[key]
    if (meta?.isEntry) {
      entrypoints.add(key)
    }
  }

  // Extract minimal module metadata needed at runtime
  const modules: Record<string, Pick<ResourceMeta, 'file' | 'resourceType' | 'mimeType' | 'module'>> = {}
  for (const [moduleId, meta] of Object.entries(manifest)) {
    modules[moduleId] = {
      file: meta.file,
      resourceType: meta.resourceType,
      mimeType: meta.mimeType,
      module: meta.module,
    }
  }

  return {
    dependencies,
    entrypoints: [...entrypoints],
    modules,
  }
}
