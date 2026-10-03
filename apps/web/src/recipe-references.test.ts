import {expect,it} from 'vitest';
import {freshRecipe} from './editor-store.ts';
import {remapRecipeAssets} from './recipe-references.ts';
it('keeps source weights and order when an image encoder changes its identity',()=>{
 const recipe={...freshRecipe(['old-a','old-b']),weightMode:'occurrences' as const,sourceOrder:['old-b','old-a','stale'],assetStats:{'old-a':{occurrenceCount:5},stale:{occurrenceCount:9}}};
 const restored=remapRecipeAssets(recipe,new Map([['old-a','new-a'],['old-b','new-b']]));
 expect(restored.assetIds).toEqual(['new-a','new-b']);expect(restored.sourceOrder).toEqual(['new-b','new-a']);expect(restored.assetStats).toEqual({'new-a':{occurrenceCount:5}});expect(restored.sourceRanks).toEqual({'new-a':0,'new-b':1});
 expect(()=>remapRecipeAssets(recipe,new Map())).toThrow('INVALID_PACKAGE');
});
