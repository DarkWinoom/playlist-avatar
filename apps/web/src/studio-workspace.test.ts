import{beforeEach,expect,it}from'vitest';
import{ProjectSchema,projectAssets,recipeAssets,WorkspaceSchema}from'@playlist-avatar/contracts';
import type{ArtworkAsset,SourceSnapshot}from'@playlist-avatar/contracts';
import{freshRecipe,studioRecipe,useEditor}from'./editor-store.ts';
import{geometry}from'@playlist-avatar/artwork';
import{workspaceFor}from'./studio-workspace.ts';
import{collectionIdentity,mergeCollection}from'./collections.ts';
import{remapProjectAssets}from'./recipe-references.ts';
const asset=(id:string):ArtworkAsset=>({id,fingerprint:'a'.repeat(64),bytes:1,blob:new Blob(['x']),thumbnail:new Blob(['x']),width:512,height:512,colors:['#123456'],label:id,createdAt:'2026-10-06T00:00:00.000Z'});
beforeEach(()=>{const recipe=studioRecipe([],'mosaic');useEditor.getState().load(recipe,[],undefined,workspaceFor(recipe,recipe));});
it('keeps pending assets out of recipes and stores each template without losing images',()=>{
  const editor=useEditor.getState();editor.accept([asset('a')]);expect(recipeAssets(useEditor.getState().recipe)).toEqual([]);editor.assign('a','slot:0');editor.parameter('gap',9);editor.template('bloom');editor.parameter('petals',11);editor.template('mosaic');const state=useEditor.getState();expect(state.recipe.slotImages).toEqual({'slot:0':'a'});expect(state.recipe.parameters.mosaic?.gap).toBe(9);editor.template('bloom');expect(useEditor.getState().recipe.parameters.bloom?.petals).toBe(11);
});
it('round trips draft variants and restores defaults after a new creation',()=>{
  const editor=useEditor.getState();editor.accept([asset('a')]);editor.assign('a','slot:0');editor.template('duo');editor.assign('a','slot:1');const state=useEditor.getState(),project=ProjectSchema.parse({version:1,id:'draft',name:'Draft',createdAt:asset('a').createdAt,updatedAt:asset('a').createdAt,recipe:state.recipe,workspace:state.workspace});expect(projectAssets(project)).toEqual(['a']);editor.load(project.recipe,[asset('a')],undefined,project.workspace);editor.template('mosaic');editor.restoreSlot('slot:0');expect(useEditor.getState().recipe.slotImages).toEqual({});editor.undo();expect(useEditor.getState().recipe.slotImages?.['slot:0']).toBe('a');
});
it('preserves a legacy recipe until editing and restores its original image and framing',()=>{
  const original={...freshRecipe(['a','b']),palette:['#123456'],title:'Original',titleEnabled:true,imageFrames:{b:{x:.2,y:-.1,zoom:1.3}},parameters:{mosaic:{layout:2,gap:5,radius:4}}},editor=useEditor.getState();editor.load(original,[asset('a'),asset('b')],undefined,workspaceFor(original,original,'project:original'));expect(useEditor.getState().recipe.palette).toEqual(original.palette);expect(useEditor.getState().recipe.title).toBe('Original');editor.accept([asset('c')]);editor.assign('c',geometry(useEditor.getState().recipe)[1]!.id);editor.restoreSlot('slot:1');expect(useEditor.getState().recipe.slotImages?.['slot:1']).toBe('b');expect(useEditor.getState().recipe.imageFrames?.['slot:1']).toEqual(original.imageFrames.b);
});
it('does not exceed the fifty-image budget through dormant variants or restore origins',()=>{
  const a={...studioRecipe([],'mosaic'),materialIds:Array.from({length:50},(_,i)=>`a:${i}`)},b={...studioRecipe([],'duo'),materialIds:['b:0']},workspace=WorkspaceSchema.parse({version:1,flow:'quick',variants:{duo:b},origins:{mosaic:a}});expect(ProjectSchema.safeParse({version:1,id:'draft',name:'Draft',createdAt:asset('a').createdAt,updatedAt:asset('a').createdAt,recipe:a,workspace}).success).toBe(false);
});
it('remaps package references across both the visible recipe and editing state',()=>{
  const recipe={...studioRecipe([],'mosaic'),slotImages:{'slot:0':'a'},materialIds:['a']},workspace=workspaceFor(recipe,recipe,'project:old'),project={version:1 as const,id:'project:test',name:'Test',createdAt:asset('a').createdAt,updatedAt:asset('a').createdAt,recipe,workspace};const mapped=remapProjectAssets(project,new Map([['a','new:a']]));expect(projectAssets(mapped)).toEqual(['new:a']);expect(mapped.workspace?.origins.mosaic?.slotImages?.['slot:0']).toBe('new:a');expect(mapped.workspace?.editingId).toBeUndefined();expect(()=>remapProjectAssets(project,new Map())).toThrow('INVALID_PACKAGE');
});
it('groups repeated playlist batches while preserving connection, kind and period boundaries',()=>{
  const base={source:'lastfm',connectionId:'profile:a',collectionId:'same',kind:'top-albums',period:'1month',title:'Albums',key:'fixture',fetchedAt:asset('a').createdAt,coverage:{received:2,complete:true,warnings:[]},warnings:[]} as unknown as SourceSnapshot;
  const first=mergeCollection(undefined,['a','b'],base),second=mergeCollection(first,['b','c'],base);expect(second.ids).toEqual(['a','b','c']);expect(collectionIdentity(base)).not.toBe(collectionIdentity({...base,connectionId:'profile:b'}));expect(collectionIdentity(base)).not.toBe(collectionIdentity({...base,period:'7day'}));expect(collectionIdentity(base)).not.toBe(collectionIdentity({...base,kind:'recent-albums'}));expect(mergeCollection(undefined,['a','a'])).toMatchObject({id:'uploads',kind:'upload',ids:['a']});
});
it('keeps saved-copy identity through undo and redo instead of returning to its parent',()=>{
  const editor=useEditor.getState();editor.accept([asset('a')]);editor.assign('a','slot:0');editor.identify('project:copy');expect(useEditor.getState().workspace?.editingId).toBe('project:copy');editor.undo();expect(useEditor.getState().workspace?.editingId).toBe('project:copy');editor.redo();expect(useEditor.getState().workspace?.editingId).toBe('project:copy');
});
it('establishes recoverable identity for a legacy load that had no workspace field',()=>{
  const editor=useEditor.getState(),recipe=freshRecipe(['a']);editor.load(recipe,[asset('a')]);expect(useEditor.getState().workspace).toBeUndefined();editor.identify('project:legacy-copy');const state=useEditor.getState();expect(state.workspace?.editingId).toBe('project:legacy-copy');expect(state.workspace?.origins.mosaic?.assetIds).toEqual(['a']);expect(state.recipe.title).toBe(recipe.title);
});
