import { ProjectSchema, RecipeSchema } from '@playlist-avatar/contracts';
import type { Project } from '@playlist-avatar/contracts';
export function migrateProject(value:unknown): { project:Project; migrated:boolean } {
  if(!value||typeof value!=='object')throw new Error('INVALID_PACKAGE');const raw=value as Record<string,unknown>;
  if(raw.version===1)return {project:ProjectSchema.parse(raw),migrated:false};
  if(raw.version!==0||!raw.recipe||typeof raw.recipe!=='object')throw new Error('INVALID_PACKAGE');
  const old=raw.recipe as Record<string,unknown>,recipe=RecipeSchema.parse({...old,version:1,templateVersion:1,
    parameters:old.parameters||{},paletteLocked:old.paletteLocked===true,title:typeof old.title==='string'?old.title:'',titleEnabled:old.titleEnabled===true,materialPhase:typeof old.materialPhase==='number'?old.materialPhase:.35});
  const project=ProjectSchema.parse({...raw,version:1,id:`${String(raw.id).slice(0,480)}:v1`,recipe});return {project,migrated:true};
}
