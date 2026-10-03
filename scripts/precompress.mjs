import {readdir,readFile,writeFile} from 'node:fs/promises';import {join,resolve} from 'node:path';import {gzipSync} from 'node:zlib';
const root=resolve(import.meta.dirname,'../apps/web/dist');let count=0;
async function visit(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await visit(path);else if(/\.(?:js|css)$/.test(entry.name)){await writeFile(path+'.gz',gzipSync(await readFile(path),{level:9}));count++;}}}
await visit(root);console.log(`Precompressed web assets: ${count}`);
