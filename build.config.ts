import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  externals: [
    '@vue/server-renderer'
  ]
})
