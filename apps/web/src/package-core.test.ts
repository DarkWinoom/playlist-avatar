import{expect,it}from'vitest';import{zipSync,strToU8,Zip,ZipDeflate}from'fflate';import{validPackagePath,readPackage}from'./package-core.ts';
it('accepts only content-addressed flat material paths',()=>{for(const path of['../manifest.json','/manifest.json','C:/x.png','assets/../../x.png','assets\\a.png','assets/%2e%2e/a.png'])expect(validPackagePath(path)).toBe(false);expect(validPackagePath('manifest.json')).toBe(true);expect(validPackagePath(`assets/${'a'.repeat(64)}.png`)).toBe(true);});
it('rejects traversal, duplicate/missing structure and oversized inflation before commit',async()=>{
 await expect(readPackage(new Blob([zipSync({'../bad':strToU8('bad')})]))).rejects.toThrow();
 await expect(readPackage(new Blob([zipSync({'manifest.json':strToU8('{}')})]))).rejects.toThrow();
 await expect(readPackage(new Blob([zipSync({'manifest.json':new Uint8Array(1048577)})]))).rejects.toThrow('RESPONSE_TOO_LARGE');
});
it('preserves the size error when a streaming inflater re-enters its callback',async()=>{
 const chunks:Uint8Array<ArrayBuffer>[]=[];const zip=new Zip((error,chunk)=>{if(error)throw error;chunks.push(new Uint8Array(chunk));});
 const entry=new ZipDeflate('manifest.json');zip.add(entry);entry.push(new Uint8Array(1048577),true);zip.end();
 await expect(readPackage(new Blob(chunks))).rejects.toThrow('RESPONSE_TOO_LARGE');
});
