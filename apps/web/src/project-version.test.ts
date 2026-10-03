import { expect,it } from 'vitest';
import { migrateProject } from './project-version.ts';
import { freshRecipe } from './editor-store.ts';
it('migrates a documented synthetic v0 by copy and keeps its raw record intact',()=>{
 const raw={version:0,id:'old',name:'旧作品',createdAt:'2026-10-03T00:00:00.000Z',updatedAt:'2026-10-03T00:00:00.000Z',recipe:{...freshRecipe(),version:0,materialPhase:undefined}};
 const migrated=migrateProject(raw);expect(migrated.project.id).toBe('old:v1');expect(migrated.project.recipe.materialPhase).toBe(.35);expect(raw.version).toBe(0);expect(raw.recipe.version).toBe(0);
 expect(()=>migrateProject({...raw,version:99})).toThrow('INVALID_PACKAGE');
});
