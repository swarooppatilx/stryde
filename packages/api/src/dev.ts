import { serve } from '@hono/node-server';
import app from './index.js';

const port = Number(process.env.PORT) || 3000;

// Keep Node's own Request/Response: @hono/node-server's subclasses make @worldcoin/idkit-core's WASM HTTP client fail every request.
serve({ fetch: app.fetch, port, overrideGlobalObjects: false }, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
