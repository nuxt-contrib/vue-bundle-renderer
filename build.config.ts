import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  externals: [
    'vite',
    '@vue/server-renderer'
  ]
})
