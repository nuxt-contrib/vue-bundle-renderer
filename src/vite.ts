import type { Manifest as ViteManifest } from 'vite'
import type { Manifest } from './manifest'
import { parseResource } from './utils'

export const normalizeViteManifest = (manifest: ViteManifest | Manifest): Manifest => {
  const _manifest: Manifest = {}

  for (const file in manifest) {
    const chunk = manifest[file]
    _manifest[file] = { ...parseResource(chunk.file || file), ...chunk }
    for (const item of chunk.css || []) {
      if (!_manifest[item]) {
        _manifest[item] = { file: item, ...parseResource(item) }
      }
    }
    for (const item of chunk.assets || []) {
      if (!_manifest[item]) {
        _manifest[item] = { file: item, ...parseResource(item) }
      }
    }
  }

  return _manifest
}
