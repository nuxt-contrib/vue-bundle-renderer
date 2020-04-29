import NativeModule from 'module'
import typescript from '@rollup/plugin-typescript'

export default [
  {
    input: './src/index.ts',
    external: [
      ...NativeModule.builtinModules,
      'source-map'
    ],
    output: [
      { file: './dist/vue-bundle-renderer.cjs.js', format: 'cjs' },
      { file: './dist/vue-bundle-renderer.esm.js', format: 'esm' }
    ],
    plugins: [
      typescript()
    ]
  }
]
