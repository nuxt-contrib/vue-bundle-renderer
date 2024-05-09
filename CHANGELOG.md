# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## v2.1.0

[compare changes](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v2.0.0...v2.1.0)

### 🩹 Fixes

- Treat `.pcss` extension as a CSS extension ([#69](https://github.com/nuxt-contrib/vue-bundle-renderer/pull/69))
- Improve type safety of `ssrContext` and `createRenderer` ([#73](https://github.com/nuxt-contrib/vue-bundle-renderer/pull/73))

### 🏡 Chore

- Migrate to eslint v9 ([#74](https://github.com/nuxt-contrib/vue-bundle-renderer/pull/74))
- Remove explicit dev dependency on `expect-type` ([bc09fa9](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/bc09fa9))
- Add prepack step ([7ec1ec8](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/7ec1ec8))

### 🤖 CI

- Test against node v18 ([f080973](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/f080973))

### ❤️ Contributors

- Daniel Roe ([@danielroe](http://github.com/danielroe))
- Aman Desai ([@amandesai01](http://github.com/amandesai01))

## v2.0.0

[compare changes](https://undefined/undefined/compare/v1.0.3...v2.0.0)

### 🚀 Enhancements

- ⚠️  Add `preload` and `prefetch` attributes to manifest (#50)

### 🩹 Fixes

- Add crossorigin tag for script preload/prefetch (c05fe93)
- Don't hint to preload/prefetch styles loaded on page (#51)

### 🏡 Chore

- Update renovate config (b682845)
- Bump all dependencies (e9c6408)

### ✅ Tests

- Update tests (ad2e20e)

#### ⚠️  Breaking Changes

- ⚠️  Add `preload` and `prefetch` attributes to manifest (#50)

### ❤️  Contributors

- Daniel Roe <daniel@roe.dev>

## v1.0.3

[compare changes](https://undefined/undefined/compare/v1.0.2...v1.0.3)


### 🩹 Fixes

  - Eagerly initialise dependencies  cache (#47)
  - Only inject entry scripts as `<script>` (#46)

### 📦 Build

  - Reorder export conditions (d6c5b0c)

### 🏡 Chore

  - Switch to changelogen for releases (18c9675)
  - Update dependencies (69e6062)
  - Add prettierrc (2e606da)

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>

### [1.0.2](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v1.0.1...v1.0.2) (2023-02-16)

### [1.0.1](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v1.0.0...v1.0.1) (2023-02-08)

## [1.0.0](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.5.0...v1.0.0) (2022-11-16)

## [0.5.0](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.4.4...v0.5.0) (2022-11-03)


### ⚠ BREAKING CHANGES

* disable font prefetching by default (#43)

### Bug Fixes

* disable font prefetching by default ([#43](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/43)) ([12171a5](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/12171a5cfa23f4dfd4dec9c9d0c55b348d49f87c))

### [0.4.4](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.4.3...v0.4.4) (2022-10-18)

### [0.4.3](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.4.2...v0.4.3) (2022-09-15)


### Bug Fixes

* do not consider `.cjs` files as esm ([#38](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/38)) ([69e2433](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/69e2433c3ff349d55d7c1c24d74c7c5f18cb0b9e))

### [0.4.2](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.4.1...v0.4.2) (2022-08-12)


### Bug Fixes

* **webpack:** include css/assets at top level of manifest ([#36](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/36)) ([6cebc93](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/6cebc93eb7c0ce69e1f9a427a0756782d07676c9))

### [0.4.1](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.4.0...v0.4.1) (2022-08-08)


### Bug Fixes

* preload stylesheets used on the page ([#35](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/35)) ([643e2c2](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/643e2c25d4a7d297ad6663016ff500365023b4a4))

## [0.4.0](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.4.0-2...v0.4.0) (2022-08-04)

## [0.4.0-2](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.4.0-1...v0.4.0-2) (2022-08-04)


### Bug Fixes

* set resource type for css ([#34](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/34)) ([2016345](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/20163459c81879bd9ae7f9204aca817a4ea95b5f))

## [0.4.0-1](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.4.0-0...v0.4.0-1) (2022-08-03)


### ⚠ BREAKING CHANGES

* move resource parsing -> manifest stage and expose `/runtime` export (#33)

* move resource parsing -> manifest stage and expose `/runtime` export ([#33](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/33)) ([5dde2d1](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/5dde2d1999bbc37f71620cc1b8f1e091b3306f82))

## [0.4.0-0](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.9...v0.4.0-0) (2022-08-02)


### ⚠ BREAKING CHANGES

* rewrite with improvements (#30)

* rewrite with improvements ([#30](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/30)) ([dad6993](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/dad6993e0f0e19d979b5cae93d12417538e52bcc))

### [0.3.9](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.8...v0.3.9) (2022-06-10)


### Features

* expose function to update manifest ([#31](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/31)) ([c1c6d74](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/c1c6d74e4f20fd75743bb0882efdf47c137ac721))

### [0.3.8](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.7...v0.3.8) (2022-05-06)


### Features

* expose all types and utils ([cf0788f](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/cf0788f6b83a9127ebee4d1a0b284f77104e9633))

### [0.3.7](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.6...v0.3.7) (2022-04-22)


### Features

* render `crossorigin` anonymous for scripts and script/font preloads ([#27](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/27)) ([111f973](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/111f973c419fa29665eda011052b8a13d33986d1))

### [0.3.6](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.5...v0.3.6) (2022-04-19)


### Bug Fixes

* render modules with `async` and omit prefetch type ([#26](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/26)) ([a2d0f48](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/a2d0f484efa731901c63a37fbdf895c3de9e1204))

### [0.3.5](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.4...v0.3.5) (2022-01-11)


### Bug Fixes

* add missing `stylesheet` rel for prefetch tags ([#23](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/23)) ([d2ec8a3](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/d2ec8a3740e2532bc857284c536a1c0945e8099e))

### [0.3.4](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.3...v0.3.4) (2021-11-30)


### Bug Fixes

* include dynamic css (revert [#19](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/19)) ([#21](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/21)) ([b9317e8](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/b9317e8b05369161619d3b20372e883f32ae9390))

### [0.3.3](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.2...v0.3.3) (2021-11-22)


### Bug Fixes

* only prefetch dynamic entries ([#19](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/19)) ([bfebcbb](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/bfebcbbc09ee4fac3942f535654571d4e2698a86))

### [0.3.2](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.1...v0.3.2) (2021-10-13)


### Bug Fixes

* improve css regex for preprocessors ([#18](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/18)) ([bf80fb8](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/bf80fb877b5fe64ff2ce1005f45924ff08e8e593))

### [0.3.1](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.3.0...v0.3.1) (2021-09-09)


### Bug Fixes

* add meaningful errors to client manifest normalizer ([#17](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/17)) ([7782991](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/778299133ee58dfa5b87559cf0617f612446da7d))

## [0.3.0](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.10...v0.3.0) (2021-09-07)


### ⚠ BREAKING CHANGES

* rewrite to use new client manifest format (#15)

### Features

* rewrite to use new client manifest format ([#15](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/15)) ([38020b4](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/38020b4a626afb9d054299a833221bfd5f0daa1f))

### [0.2.10](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.9...v0.2.10) (2021-07-28)


### Bug Fixes

* restore space between `link` and `rel` ([#14](https://github.com/nuxt-contrib/vue-bundle-renderer/issues/14)) ([608c2e7](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/608c2e7673b1d11e6477c57e0f69311ab0610874))

### [0.2.9](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.8...v0.2.9) (2021-07-21)


### Bug Fixes

* fix <script src> formatting ([9b07254](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/9b07254eadbc7c1c3e9ffc7e28101935e908319a))

### [0.2.8](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.7...v0.2.8) (2021-07-21)


### Bug Fixes

* use modulepreload for preloading modules ([4c3afa3](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/4c3afa35565b4c11008f58903ad55e3516649515))

### [0.2.7](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.6...v0.2.7) (2021-07-21)


### Features

* handle `.mjs` as `type="module"` ([4bae1cc](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/4bae1ccd8a3e9ccc61a494976e11d00c519a9a73))

### [0.2.6](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.5...v0.2.6) (2021-07-21)


### Bug Fixes

* assume resources without extension as js ([5ebe828](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/5ebe82807852623b1e5bfc77684b314524614ea7))
* handle situation where there are no initial scripts ([3d55f4d](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/3d55f4d8cd859cf5d77ec40194c64510ac792096))

### [0.2.5](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.4...v0.2.5) (2021-07-12)


### Bug Fixes

* more mjs handling ([af2f761](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/af2f761595cef5b23e1288399a69ae20bcc3f12b))

### [0.2.4](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.3...v0.2.4) (2021-07-12)


### Features

* add exports map ([0f5e597](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/0f5e597bf745649e78104a67a6f6eb0501be957a))


### Bug Fixes

* support `.mjs` in isJS ([6347cfd](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/6347cfd2f05d8d7731683cbc21b92cc53d334ec9))

### [0.2.3](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.2...v0.2.3) (2021-01-22)


### Features

* support createApp as promise for lazy loading ([d5b82e7](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/d5b82e7ed62f25bb2ff6e3ba6a79469210882e93))

### [0.2.2](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.1...v0.2.2) (2020-11-01)


### Bug Fixes

* _registeredComponents should be a set ([40a711c](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/40a711c2d394b66c52164200215b105d2de0473b))

### [0.2.1](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.2.0...v0.2.1) (2020-10-29)

## [0.2.0](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.0.3...v0.2.0) (2020-10-29)


### Features

* `createRenderer` without Node dependency ([d41d6b0](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/d41d6b0939e174e74b494eb9e17b19c291eb961b))

## [0.1.0](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.0.3...v0.1.0) (2020-10-29)


### Features

* `createRenderer` without Node dependency ([d0f5218](https://github.com/nuxt-contrib/vue-bundle-renderer/commit/d0f5218da761c257fa5d2d205a21299304bc7060))

### [0.0.3](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.0.2...v0.0.3) (2020-04-29)

### [0.0.2](https://github.com/nuxt-contrib/vue-bundle-renderer/compare/v0.0.1...v0.0.2) (2020-04-29)

### 0.0.1 (2020-04-29)
