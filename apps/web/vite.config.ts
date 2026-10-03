import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react(), { name: 'browser-boundary', generateBundle() {
  for (const id of this.getModuleIds()) {
    const path = id.replaceAll('\\', '/');
    if (path.includes('/apps/server/') || path.startsWith('node:') || path.includes('__vite-browser-external')) throw new Error('Server-only module in browser graph');
  }
} }], server: { port: 5173, strictPort: true,headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'},
  proxy: { '/api': { target: 'http://127.0.0.1:18081', changeOrigin: true }, '/healthz': { target: 'http://127.0.0.1:18081', changeOrigin: true } } },
  build: { target: 'es2022', sourcemap: false, manifest: true } });
