import { RenderOptions, createRenderer } from './renderer'

type BundleRenderOptions = {
  runInNewContext?: boolean | 'once',
  basedir?: string,
  renderToString: typeof import('@vue/server-renderer').renderToString,
  bundleRunner: typeof import('bundle-runner')
} & RenderOptions

export function createBundleRenderer (_bundle: any, renderOptions: BundleRenderOptions) {
  const { evaluateEntry, rewriteErrorTrace } = renderOptions.bundleRunner.createBundle(_bundle, renderOptions)

  async function createApp (ssrContext: Object, evalContext: Object) {
    try {
      const entry = await evaluateEntry(evalContext)
      const app = await entry(ssrContext)
      return app
    } catch (err: any) {
      rewriteErrorTrace(err)
      throw err
    }
  }

  return createRenderer(createApp, renderOptions)
}
