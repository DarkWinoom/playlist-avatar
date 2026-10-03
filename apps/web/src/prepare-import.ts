import type { ArtworkAsset } from '@playlist-avatar/contracts';
import {LIMITS} from '@playlist-avatar/contracts';
import type {Candidate} from './import-playlist.ts';
import {normalizeAsset} from './assets.ts';
export async function prepareImport(candidates:Candidate[],obsolete:()=>boolean){
 const assets:ArtworkAsset[]=[];let bytes=0,skipped=0;
 for(const candidate of candidates.filter(value=>value.status==='ready').slice(0,LIMITS.selected)){
  if(obsolete())throw new Error('CANCELLED');
  try{const asset=await normalizeAsset(candidate.blob!,candidate.label,false,candidate.key);
   if(obsolete())throw new Error('CANCELLED');
   if(bytes+asset.bytes+asset.thumbnail.size>LIMITS.candidateBytes/2){skipped++;continue;}
   bytes+=asset.bytes+asset.thumbnail.size;assets.push({...asset,order:candidate.order,statistics:candidate.statistics});
  }catch(error){if(obsolete())throw new Error('CANCELLED');skipped++;}
 }
 return {assets,skipped};
}
