import type { Manifest, ResourceMeta } from './types'
import type { ModuleDependencies } from './runtime'
import { resolveModuleDependencies } from './dependencies'

export interface PrecomputedData {
  /** Pre-resolved dependencies for each module */
  dependencies: Record<string, ModuleDependencies>
  /** List of entry point module IDs */
  entrypoints: string[]
  /** Module metadata needed at runtime (file paths, etc.) */
  modules: Record<string, Pick<ResourceMeta, 'file' | 'resourceType' | 'mimeType' | 'module' | 'dynamicImports'>>
  /** Number of manifest entries, used to size runtime lookup tables. */
  resourceCount: number
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

  // Pre-compute dependencies, entry points, and the minimal module metadata
  // the runtime needs
  const entrypoints: string[] = []
  const modules: PrecomputedData['modules'] = {}
  let resourceCount = 0
  for (const moduleId in manifest) {
    resourceCount++
    resolveModuleDependencies(manifest, moduleId, dependencies)
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
    resourceCount,
  }
}
