import { posix } from 'node:path'
import { createRenderer, renderResourceHeaders, renderResourceHints, renderScripts, renderStyles } from '../src/runtime'
import type { RendererContext, SSRContext } from '../src/runtime'
import type { Manifest } from '../src/types'
import type { PrecomputedData } from '../src/precompute'
import { sink } from './_harness'

interface RendererOptions {
  manifest?: Manifest
  precomputed?: PrecomputedData
  buildAssetsURL?: (id: string) => string
  dependencySetsCacheSize?: number
}

const renderToString = () => '<div>test</div>'

export function makeContext(options: RendererOptions): RendererContext {
  return createRenderer(() => ({}), { renderToString, ...options }).rendererContext
}

// Fresh ssrContext per call so the per-request memo does not carry over.
export function fullRequest(modules: Set<string>, ctx: RendererContext) {
  const ssrContext: SSRContext = { modules }
  sink(renderStyles(ssrContext, ctx))
  sink(renderScripts(ssrContext, ctx))
  sink(renderResourceHints(ssrContext, ctx))
  sink(renderResourceHeaders(ssrContext, ctx))
}

export function warm(pool: Set<string>[], ctx: RendererContext) {
  for (const modules of pool) fullRequest(modules, ctx)
}

// Does real string work per asset, unlike the near-free default.
const requestPath = '/some/nested/route/'
export const relativeBuildAssetsURL = (id: string) =>
  posix.relative(posix.dirname(requestPath), `/_nuxt/${id}`) || `./${id}`

export const SET_SIZES = [1, 10, 50, 200] as const
export const POOL_SIZE = 64
