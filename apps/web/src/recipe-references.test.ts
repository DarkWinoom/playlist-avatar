import {expect,it} from 'vitest';
import {freshRecipe} from './editor-store.ts';
import {remapRecipeAssets} from './recipe-references.ts';
it('keeps source weights and order when an image encoder changes its identity',()=>{
 const recipe={...freshRecipe(['old-a','old-b']),weightMode:'occurrences' as const,sourceOrder:['old-b','old-a','stale'],assetStats:{'old-a':{occurrenceCount:5},stale:{occurrenceCount:9}}};
 const restored=remapRecipeAssets(recipe,new Map([['old-a','new-a'],['old-b','new-b']]));
 expect(restored.assetIds).toEqual(['new-a','new-b']);expect(restored.sourceOrder).toEqual(['new-b','new-a']);expect(restored.assetStats).toEqual({'new-a':{occurrenceCount:5}});expect(restored.sourceRanks).toEqual({'new-a':0,'new-b':1});
 expect(()=>remapRecipeAssets(recipe,new Map())).toThrow('INVALID_PACKAGE');
});
it('remaps unused pool images and their framing instead of dropping them',()=>{const recipe={...freshRecipe(['a','b']),assetIds:['b'],materialIds:['a','b'],imageFrames:{a:{x:.5,y:-.5,zoom:1.5}}};const next=remapRecipeAssets(recipe,new Map([['a','new-a'],['b','new-b']]));expect(next.materialIds).toEqual(['new-b','new-a']);expect(next.imageFrames).toEqual({'new-a':{x:.5,y:-.5,zoom:1.5}});expect(next.assetIds).toEqual(['new-b']);});
