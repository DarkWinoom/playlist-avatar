import { beforeEach, expect, it } from 'vitest';
import { freshRecipe, useEditor,sourceOrdered } from './editor-store.ts';
import type { ArtworkAsset, SourceSnapshot } from '@playlist-avatar/contracts';import{recipeAssets}from'@playlist-avatar/contracts';
beforeEach(() => useEditor.getState().load(freshRecipe(), []));
const poolAsset=(id:string):ArtworkAsset=>({id,fingerprint:id.repeat(64),blob:new Blob(['a']),thumbnail:new Blob(['a']),width:20,height:20,bytes:1,colors:['#123456'],label:id,createdAt:new Date().toISOString()});
it('copies a legacy selected-only recipe into a recoverable material pool without mutating the input',()=>{const legacy=freshRecipe(['a','b']);delete legacy.materialIds;const editor=useEditor.getState();editor.load(legacy,[poolAsset('a'),poolAsset('b')]);editor.select('a');expect(recipeAssets(useEditor.getState().recipe)).toEqual(['b','a']);expect(legacy.materialIds).toBeUndefined();editor.select('a');expect(useEditor.getState().recipe.assetIds).toEqual(['b','a']);});
it('keeps an unused material through additional imports, save references and reselection',()=>{const editor=useEditor.getState();editor.add([poolAsset('a'),poolAsset('b')]);editor.select('a');editor.add([poolAsset('c')]);expect(recipeAssets(useEditor.getState().recipe)).toEqual(['b','c','a']);expect(useEditor.getState().assets.a).toBeDefined();editor.select('a');expect(useEditor.getState().recipe.assetIds).toContain('a');});
it('swaps cover slots or replaces a slot while preserving the old cover in the pool',()=>{const editor=useEditor.getState();editor.add([poolAsset('a'),poolAsset('b')]);editor.place('b','a');expect(useEditor.getState().recipe.assetIds).toEqual(['b','a']);editor.undo();editor.add([poolAsset('c')]);editor.select('c');editor.place('c','a');expect(useEditor.getState().recipe.assetIds).toEqual(['c','b']);expect(recipeAssets(useEditor.getState().recipe)).toContain('a');editor.undo();expect(useEditor.getState().recipe.assetIds).toEqual(['a','b']);});
it('cancels a crop gesture without consuming undo or redo history',()=>{const editor=useEditor.getState();editor.add([poolAsset('a')]);editor.parameter('gap',8);editor.undo();const before=structuredClone(useEditor.getState().recipe),past=useEditor.getState().past.length,future=useEditor.getState().future.length;editor.begin();for(let i=0;i<20;i++)editor.frame('a',{x:i/20,y:0,zoom:1.5});editor.cancelGesture();expect(useEditor.getState().recipe).toEqual(before);expect(useEditor.getState().past).toHaveLength(past);expect(useEditor.getState().future).toHaveLength(future);});
it('retains gesture and temporarily hidden redo materials until cancellation',()=>{const editor=useEditor.getState();editor.load(freshRecipe(['a']),[poolAsset('a')]);editor.begin();editor.add([poolAsset('b')],undefined,true);editor.add([poolAsset('c')],undefined,true);editor.cancelGesture();expect(useEditor.getState().assets.a).toBeDefined();editor.add([poolAsset('b')],undefined,true);editor.undo();editor.begin();editor.frame('a',{x:0,y:0,zoom:1.5});editor.add([poolAsset('c')]);editor.cancelGesture();editor.redo();expect(useEditor.getState().recipe.assetIds).toEqual(['b']);expect(useEditor.getState().assets.b).toBeDefined();});
it('merges an entire gesture and restores per-template parameters', () => {
  const editor = useEditor.getState(); editor.begin(); for (let value = 1; value <= 20; value++) editor.parameter('gap', value); editor.end();
  expect(useEditor.getState().past).toHaveLength(1); editor.undo(); expect(useEditor.getState().recipe.parameters.mosaic).toBeUndefined();
  editor.redo(); editor.template('sleeve'); editor.parameter('spread', 30); editor.template('mosaic');
  expect(useEditor.getState().recipe.parameters.mosaic?.gap).toBe(20); expect(useEditor.getState().recipe.parameters.sleeve?.spread).toBe(30);
});
it('bounds history and makes a snapshot independent from further editing', () => {
  const editor = useEditor.getState(); for (let seed = 0; seed < 70; seed++) editor.update({ seed });
  expect(useEditor.getState().past).toHaveLength(50); const snapshot = structuredClone(useEditor.getState().recipe);
  editor.update({ title: '新标题' }); expect(snapshot.title).toBe('');
});
it('deduplicates identical materials and undoes source coverage together with recipe', () => {
  const asset: ArtworkAsset = { id: 'a', fingerprint: 'a'.repeat(64), blob: new Blob(['a']), thumbnail: new Blob(['a']), width: 1, height: 1, bytes: 1, colors: ['#123456'], label: 'a', createdAt: new Date().toISOString() };
  const first: SourceSnapshot = { key: 'netease:public:collection:1', source: 'netease', collectionId: '1', title: 'First', kind: 'playlist', fetchedAt: new Date().toISOString(), coverage: { received: 0, offset: 0, knownTotal: 0, complete: true }, warnings: [] };
  const second = { ...first, title: 'Second', collectionId: '2', key: 'netease:public:collection:2' };
  const editor = useEditor.getState(); editor.add([asset, asset], first, true); expect(useEditor.getState().recipe.assetIds).toEqual(['a']);
  editor.add([asset], second, true); editor.undo(); expect(useEditor.getState().snapshot?.title).toBe('First');
  editor.redo(); expect(useEditor.getState().snapshot?.title).toBe('Second'); expect(useEditor.getState().assets.a?.blob.size).toBe(1);
});
it('replaces a deselected source slot without losing the new source order or statistics',()=>{
 const incoming=Array.from({length:17},(_,i)=>({id:`a${i}`,fingerprint:i.toString(16).padStart(64,'0'),blob:new Blob(['a']),thumbnail:new Blob(['a']),width:1,height:1,bytes:1,colors:['#123456'],label:`a${i}`,createdAt:new Date().toISOString(),statistics:{occurrenceCount:i+1}}));
 const editor=useEditor.getState();editor.add(incoming.slice(0,16),undefined,true);editor.select('a4');editor.add([incoming[16]!]);
 expect(useEditor.getState().recipe.sourceOrder).toEqual([...incoming.slice(0,16).map(a=>a.id).filter(id=>id!=='a4'),'a16']);
 expect(Object.keys(useEditor.getState().recipe.assetStats)).toHaveLength(16);expect(useEditor.getState().recipe.assetStats.a16?.occurrenceCount).toBe(17);
});
it('restores source positions after deselect/reselect and preserves the old source through undo',()=>{
 const assets=[0,1].map(i=>({id:`a${i}`,fingerprint:i.toString(16).padStart(64,'0'),order:i,blob:new Blob(['a']),thumbnail:new Blob(['a']),width:1,height:1,bytes:1,colors:['#123456'],label:`a${i}`,createdAt:new Date().toISOString()}));
 const editor=useEditor.getState();editor.add(assets,undefined,true);editor.select('a0');editor.select('a0');let state=useEditor.getState();expect(sourceOrdered(state.recipe.assetIds,state.recipe,state.assets)).toEqual(['a0','a1']);
 editor.add([{...assets[0]!,order:9},assets[1]!],undefined,true);editor.undo();state=useEditor.getState();expect(state.assets.a0?.order).toBe(9);expect(sourceOrdered(['a1','a0'],state.recipe,state.assets)).toEqual(['a0','a1']);
});
