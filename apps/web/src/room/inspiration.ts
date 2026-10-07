import { CATALOG } from '@playlist-avatar/artwork';
import type { TemplateId } from '@playlist-avatar/contracts';
export const HERO_COVERS:[TemplateId,string,string][]=[['bloom','花开的声音','Blooming sound'],['disc','唱片时间','Record time'],['mosaic','夏日拼贴','Summer mixtape'],['waves','山海回声','Mountain echoes'],['wall','小小唱片架','Little record shelf'],['type','写给耳朵','Made to be heard'],['orbit','星轨留声','Orbiting sound'],['duo','双面旋律','Two-sided melody']];
export const INSPIRATION:[TemplateId,string,string][]= [...HERO_COVERS,...CATALOG.filter(item=>!HERO_COVERS.some(([id])=>id===item.id)).map(item=>[item.id,item.zh,item.en]as[TemplateId,string,string])];
