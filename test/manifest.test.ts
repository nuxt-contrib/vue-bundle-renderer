import { describe, expect, it } from 'vitest'

import { normalizeWebpackManifest } from '../src/webpack'

import webpackManifest from './fixtures/webpack-manifest.json'

describe('webpack manifest', () => {
  it('should normalize manifest', () => {
    expect(normalizeWebpackManifest(webpackManifest)).toMatchInlineSnapshot(`
      {
        "4d87aad8": {
          "assets": [],
          "css": [
            "app.css",
          ],
          "file": "",
          "imports": [
            "_app.js",
          ],
          "prefetch": true,
        },
        "56940b2e": {
          "assets": [
            "img/logo.41f2f89.svg",
          ],
          "css": [
            "some.css",
          ],
          "file": "",
          "imports": [
            "_pages/index.js",
          ],
          "prefetch": true,
        },
        "630f1d84": {
          "assets": [],
          "css": [
            "app.css",
          ],
          "file": "",
          "imports": [
            "_app.js",
          ],
          "prefetch": true,
        },
        "_LICENSES": {
          "file": "LICENSES",
          "prefetch": true,
        },
        "_app.js": {
          "file": "app.js",
          "isEntry": true,
          "module": true,
          "prefetch": true,
          "preload": true,
          "resourceType": "script",
        },
        "_commons/app.js": {
          "file": "commons/app.js",
          "isEntry": true,
          "module": true,
          "prefetch": true,
          "preload": true,
          "resourceType": "script",
        },
        "_pages/another.css": {
          "css": [
            "pages/another.css",
          ],
          "file": "",
        },
        "_pages/another.js": {
          "file": "pages/another.js",
          "isDynamicEntry": true,
          "module": true,
          "prefetch": true,
          "preload": true,
          "resourceType": "script",
          "sideEffects": true,
        },
        "_pages/index.js": {
          "file": "pages/index.js",
          "isDynamicEntry": true,
          "module": true,
          "prefetch": true,
          "preload": true,
          "resourceType": "script",
          "sideEffects": true,
        },
        "_runtime.js": {
          "assets": [],
          "css": [
            "app.css",
          ],
          "dynamicImports": [
            "_pages/another.css",
            "_pages/another.js",
            "_pages/index.js",
          ],
          "file": "runtime.js",
          "isEntry": true,
          "module": true,
          "prefetch": true,
          "preload": true,
          "resourceType": "script",
        },
        "app.css": {
          "file": "app.css",
          "prefetch": true,
          "preload": true,
          "resourceType": "style",
        },
        "img/logo.41f2f89.svg": {
          "file": "img/logo.41f2f89.svg",
          "mimeType": "image/svg+xml",
          "prefetch": true,
          "resourceType": "image",
        },
        "pages/another.css": {
          "file": "pages/another.css",
          "prefetch": true,
          "preload": true,
          "resourceType": "style",
        },
        "some.css": {
          "file": "some.css",
          "prefetch": true,
          "preload": true,
          "resourceType": "style",
        },
      }
    `)
  })
})
