import type { Manifest } from 'vite'
import type { Identifier, OutputPath } from './renderer'
import { isJS, isCSS } from './utils'

// Vue2 Webpack client manifest format
export interface LegacyClientManifest {
  publicPath: string
  all: Array<OutputPath>
  initial: Array<OutputPath>
  async: Array<OutputPath>
  modules: Record<Identifier, Array<number>>
  hasNoCssVersion?: { [file: string]: boolean }
}

export function isLegacyClientManifest (clientManifest: Manifest | LegacyClientManifest): clientManifest is LegacyClientManifest {
  return 'all' in clientManifest && 'initial' in clientManifest
}

function getIdentifier (output: OutputPath): Identifier
function getIdentifier (output?: undefined): null
function getIdentifier (output?: OutputPath): null | Identifier {
  return output ? `_${output}` as Identifier : null
}

export function normalizeClientManifest (manifest: Manifest | LegacyClientManifest = {}): Manifest {
  if (!isLegacyClientManifest(manifest)) {
    return manifest
  }

  // Upgrade legacy manifest
  // https://github.com/nuxt-contrib/vue-bundle-renderer/issues/12
  const clientManifest: Manifest = {}

  // Initialize with all keys
  for (const outfile of manifest.all) {
    if (isJS(outfile)) {
      clientManifest[getIdentifier(outfile)] = {
        file: outfile
      }
    }
  }

  // Prepare first entrypoint to receive extra data
  const first = getIdentifier(manifest.initial.find(isJS)!)
  if (first) {
    if (!(first in clientManifest)) {
      throw new Error(
        `Invalid manifest - initial entrypoint not in \`all\`: ${manifest.initial.find(isJS)}`
      )
    }
    clientManifest[first].css = []
    clientManifest[first].assets = []
    clientManifest[first].dynamicImports = []
  }

  for (const outfile of manifest.initial) {
    if (isJS(outfile)) {
      clientManifest[getIdentifier(outfile)].isEntry = true
    } else if (isCSS(outfile) && first) {
      clientManifest[first].css!.push(outfile)
    } else if (first) {
      clientManifest[first].assets!.push(outfile)
    }
  }

  for (const outfile of manifest.async) {
    if (isJS(outfile)) {
      const identifier = getIdentifier(outfile)
      if (!(identifier in clientManifest)) {
        throw new Error(`Invalid manifest - async module not in \`all\`: ${outfile}`)
      }
      clientManifest[identifier].isDynamicEntry = true
      clientManifest[first].dynamicImports!.push(identifier)
    } else if (first) {
      // Add assets (CSS/JS) as dynamic imports to first entrypoints
      // as a workaround so can be prefetched.
      const key = isCSS(outfile) ? 'css' : 'assets'
      const identifier = getIdentifier(outfile)
      clientManifest[identifier] = {
        file: '' as OutputPath,
        [key]: [outfile]
      }
      clientManifest[first].dynamicImports!.push(identifier)
    }
  }

  // Map modules to virtual entries
  for (const [moduleId, importIndexes] of Object.entries(manifest.modules)) {
    const jsFiles = importIndexes.map(index => manifest.all[index]).filter(isJS)
    jsFiles.forEach((file) => {
      const identifier = getIdentifier(file)
      clientManifest[identifier] = {
        ...clientManifest[identifier],
        file
      }
    })

    const mappedIndexes = importIndexes.map(index => manifest.all[index])
    clientManifest[moduleId as Identifier] = {
      file: '' as OutputPath,
      imports: jsFiles.map(id => getIdentifier(id)),
      css: mappedIndexes.filter(isCSS),
      assets: mappedIndexes.filter(i => !isJS(i) && !isCSS(i))
    }
  }

  return clientManifest
}
