import { createBundle, Bundle } from 'bundle-runner'
import { createRenderContext, renderResourceHints, renderStyles, renderScripts, RenderOptions, SSRContext } from './renderer'

type BundleRenderOptions = {
  runInNewContext: boolean | 'once',
  basedir: string,
  vueServerRenderer: {
    renderToString: Function
  }
} & RenderOptions

export function createBundleRenderer (_bundle: Bundle, renderOptions: BundleRenderOptions) {
  const renderContext = createRenderContext(renderOptions)

  const { evaluateEntry, rewriteErrorTrace } = createBundle(_bundle, renderOptions)

  async function runApp (ssrContext: Object, evalContext: Object) {
    try {
      const entry = await evaluateEntry(evalContext)
      const app = await entry(ssrContext)
      return app
    } catch (err) {
      rewriteErrorTrace(err)
      throw err
    }
  }

  return {
    async renderToString (ssrContext: SSRContext, evalContext: Object) {
      try {
        ssrContext._registeredComponents = []

        const app = await runApp(ssrContext, evalContext)
        const html = await renderOptions.vueServerRenderer.renderToString(app, ssrContext)

        ssrContext.renderResourceHints = () => renderResourceHints(ssrContext, renderContext)
        ssrContext.renderStyles = () => renderStyles(ssrContext, renderContext)
        ssrContext.renderScripts = () => renderScripts(ssrContext, renderContext)

        return html
      } catch (err) {
        await rewriteErrorTrace(err)
        throw err
      }
    }
  }
}
