# Dependabot alert triage

Snapshot: 176 open alerts (163 on `yarn.lock`, 12 on `apps/web/package.json`, 1 on `packages/mcp/package.json`), taken 6 Nov 2026.
Expected to close once this branch reaches `main`: about 157. About 19 remain (listed below). The count was computed by matching every alert's vulnerable range against the versions in the new `yarn.lock`.
The release-age gate (`npmMinimalAgeGate`, 1 day) was left as is, and every patched version passed it.

## Fixed

| Package | Severity (max) | Action | Alerts closed |
|---|---|---|---|
| next | critical | `apps/web` bumped to 16.4.1 | 22 |
| maplibre-gl | critical | `apps/web` bumped to 6.4.1 | 2 |
| undici | high | resolutions: 7.x to 7.30.1 (graph-cli pin and expo-server-sdk), 8.x to 8.12.2 (node-gyp) | 40 |
| axios | high | resolution `^0.21.4` to 0.33.0 (apisauce, used by graph-cli tooling) | 23 |
| @xmldom/xmldom | high | resolution `~0.7.0` to 0.8.15 (`@expo/plist` 0.0.18 via the iOS-only `@bacons/xcode`); the other copies were already patched | 15 |
| node-forge | high | resolution to 1.4.1 (`@expo/cli`) | 12 |
| brace-expansion | high | resolutions to 1.1.21, 2.1.7 and 5.0.12 | 9 |
| fast-uri | medium | resolution to 3.1.9 (ajv) | 5 |
| js-yaml | high | resolution of the graph-cli pin 4.1.0 to 4.3.2 | 5 |
| vite | medium (dev) | root devDependency bumped to ^6.4.4 | 5 |
| immutable | high | resolution of the graph-cli pin to 5.1.8 | 3 |
| follow-redirects | high | resolution to 1.16.2 | 3 |
| @vitest/mocker | medium | resolution of the vitest pin to 5.0.3 | 2 |
| hono | medium | `packages/api` bumped to ^4.13.16 | 1 |
| @hono/node-server | medium | `packages/api` bumped from ^1.14.1 to ^2.1.6 (major) | 1 |
| shell-quote | critical | resolution to 1.11.0 (react-devtools-core) | 1 |
| sharp | high | resolution to 0.35.5 (next) | 1 |
| source-map-js | high (dev) | resolution to 1.2.2 | 1 |
| compression | high | resolution to 1.8.2 (`@expo/cli`) | 1 |
| yaml | medium | resolution of the graph-cli pin to 2.8.3 | 1 |
| cross-spawn | high | resolution of the gluegun pin to 7.0.6 | 1 |
| ejs | medium | resolution of the gluegun pin to 3.1.10 | 1 |
| semver | high | resolution of the gluegun pin to 7.8.5 | 1 |
| glob | high | resolution of 11.0.3 to 11.1.0 | 1 |

Other changes: `packages/mcp` moved from zod ^3.25 to ^4.6.7. This removes mcp's own use of 3.x, but the zod 3.25.76 copy stays in the tree through privy, web3-validator and `@expo/cli`, so the zod alerts remain.

## Left open

| Package | Severity | Reason |
|---|---|---|
| decompress (4 alerts) | critical | No patched version exists. |
| deepmerge (1) | low | No patched version exists. |
| zod 3.25.76 (2) | high | The only fix is 4.6.6 or later. The remaining 3.x copies come from privy, web3-validator and `@expo/cli`, which require ^3. |
| stream-json 1.9.1 (3) | medium | Needs 3.6.0, a major bump. jayson pins ^1.9.1. |
| image-size 1.2.1 (2) | high | Needs 2.0.3, a major bump. metro (React Native toolchain) requires ^1; we do not move RN packages. |
| decode-uri-component 0.2.2 (2) | high | Needs 0.5.x. `query-string` and `source-map-resolve` require ^0.2. |
| glob 10.5.0 and 13.0.6 (1) | medium | Needs 14.0.2, a major bump of the `@expo/cli` and `@bacons/apple-targets` dependency. |
| minimatch (1) | medium | Needs 11.0.1, a major bump. Dependents are on 3, 5, 9 and 10. |
| uuid 7.0.3 and 8.3.2 (1) | medium | Fixed only in 11.x, a major bump. Used by xcode, jayson and `@bacons/xcode`. |
| micromatch 3.1.10 (1) | medium | Legacy 3.x line, pulled in by older tooling; the fix is a major bump. |
| braces 2.3.2 (1) | high | Same legacy chain as micromatch 3. |

Several left-open packages are build tooling that never ships in the app or API bundle (graph-cli, Expo CLI, metro, iOS plugins). Alerts are counted against `main`, so the numbers above only apply after merge.

## Not verified

Not possible here: the Android Gradle build and a device run. The `expo config --type public` and `expo prebuild --platform android --no-install` steps passed.
The resolutions that cross 0.x minor lines (axios 0.33.0 and xmldom 0.8.15) are used only by the Subgraph CLI and by iOS-only plugins. They have not been exercised beyond install and prebuild.
