import { describe, expect, it } from 'vitest'

import { isLegacyClientManifest, normalizeClientManifest } from '../src/legacy'

import legacyManifest from './fixtures/legacy-manifest.json'

describe('legacy manifest', () => {
  it('should be detected as a legacy manifest', () => {
    expect(isLegacyClientManifest(legacyManifest)).to.equal(true)
  })

  it('should normalize manifest', () => {
    expect(normalizeClientManifest(legacyManifest)).to.deep.equal({
      '4d87aad8': {
        file: '',
        assets: [],
        css: [
          'app.css'
        ],
        imports: [
          '_app.js'
        ]
      },
      '56940b2e': {
        file: '',
        assets: [],
        css: [],
        imports: [
          '_pages/index.js'
        ]
      },
      '630f1d84': {
        file: '',
        assets: [],
        css: [
          'app.css'
        ],
        imports: [
          '_app.js'
        ]
      },
      _LICENSES: {
        file: 'LICENSES'
      },
      '_pages/another.css': {
        css: [
          'pages/another.css'
        ],
        file: ''
      },
      '_app.js': {
        file: 'app.js',
        isEntry: true
      },
      '_commons/app.js': {
        file: 'commons/app.js',
        isEntry: true
      },
      '_pages/another.js': {
        file: 'pages/another.js',
        isDynamicEntry: true
      },
      '_pages/index.js': {
        file: 'pages/index.js',
        isDynamicEntry: true
      },
      '_runtime.js': {
        assets: [],
        css: ['app.css'],
        dynamicImports: [
          '_pages/another.css',
          '_pages/another.js',
          '_pages/index.js'
        ],
        file: 'runtime.js',
        isEntry: true
      }
    })
  })
})
