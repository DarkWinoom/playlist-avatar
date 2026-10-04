import { create } from 'zustand';
import { LIMITS, RecipeSchema,recipeAssets } from '@playlist-avatar/contracts';
import type { ArtworkAsset, Recipe, SourceSnapshot, TemplateId } from '@playlist-avatar/contracts';

export const DEFAULT_PALETTE = ['#d66641', '#456f8c', '#233d31', '#ddbb73'];
export function freshRecipe(ids: string[] = []): Recipe {
  return { version: 1, templateVersion: 1, template: 'mosaic', assetIds: [...new Set(ids)].slice(0, 16),materialIds:[...new Set(ids)].slice(0,50), parameters: {}, seed: 1701,
    palette: DEFAULT_PALETTE, paletteLocked: false, title: '', titleEnabled: false, materialPhase: .35,weightMode:'equal',assetStats:{},sourceOrder:[...new Set(ids)].slice(0,16),sourceRanks:Object.fromEntries([...new Set(ids)].slice(0,16).map((id,i)=>[id,i])) };
}
export function sourceOrdered(ids:string[],recipe:Recipe,assets:Record<string,ArtworkAsset>){
 const position=(id:string)=>recipe.sourceRanks[id]??assets[id]?.order??(recipe.sourceOrder.includes(id)?recipe.sourceOrder.indexOf(id):Number.MAX_SAFE_INTEGER);
 return [...ids].sort((a,b)=>position(a)-position(b)||(Date.parse(assets[a]?.createdAt||'')||0)-(Date.parse(assets[b]?.createdAt||'')||0));
}
interface EditorFrame { recipe: Recipe; snapshot?: SourceSnapshot }
interface EditorState {
  recipe: Recipe; assets: Record<string, ArtworkAsset>; snapshot?: SourceSnapshot; past: EditorFrame[]; future: EditorFrame[];
  gesture?: EditorFrame; revision: number;
  gestureFuture?:EditorFrame[];
  update: (change: Partial<Recipe>, snapshot?: SourceSnapshot) => void; parameter: (key: string, value: number | string | boolean) => void;
  begin: () => void; end: () => void; cancelGesture:()=>void; undo: () => void; redo: () => void;
  add: (assets: ArtworkAsset[], snapshot?: SourceSnapshot, replace?: boolean) => void;
  load: (recipe: Recipe, assets: ArtworkAsset[], snapshot?: SourceSnapshot) => void;
  select: (id: string) => void; reorder: (index: number, direction: number) => void; template: (id: TemplateId) => void;
  move:(id:string,target:string)=>void;place:(id:string,target:string)=>void;frame:(id:string,value:NonNullable<Recipe['imageFrames']>[string])=>void;
}
function distinct(a: unknown, b: unknown) { return JSON.stringify(a) !== JSON.stringify(b); }
export const useEditor = create<EditorState>((set, get) => ({
  recipe: freshRecipe(), assets: {}, past: [], future: [], revision: 0,
  update(change, source) {
    const state = get(), recipe = RecipeSchema.parse({ ...state.recipe, ...change });
    const snapshot = source || state.snapshot, frame = { recipe: state.recipe, snapshot: state.snapshot };
    if (!distinct(frame, { recipe, snapshot })) return;
    set({ recipe, snapshot, future: [], past: state.gesture ? state.past : [...state.past, frame].slice(-LIMITS.history), revision: state.revision + 1 });
  },
  parameter(key, value) { const { recipe, update } = get(); update({ parameters: { ...recipe.parameters,
    [recipe.template]: { ...recipe.parameters[recipe.template], [key]: value } } }); },
  begin() { if (!get().gesture) set({ gesture: structuredClone({ recipe: get().recipe, snapshot: get().snapshot }),gestureFuture:get().future }); },
  end() { const state = get(); if (!state.gesture) return;
    set({ past: distinct(state.gesture, { recipe: state.recipe, snapshot: state.snapshot }) ? [...state.past, state.gesture].slice(-LIMITS.history) : state.past, gesture: undefined,gestureFuture:undefined }); },
  cancelGesture(){const state=get();if(!state.gesture)return;set({...state.gesture,gesture:undefined,future:state.gestureFuture||[],gestureFuture:undefined,revision:state.revision+1});},
  undo() { get().end(); const state = get(), frame = state.past.at(-1); if (!frame) return;
    set({ ...frame, past: state.past.slice(0, -1), future: [{ recipe: state.recipe, snapshot: state.snapshot }, ...state.future].slice(0, LIMITS.history), revision: state.revision + 1 }); },
  redo() { get().end(); const state = get(), frame = state.future[0]; if (!frame) return;
    set({ ...frame, past: [...state.past, { recipe: state.recipe, snapshot: state.snapshot }].slice(-LIMITS.history), future: state.future.slice(1), revision: state.revision + 1 }); },
  add(incoming, snapshot, replace = false) {
    const state = get(); const assets = { ...state.assets };let nextRank=replace?0:Math.min(Number.MAX_SAFE_INTEGER,Math.max(-1,...Object.values(state.recipe.sourceRanks))+1);
    incoming=incoming.map(asset=>({...asset,order:asset.order??(replace?nextRank++:state.recipe.sourceRanks[asset.id]??nextRank++)}));incoming.forEach(asset => { assets[asset.id] = asset; });
    const ids = replace ? [...new Set(incoming.map(a => a.id))].slice(0, 16) : [...new Set([...state.recipe.assetIds, ...incoming.map(a => a.id)])].slice(0, 16);
    const materialIds=replace?[...new Set(incoming.map(a=>a.id))]:[...new Set([...recipeAssets(state.recipe),...incoming.map(a=>a.id)])];
    if(materialIds.length>LIMITS.candidates)throw new Error('RESPONSE_TOO_LARGE');
    const referenced = new Set([...state.past, ...state.future,...state.gestureFuture||[],...(state.gesture?[state.gesture]:[]), { recipe: state.recipe }].flatMap(r => recipeAssets(r.recipe)));
    incoming.forEach(a => referenced.add(a.id));
    const retained = Object.fromEntries(Object.entries(assets).filter(([id]) => referenced.has(id)));
    if (Object.values(retained).reduce((sum, a) => sum + a.bytes + a.thumbnail.size, 0) > LIMITS.candidateBytes) throw new Error('RESPONSE_TOO_LARGE');
    set({ assets: retained });
    const assetStats=Object.fromEntries(ids.flatMap(id=>{const statistics=incoming.find(a=>a.id===id)?.statistics||state.recipe.assetStats[id]||assets[id]?.statistics;return statistics?[[id,statistics]]:[];}));
    const sourceRanks=Object.fromEntries(ids.map(id=>[id,incoming.find(a=>a.id===id)?.order??state.recipe.sourceRanks[id]??assets[id]?.order??nextRank++]));
    const imageFrames=Object.fromEntries(Object.entries(state.recipe.imageFrames||{}).filter(([id])=>materialIds.includes(id)));
    state.update({ assetIds: ids,materialIds,imageFrames,assetStats,sourceRanks,sourceOrder:sourceOrdered(ids,{...state.recipe,sourceRanks},assets), palette: state.recipe.paletteLocked ? state.recipe.palette : incoming.flatMap(a => a.colors.slice(0, 1)).slice(0, 8).length ? incoming.flatMap(a => a.colors.slice(0, 1)).slice(0, 8) : DEFAULT_PALETTE }, snapshot);
  },
  load(recipe, incoming, snapshot) { recipe=RecipeSchema.parse(recipe);recipe={...recipe,materialIds:recipeAssets(recipe)}; const assets = Object.fromEntries(incoming.map(a => [a.id, a]));
    if(incoming.reduce((sum,a)=>sum+a.bytes+a.thumbnail.size,0)>LIMITS.candidateBytes)throw new Error('RESPONSE_TOO_LARGE');
    if (recipeAssets(recipe).some(id => !assets[id])) throw new Error('INVALID_PACKAGE');
    set({ recipe: structuredClone(recipe), assets, snapshot, past: [], future: [], gesture: undefined,gestureFuture:undefined, revision: get().revision + 1 }); },
  select(id) { const state = get(); if (!state.assets[id]) return;
    const ids = state.recipe.assetIds.includes(id) ? state.recipe.assetIds.filter(value => value !== id) : [...state.recipe.assetIds, id].slice(0, 16);
    const ranks={...state.recipe.sourceRanks};if(ids.includes(id)&&ranks[id]===undefined)ranks[id]=state.assets[id]!.order??Math.min(Number.MAX_SAFE_INTEGER,Math.max(-1,...Object.values(ranks))+1);
    const sourceRanks=Object.keys(ranks).length>16?Object.fromEntries(ids.map(key=>[key,ranks[key]!])):ranks;
    const sourceOrder=sourceOrdered(ids,{...state.recipe,sourceRanks},state.assets);
    state.update({ assetIds: ids,materialIds:recipeAssets(state.recipe), sourceOrder, sourceRanks, assetStats:Object.fromEntries(ids.flatMap(key=>{const value=state.recipe.assetStats[key]||state.assets[key]?.statistics;return value?[[key,value]]:[];})) }); },
  reorder(index, direction) { const state = get(), ids = [...state.recipe.assetIds], next = index + direction;
    if (next < 0 || next >= ids.length) return; [ids[index], ids[next]] = [ids[next]!, ids[index]!]; state.update({ assetIds: ids }); },
  template(id) { get().update({ template: id }); },
  move(id,target){const state=get(),ids=[...state.recipe.assetIds],from=ids.indexOf(id),to=ids.indexOf(target);if(from<0||to<0||from===to)return;ids.splice(from,1);ids.splice(to,0,id);state.update({assetIds:ids,seed:1701});},
  place(id,target){const state=get();if(!state.assets[id]||id===target)return;const ids=[...state.recipe.assetIds],at=ids.indexOf(target),from=ids.indexOf(id);if(at<0)return;if(from>=0)[ids[at],ids[from]]=[ids[from]!,ids[at]!];else ids[at]=id;
    const sourceRanks=Object.fromEntries(ids.map(key=>[key,state.recipe.sourceRanks[key]??state.assets[key]?.order??ids.indexOf(key)]));
    const assetStats=Object.fromEntries(ids.flatMap(key=>{const stats=state.recipe.assetStats[key]||state.assets[key]?.statistics;return stats?[[key,stats]]:[];}));state.update({assetIds:ids,materialIds:[...new Set([...recipeAssets(state.recipe),id])],sourceRanks,assetStats});},
  frame(id,value){const state=get();if(!state.assets[id])return;state.update({imageFrames:{...state.recipe.imageFrames,[id]:value}});},
}));
