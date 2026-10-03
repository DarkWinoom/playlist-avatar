import {expect,it,vi} from 'vitest';
import {normalizeAsset} from './assets.ts';
import {prepareImport} from './prepare-import.ts';
import type {Candidate} from './import-playlist.ts';
vi.mock('./assets.ts',()=>({normalizeAsset:vi.fn()}));
it('keeps successful covers when another decode fails or crosses the batch budget',async()=>{
 const asset={id:'a',fingerprint:'a'.repeat(64),bytes:18*1024*1024,width:1,height:1,blob:new Blob(),thumbnail:new Blob(),colors:['#123456'],label:'A',createdAt:new Date().toISOString()};
 vi.mocked(normalizeAsset).mockResolvedValueOnce(asset).mockRejectedValueOnce(Error('bad image')).mockResolvedValueOnce({...asset,id:'b'});
 const candidates=[0,1,2].map(i=>({key:`candidate:${i}`,label:'A',order:i,status:'ready',blob:new Blob()})) as Candidate[];
 const result=await prepareImport(candidates,()=>false);expect(result.assets.map(a=>a.id)).toEqual(['a']);expect(result.skipped).toBe(2);
});
it('discards a late decode after the import was superseded',async()=>{
 let obsolete=false;vi.mocked(normalizeAsset).mockImplementationOnce(async()=>{obsolete=true;return{} as Awaited<ReturnType<typeof normalizeAsset>>;});
 await expect(prepareImport([{key:'a',label:'A',order:0,status:'ready',blob:new Blob()}] as Candidate[],()=>obsolete)).rejects.toThrow('CANCELLED');
});
