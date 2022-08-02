import { describe, expect, it } from 'vitest'

import { normalizeWebpackManifest } from '../src/webpack'

import webpackManifest from './fixtures/webpack-manifest.json'

describe('webpack manifest', () => {
  it('should normalize manifest', () => {
    expect(normalizeWebpackManifest(webpackManifest)).to.deep.equal({
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
        asType: 'script',
        file: 'app.js',
        isEntry: true,
        isModule: true
      },
      '_commons/app.js': {
        asType: 'script',
        file: 'commons/app.js',
        isEntry: true,
        isModule: true
      },
      '_pages/another.js': {
        asType: 'script',
        file: 'pages/another.js',
        isDynamicEntry: true,
        isModule: true
      },
      '_pages/index.js': {
        asType: 'script',
        file: 'pages/index.js',
        isDynamicEntry: true,
        isModule: true
      },
      '_runtime.js': {
        asType: 'script',
        assets: [],
        css: ['app.css'],
        dynamicImports: [
          '_pages/another.css',
          '_pages/another.js',
          '_pages/index.js'
        ],
        file: 'runtime.js',
        isEntry: true,
        isModule: true
      },
      'app.css': {
        asType: 'style',
        file: 'app.css'
      },
      'pages/another.css': {
        asType: 'style',
        file: 'pages/another.css'
      }
    })
  })
})
