import{expect,it}from'vitest';import{zipSync,strToU8}from'fflate';import{validPackagePath,readPackage}from'./package-core.ts';
it('accepts only content-addressed flat material paths',()=>{for(const path of['../manifest.json','/manifest.json','C:/x.png','assets/../../x.png','assets\\a.png','assets/%2e%2e/a.png'])expect(validPackagePath(path)).toBe(false);expect(validPackagePath('manifest.json')).toBe(true);expect(validPackagePath(`assets/${'a'.repeat(64)}.png`)).toBe(true);});
it('rejects traversal, duplicate/missing structure and oversized inflation before commit',async()=>{
 await expect(readPackage(new Blob([zipSync({'../bad':strToU8('bad')})]))).rejects.toThrow();
 await expect(readPackage(new Blob([zipSync({'manifest.json':strToU8('{}')})]))).rejects.toThrow();
 await expect(readPackage(new Blob([zipSync({'manifest.json':new Uint8Array(1048577)})]))).rejects.toThrow('RESPONSE_TOO_LARGE');
});
