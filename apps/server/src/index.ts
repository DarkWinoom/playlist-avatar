import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const app = createApp(config);
const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
  console.log(JSON.stringify({ status: 'ready', port: config.port, version: '0.2.5' }));
});
function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10000); timeout.unref();
  server.close(() => process.exit(0));
  if('closeAllConnections'in server&&typeof server.closeAllConnections==='function')server.closeAllConnections();
}
process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
