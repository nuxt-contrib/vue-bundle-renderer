import { bench, describe } from 'vitest'
import { isJS, isCSS, getAsType, parseResource } from '../src/utils'
import { extname } from 'node:path'

// Sample file names for testing
const jsFiles = [
  'app.js',
  'vendor.mjs',
  'chunk.cjs',
  'module.js?v=123',
  'script',
]

const cssFiles = [
  'main.css',
  'components.scss',
  'styles.less',
  'theme.stylus',
  'layout.css?v=456',
]

const assetFiles = [
  'logo.svg',
  'banner.jpg',
  'icon.png',
  'font.woff2',
  'video.mp4',
  'audio.mp3',
  'document.pdf',
]

const mixedFiles = [...jsFiles, ...cssFiles, ...assetFiles]

describe('File Type Detection Benchmarks', () => {
  bench('isJS detection on JS files', () => {
    for (const file of jsFiles) {
      isJS(file)
    }
  })

  bench('isJS detection on mixed files', () => {
    for (const file of mixedFiles) {
      isJS(file)
    }
  })

  bench('isCSS detection on CSS files', () => {
    for (const file of cssFiles) {
      isCSS(file)
    }
  })

  bench('isCSS detection on mixed files', () => {
    for (const file of mixedFiles) {
      isCSS(file)
    }
  })
})

describe('Asset Type Detection Benchmarks', () => {
  bench('getAsType on mixed files', () => {
    for (const file of mixedFiles) {
      const base = file.split('?', 1)[0]
      const ext = extname(base).slice(1)
      getAsType(ext)
    }
  })

  bench('getAsType on JS extensions', () => {
    const extensions = ['js', 'mjs', 'cjs']
    for (const ext of extensions) {
      getAsType(ext)
    }
  })

  bench('getAsType on CSS extensions', () => {
    const extensions = ['css', 'scss', 'less', 'stylus']
    for (const ext of extensions) {
      getAsType(ext)
    }
  })
})

describe('Resource Parsing Benchmarks', () => {
  bench('parseResource on JS files', () => {
    for (const file of jsFiles) {
      parseResource(file)
    }
  })

  bench('parseResource on CSS files', () => {
    for (const file of cssFiles) {
      parseResource(file)
    }
  })

  bench('parseResource on asset files', () => {
    for (const file of assetFiles) {
      parseResource(file)
    }
  })

  bench('parseResource on mixed files', () => {
    for (const file of mixedFiles) {
      parseResource(file)
    }
  })

  bench('parseResource on mixed files (1000 iterations)', () => {
    for (let i = 0; i < 1000; i++) {
      for (const file of mixedFiles) {
        parseResource(file)
      }
    }
  })
})

// Test with dynamically generated file names
describe('Dynamic File Generation Benchmarks', () => {
  bench('parseResource on generated JS files', () => {
    for (let i = 0; i < 100; i++) {
      parseResource(`chunk-${i}.js`)
      parseResource(`module-${i}.mjs`)
      parseResource(`bundle-${i}.cjs`)
    }
  })

  bench('parseResource on generated CSS files', () => {
    for (let i = 0; i < 100; i++) {
      parseResource(`styles-${i}.css`)
      parseResource(`theme-${i}.scss`)
      parseResource(`layout-${i}.less`)
    }
  })

  bench('parseResource on generated assets', () => {
    for (let i = 0; i < 100; i++) {
      parseResource(`image-${i}.png`)
      parseResource(`icon-${i}.svg`)
      parseResource(`font-${i}.woff2`)
    }
  })
})
