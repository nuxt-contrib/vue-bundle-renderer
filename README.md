# Vue Bundle Renderer

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Github Actions][github-actions-src]][github-actions-href]
<!-- [![Codecov][codecov-src]][codecov-href] -->

SSR Bundle Renderer for [Vue 3](https://vuejs.org/).

## Install

```sh
yarn add vue-bundle-renderer

npm install vue-bundle-renderer

pnpm add vue-bundle-renderer
```

## Usage

### `createRenderer`

```ts
import { createRenderer } from 'vue-bundle-renderer/runtime'

declare function createRenderer(createApp, renderOptions: RenderOptions)
```

### `normalizeViteManifest`

```ts
import { normalizeViteManifest } from 'vue-bundle-renderer'

declare function normalizeViteManifest(manifest: ViteManifest)
```

### `normalizeWebpackManifest`

```ts
import { normalizeWebpackManifest } from 'vue-bundle-renderer'

declare function normalizeWebpackManifest(manifest: ViteManifest)
```

## Credits

Based on [vue-server-renderer](https://npmx.dev/package/vue-server-renderer) made by [Evan You](https://github.com/yyx990803).

## License

MIT

<!-- Badges -->
[npm-version-src]: https://npmx.dev/api/registry/badge/version/vue-bundle-renderer
[npm-version-href]: https://npmx.dev/package/vue-bundle-renderer

[npm-downloads-src]: https://npmx.dev/api/registry/badge/downloads/vue-bundle-renderer
[npm-downloads-href]: https://npm.chart.dev/vue-bundle-renderer

[github-actions-src]: https://img.shields.io/github/actions/workflow/status/nuxt-contrib/vue-bundle-renderer/ci.yml?branch=main&style=flat-square
[github-actions-href]: https://github.com/nuxt-contrib/vue-bundle-renderer/actions/workflows/ci.yml

[codecov-src]: https://img.shields.io/codecov/c/gh/nuxt-contrib/vue-bundle-renderer/master?style=flat-square
[codecov-href]: https://codecov.io/gh/nuxt-contrib/vue-bundle-renderer
