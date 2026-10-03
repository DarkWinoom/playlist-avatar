import {createRequire} from 'node:module';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
const base=resolve(import.meta.dirname,'..'),found=new Map(),missing=[];
async function manifest(directory){return JSON.parse(await readFile(join(directory,'package.json'),'utf8'));}
async function locate(name,parent){let directory=dirname(createRequire(join(parent,'package.json')).resolve(name));while(true){try{const value=await manifest(directory);if(value.name===name)return {directory,value};}catch{}const next=dirname(directory);if(next===directory)throw Error(`Package manifest unavailable: ${name}`);directory=next;}}
async function collect(name,parent,optional=false){if(name.startsWith('@playlist-avatar/'))return;let item;try{item=await locate(name,parent);}catch(error){if(optional)return;throw error;}const key=`${item.value.name}@${item.value.version}`;if(found.has(key))return;
 const names=(await readdir(item.directory)).filter(name=>/^(?:licen[cs]e|copying)(?:\.[\w-]+)?$/i.test(name));
 const texts=[];for(const name of names.sort())texts.push(await readFile(join(item.directory,name),'utf8'));
 if(!texts.length){try{texts.push(await readFile(join(base,'docs','licenses',key.replace(/[^\w.-]/g,'_')+'.txt'),'utf8'));}catch{missing.push({name:key,license:item.value.license,repository:item.value.repository});}}
 found.set(key,{license:item.value.license,text:texts.join('\n\n')});
 for(const dependency of Object.keys(item.value.dependencies||{}))await collect(dependency,item.directory);
 for(const dependency of Object.keys(item.value.optionalDependencies||{}))await collect(dependency,item.directory,true);
 for(const dependency of Object.keys(item.value.peerDependencies||{}))await collect(dependency,item.directory,true);
}
for(const app of ['web','server']){const directory=join(base,'apps',app),value=await manifest(directory);for(const name of Object.keys(value.dependencies||{}))await collect(name,directory);}
if(missing.length){console.error(JSON.stringify({missing},null,2));process.exit(1);}
const output=['Playlist Avatar runtime dependency license texts','Generated from the installed pinned dependency graph. Project-owned code has no selected public license. Node and Debian base image notices remain in their official image.'];
for(const [name,value] of [...found].sort(([a],[b])=>a.localeCompare(b,'en')))output.push(`\n${'='.repeat(72)}\n${name} (${typeof value.license==='string'?value.license:JSON.stringify(value.license)})\n${'='.repeat(72)}\n\n${value.text.trim()}\n`);
await mkdir(join(base,'docs'),{recursive:true});await writeFile(join(base,'docs','THIRD_PARTY_LICENSES.txt'),output.join('\n')+'\n');console.log(`Runtime license texts: ${found.size} packages`);
