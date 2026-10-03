import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const cli = process.env.npm_execpath;
if (!cli || !/\.(?:m?js|cjs)$/.test(cli)) throw new Error('Run development with pnpm dev');
const children = [
  spawn(process.execPath, [cli, '--filter', '@playlist-avatar/server', 'dev'], { stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', PORT: '18081', PUBLIC_ORIGIN: 'http://127.0.0.1:18081', STATIC_DIR: resolve('apps/web/dist') } }),
  spawn(process.execPath, [cli, '--filter', '@playlist-avatar/web', 'dev'], { stdio: 'inherit', env: process.env }),
];
function stop() { for (const child of children) child.kill(); }
process.once('SIGINT', stop); process.once('SIGTERM', stop);
for (const child of children) child.once('exit', code => { stop(); process.exitCode = code || 0; });
