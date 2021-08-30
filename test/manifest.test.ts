import { expect } from 'chai'

import { isLegacyClientManifest, normalizeClientManifest } from '../src/renderer'

import legacyManifest from './fixtures/legacy-manifest.json'

describe('legacy manifest', () => {
  it('should be detected as a legacy manifest', () => {
    expect(isLegacyClientManifest(legacyManifest)).to.equal(true)
  })

  it('should normalize manifest', () => {
    expect(normalizeClientManifest(legacyManifest)).to.deep.equal({
      '4d87aad8': {
        file: '',
        imports: [
          'app.css',
          'app.js'
        ]
      },
      '56940b2e': {
        file: '',
        imports: [
          'pages/index.js'
        ]
      },
      '630f1d84': {
        file: '',
        imports: [
          'app.css',
          'app.js'
        ]
      },
      LICENSES: {
        file: 'LICENSES'
      },
      'css:pages/another.css': {
        css: [
          'pages/another.css'
        ],
        file: ''
      },
      'app.js': {
        file: 'app.js',
        isEntry: true
      },
      'commons/app.js': {
        file: 'commons/app.js',
        isEntry: true
      },
      'pages/another.js': {
        file: 'pages/another.js',
        isDynamicEntry: true
      },
      'pages/index.js': {
        file: 'pages/index.js',
        isDynamicEntry: true
      },
      'runtime.js': {
        assets: [],
        css: ['app.css'],
        dynamicImports: ['css:pages/another.css'],
        file: 'runtime.js',
        isEntry: true
      }
    })
  })
})
