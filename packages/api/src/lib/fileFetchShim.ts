import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// @worldcoin/idkit-core initialises its WASM by fetching
// `new URL("idkit_wasm_bg.wasm", import.meta.url)` — a file:// URL that Node's
// undici fetch rejects. Install a shim BEFORE any route imports trigger a
// session request so IDKit can load its wasm from disk. Only `file:` URLs are
// intercepted; everything else passes through untouched.
let installed = false;

export function installFileFetchShim() {
  if (installed) return;
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : '';
    if (href.startsWith('file:')) {
      return new Response(await readFile(fileURLToPath(href)), {
        headers: { 'Content-Type': 'application/wasm' },
      });
    }
    return nativeFetch(input, init);
  };
  installed = true;
}