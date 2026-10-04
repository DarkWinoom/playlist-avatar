import{beforeEach,expect,it}from'vitest';
import{studioRecipe,studioFrom,freshRecipe,useEditor,DEFAULT_PALETTE}from'./editor-store.ts';
import{RecipeSchema,recipeAssets,slotAsset,SLOT_IDS}from'@playlist-avatar/contracts';
import type{ArtworkAsset}from'@playlist-avatar/contracts';
import{geometry}from'@playlist-avatar/artwork';
import{remapRecipeAssets}from'./recipe-references.ts';
const asset=(id:string):ArtworkAsset=>({id,fingerprint:id.repeat(64),blob:new Blob(['x']),thumbnail:new Blob(['x']),bytes:1,width:512,height:512,colors:['#123456'],createdAt:new Date().toISOString(),label:id});
beforeEach(()=>useEditor.getState().load(studioRecipe([], 'mosaic'),[]));
it('keeps canvas geometry unchanged for zero, one and many chosen pictures',()=>{
 const editor=useEditor.getState(),initial=geometry(editor.recipe);expect(initial).toHaveLength(4);expect(recipeAssets(editor.recipe)).toEqual([]);
 editor.choose([asset('a')]);expect(geometry(useEditor.getState().recipe)).toEqual(initial);
 editor.choose(['a','b','c'].map(asset));expect(geometry(useEditor.getState().recipe)).toEqual(initial);
 editor.choose([]);expect(geometry(useEditor.getState().recipe)).toEqual(initial);
});
it('places one picture into two slots without swapping, and undo preserves replaced pictures',()=>{
 const editor=useEditor.getState();editor.choose([asset('a'),asset('b')]);editor.assign('a','slot:0');editor.assign('a','slot:1');editor.frame('slot:0',{x:.2,y:0,zoom:1.5});editor.assign('b','slot:1');
 let state=useEditor.getState();expect(state.recipe.slotImages).toEqual({'slot:0':'a','slot:1':'b'});expect(state.recipe.imageFrames?.['slot:0']?.zoom).toBe(1.5);
 editor.choose([asset('b')]);expect(useEditor.getState().recipe.slotImages).toEqual({'slot:1':'b'});editor.undo();state=useEditor.getState();expect(state.recipe.slotImages?.['slot:0']).toBe('a');expect(state.assets.a).toBeDefined();
});
it('keeps no-photo style and palette when choosing images and refuses canvas placement',()=>{
 const editor=useEditor.getState();editor.template('bloom');const palette=useEditor.getState().recipe.palette;editor.choose([asset('a')]);editor.assign('a','slot:0');expect(useEditor.getState().recipe.template).toBe('bloom');expect(useEditor.getState().recipe.palette).toEqual(palette);expect(geometry(useEditor.getState().recipe)).toEqual([]);expect(useEditor.getState().recipe.slotImages).toEqual({});
});
it('resets visible and legacy appearance parameters without deleting chosen images or bindings',()=>{
 const editor=useEditor.getState();editor.choose([asset('a')]);editor.assign('a','slot:0');editor.update({seed:900,palette:['#123456'],title:'legacy',titleEnabled:true,materialPhase:.9,parameters:{mosaic:{layout:3,gap:12}}});editor.reset();const r=useEditor.getState().recipe;expect(r.seed).toBe(1701);expect(r.palette).toEqual(DEFAULT_PALETTE);expect(r.parameters.mosaic).toEqual({});expect(r.titleEnabled).toBe(false);expect(r.materialIds).toContain('a');expect(r.slotImages?.['slot:0']).toBe('a');expect(geometry(r)).toHaveLength(4);editor.undo();expect(useEditor.getState().recipe.seed).toBe(900);
});
it('preserves legacy drawing positions, seed and framing during explicit slot conversion',()=>{
 const old={...freshRecipe(['a','b','c']),template:'wall' as const,seed:847,parameters:{wall:{focus:1}},imageFrames:{b:{x:.1,y:0,zoom:1.3}}},before=geometry(old),converted=studioFrom(old),after=geometry(converted);
 expect(after.map(({id,...tile})=>tile)).toEqual(before.map(({id,...tile})=>tile));expect(after.map(tile=>slotAsset(converted,tile.id))).toEqual(before.map(tile=>tile.id));expect(converted.seed).toBe(old.seed);expect(old.slotImages).toBeUndefined();
});
it('preserves an explicit legacy grid instead of recomputing it from image count',()=>{const old={...freshRecipe(['a','b','c','d']),parameters:{mosaic:{layout:1,gap:7}}};const converted=studioFrom(old);expect(converted.parameters.mosaic?.layout).toBe(1);expect(geometry(converted)).toHaveLength(1);expect(geometry(converted)[0]?.x).toBe(geometry(old)[0]?.x);});
it('remaps real picture references while preserving virtual slots and independent slot crops',()=>{
 const r={...studioRecipe(['a','b'],'duo'),slotImages:{'slot:0':'a','slot:1':'a'},imageFrames:{'slot:0':{x:.1,y:0,zoom:1.5},'slot:1':{x:-.2,y:0,zoom:1.2}}};const next=remapRecipeAssets(r,new Map([['a','new-a'],['b','new-b']]));expect(next.assetIds).toEqual(SLOT_IDS);expect(next.slotImages).toEqual({'slot:0':'new-a','slot:1':'new-a'});expect(next.imageFrames).toEqual(r.imageFrames);expect(recipeAssets(next)).toEqual(['new-a','new-b']);expect(RecipeSchema.safeParse({...r,slotImages:{'slot:20':'a'}}).success).toBe(false);
});
