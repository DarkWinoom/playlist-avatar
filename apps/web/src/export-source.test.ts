import{expect,it}from'vitest';import{freezeExport}from'./export-source.ts';import{freshRecipe,useEditor}from'./editor-store.ts';import type{ArtworkAsset}from'@playlist-avatar/contracts';
const asset=(id:string):ArtworkAsset=>({id,fingerprint:id.repeat(64),blob:new Blob([id]),thumbnail:new Blob([id]),width:20,height:20,bytes:1,colors:['#123456'],label:id,createdAt:new Date().toISOString()});
it('exports an immutable saved-work snapshot without switching or retaining unrelated draft materials',()=>{
 const saved=freshRecipe(['a']),assets={a:asset('a'),unused:asset('unused')};useEditor.getState().load(freshRecipe(['b']),[asset('b')]);const draft=structuredClone(useEditor.getState().recipe),snapshot=freezeExport({recipe:saved,assets,name:'Saved work'});
 saved.seed=999;assets.a.label='Changed';expect(snapshot.recipe.seed).not.toBe(999);expect(snapshot.assets.a?.label).toBe('a');expect(Object.keys(snapshot.assets)).toEqual(['a']);expect(useEditor.getState().recipe).toEqual(draft);
});
