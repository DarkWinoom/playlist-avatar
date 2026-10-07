import { create } from 'zustand';
import { LIMITS, RecipeSchema,recipeAssets,SLOT_IDS,workspaceAssets } from '@playlist-avatar/contracts';
import{geometry,usesImages}from'@playlist-avatar/artwork';
import type { ArtworkAsset, Recipe, SourceSnapshot, TemplateId,Workspace } from '@playlist-avatar/contracts';
import{validateWorkspace,stashVariant,variantFor,workspaceFor}from'./studio-workspace.ts';

export const DEFAULT_PALETTE = ['#d66641', '#456f8c', '#233d31', '#ddbb73'];
export function freshRecipe(ids: string[] = []): Recipe {
  return { version: 1, templateVersion: 1, template: 'mosaic', assetIds: [...new Set(ids)].slice(0, 16),materialIds:[...new Set(ids)].slice(0,50), parameters: {}, seed: 1701,
    palette: DEFAULT_PALETTE, paletteLocked: false, title: '', titleEnabled: false, materialPhase: .35,weightMode:'equal',assetStats:{},sourceOrder:[...new Set(ids)].slice(0,16),sourceRanks:Object.fromEntries([...new Set(ids)].slice(0,16).map((id,i)=>[id,i])) };
}
export function sourceOrdered(ids:string[],recipe:Recipe,assets:Record<string,ArtworkAsset>){
 const position=(id:string)=>recipe.sourceRanks[id]??assets[id]?.order??(recipe.sourceOrder.includes(id)?recipe.sourceOrder.indexOf(id):Number.MAX_SAFE_INTEGER);
 return [...ids].sort((a,b)=>position(a)-position(b)||(Date.parse(assets[a]?.createdAt||'')||0)-(Date.parse(assets[b]?.createdAt||'')||0));
}
export function studioRecipe(ids:string[]=[],template:TemplateId='aura'):Recipe{return{...freshRecipe(),template,assetIds:[...SLOT_IDS],materialIds:[...new Set(ids)],slotImages:{}};}
export function studioFrom(recipe:Recipe):Recipe{
 if(recipe.slotImages!==undefined)return recipe;
 const old=geometry(recipe),next:Recipe={...recipe,assetIds:[...SLOT_IDS],slotCount:Math.max(1,recipe.assetIds.length),materialIds:recipeAssets(recipe),slotImages:{},parameters:{...recipe.parameters,...(recipe.template==='mosaic'?{mosaic:{...recipe.parameters.mosaic,layout:recipe.parameters.mosaic?.layout??Math.ceil(Math.sqrt(Math.max(1,recipe.assetIds.length)))}}:{})}};
 const tiles=geometry(next);return {...next,slotImages:Object.fromEntries(old.map((tile,i)=>[tiles[i]!.id,tile.id])),imageFrames:Object.fromEntries(old.flatMap((tile,i)=>recipe.imageFrames?.[tile.id]?[[tiles[i]!.id,recipe.imageFrames[tile.id]!]]:[]))};
}

interface EditorFrame { recipe: Recipe; snapshot?: SourceSnapshot;workspace?:Workspace }
interface EditorState {
  recipe: Recipe; assets: Record<string, ArtworkAsset>; snapshot?: SourceSnapshot; past: EditorFrame[]; future: EditorFrame[];
  gesture?: EditorFrame; revision: number;
  gestureFuture?:EditorFrame[];
  workspace?:Workspace;
  update: (change: Partial<Recipe>, snapshot?: SourceSnapshot,workspace?:Workspace) => void; parameter: (key: string, value: number | string | boolean) => void;
  begin: () => void; end: () => void; cancelGesture:()=>void; undo: () => void; redo: () => void;
  add: (assets: ArtworkAsset[], snapshot?: SourceSnapshot, replace?: boolean) => void;
  load: (recipe: Recipe, assets: ArtworkAsset[], snapshot?: SourceSnapshot,workspace?:Workspace) => void;
  select: (id: string) => void; reorder: (index: number, direction: number) => void; template: (id: TemplateId) => void;
  move:(id:string,target:string)=>void;place:(id:string,target:string)=>void;frame:(id:string,value:NonNullable<Recipe['imageFrames']>[string])=>void;
  choose:(assets:ArtworkAsset[])=>void;assign:(id:string,slot:string)=>void;reset:()=>void;
  accept:(assets:ArtworkAsset[])=>void;restoreSlot:(slot:string)=>void;identify:(id?:string)=>void;
}
function distinct(a: unknown, b: unknown) { return JSON.stringify(a) !== JSON.stringify(b); }
export const useEditor = create<EditorState>((set, get) => ({
  recipe: studioRecipe(), assets: {}, past: [], future: [], revision: 0,
  update(change, source,context) {
    const state = get(), recipe = RecipeSchema.parse({ ...state.recipe, ...change });
    const snapshot = source || state.snapshot,workspace=context||state.workspace,frame = { recipe: state.recipe, snapshot: state.snapshot,workspace:state.workspace };
    if(workspace)validateWorkspace(recipe,workspace);
    if (!distinct(frame, { recipe, snapshot,workspace })) return;
    set({ recipe, snapshot,workspace, future: [], past: state.gesture ? state.past : [...state.past, frame].slice(-LIMITS.history), revision: state.revision + 1 });
  },
  parameter(key, value) { const { recipe, update } = get(); update({ parameters: { ...recipe.parameters,
    [recipe.template]: { ...recipe.parameters[recipe.template], [key]: value } },...(['layout','count','density','frames','layers','columns'].includes(key)?{slotCount:undefined}:{}) }); },
  begin() { if (!get().gesture) set({ gesture: structuredClone({ recipe: get().recipe, snapshot: get().snapshot,workspace:get().workspace }),gestureFuture:get().future }); },
  end() { const state = get(); if (!state.gesture) return;
    set({ past: distinct(state.gesture, { recipe: state.recipe, snapshot: state.snapshot,workspace:state.workspace }) ? [...state.past, state.gesture].slice(-LIMITS.history) : state.past, gesture: undefined,gestureFuture:undefined }); },
  cancelGesture(){const state=get();if(!state.gesture)return;set({...state.gesture,gesture:undefined,future:state.gestureFuture||[],gestureFuture:undefined,revision:state.revision+1});},
  undo() { get().end(); const state = get(), frame = state.past.at(-1); if (!frame) return;
    set({ ...frame, past: state.past.slice(0, -1), future: [{ recipe: state.recipe, snapshot: state.snapshot,workspace:state.workspace }, ...state.future].slice(0, LIMITS.history), revision: state.revision + 1 }); },
  redo() { get().end(); const state = get(), frame = state.future[0]; if (!frame) return;
    set({ ...frame, past: [...state.past, { recipe: state.recipe, snapshot: state.snapshot,workspace:state.workspace }].slice(-LIMITS.history), future: state.future.slice(1), revision: state.revision + 1 }); },
  add(incoming, snapshot, replace = false) {
    const state = get(); const assets = { ...state.assets };let nextRank=replace?0:Math.min(Number.MAX_SAFE_INTEGER,Math.max(-1,...Object.values(state.recipe.sourceRanks))+1);
    incoming=incoming.map(asset=>({...asset,order:asset.order??(replace?nextRank++:state.recipe.sourceRanks[asset.id]??nextRank++)}));incoming.forEach(asset => { assets[asset.id] = asset; });
    const ids = replace ? [...new Set(incoming.map(a => a.id))].slice(0, 16) : [...new Set([...state.recipe.assetIds, ...incoming.map(a => a.id)])].slice(0, 16);
    const materialIds=replace?[...new Set(incoming.map(a=>a.id))]:[...new Set([...recipeAssets(state.recipe),...incoming.map(a=>a.id)])];
    if(materialIds.length>LIMITS.candidates)throw new Error('RESPONSE_TOO_LARGE');
    const referenced = new Set([...state.past, ...state.future,...state.gestureFuture||[],...(state.gesture?[state.gesture]:[]), state].flatMap(r => workspaceAssets(r.recipe,r.workspace)));
    incoming.forEach(a => referenced.add(a.id));
    const retained = Object.fromEntries(Object.entries(assets).filter(([id]) => referenced.has(id)));
    if (Object.values(retained).reduce((sum, a) => sum + a.bytes + a.thumbnail.size, 0) > LIMITS.candidateBytes) throw new Error('RESPONSE_TOO_LARGE');
    set({ assets: retained });
    const assetStats=Object.fromEntries(ids.flatMap(id=>{const statistics=incoming.find(a=>a.id===id)?.statistics||state.recipe.assetStats[id]||assets[id]?.statistics;return statistics?[[id,statistics]]:[];}));
    const sourceRanks=Object.fromEntries(ids.map(id=>[id,incoming.find(a=>a.id===id)?.order??state.recipe.sourceRanks[id]??assets[id]?.order??nextRank++]));
    const imageFrames=Object.fromEntries(Object.entries(state.recipe.imageFrames||{}).filter(([id])=>materialIds.includes(id)));
    state.update({ assetIds: ids,materialIds,imageFrames,assetStats,sourceRanks,sourceOrder:sourceOrdered(ids,{...state.recipe,sourceRanks},assets), palette: state.recipe.paletteLocked ? state.recipe.palette : incoming.flatMap(a => a.colors.slice(0, 1)).slice(0, 8).length ? incoming.flatMap(a => a.colors.slice(0, 1)).slice(0, 8) : DEFAULT_PALETTE }, snapshot);
  },
  load(recipe, incoming, snapshot,workspace) { recipe=RecipeSchema.parse(recipe);recipe={...recipe,materialIds:recipeAssets(recipe)}; const assets = Object.fromEntries(incoming.map(a => [a.id, a]));
    if(incoming.reduce((sum,a)=>sum+a.bytes+a.thumbnail.size,0)>LIMITS.candidateBytes)throw new Error('RESPONSE_TOO_LARGE');
    if(workspace)validateWorkspace(recipe,workspace);
    if (workspaceAssets(recipe,workspace).some(id => !assets[id])) throw new Error('INVALID_PACKAGE');
    set({ recipe: structuredClone(recipe), assets, snapshot,workspace:workspace?structuredClone(workspace):undefined, past: [], future: [], gesture: undefined,gestureFuture:undefined, revision: get().revision + 1 }); },
  select(id) { const state = get(); if (!state.assets[id]) return;
    const ids = state.recipe.assetIds.includes(id) ? state.recipe.assetIds.filter(value => value !== id) : [...state.recipe.assetIds, id].slice(0, 16);
    const ranks={...state.recipe.sourceRanks};if(ids.includes(id)&&ranks[id]===undefined)ranks[id]=state.assets[id]!.order??Math.min(Number.MAX_SAFE_INTEGER,Math.max(-1,...Object.values(ranks))+1);
    const sourceRanks=Object.keys(ranks).length>16?Object.fromEntries(ids.map(key=>[key,ranks[key]!])):ranks;
    const sourceOrder=sourceOrdered(ids,{...state.recipe,sourceRanks},state.assets);
    state.update({ assetIds: ids,materialIds:recipeAssets(state.recipe), sourceOrder, sourceRanks, assetStats:Object.fromEntries(ids.flatMap(key=>{const value=state.recipe.assetStats[key]||state.assets[key]?.statistics;return value?[[key,value]]:[];})) }); },
  reorder(index, direction) { const state = get(), ids = [...state.recipe.assetIds], next = index + direction;
    if (next < 0 || next >= ids.length) return; [ids[index], ids[next]] = [ids[next]!, ids[index]!]; state.update({ assetIds: ids }); },
  template(id) { const state=get();if(state.recipe.template===id)return;if(state.workspace){const workspace=stashVariant(state.recipe,state.workspace),recipe=variantFor(workspace,id)||{...studioRecipe([],id),parameters:{...state.recipe.parameters}};workspace.origins[id]??=studioRecipe([],id);state.update(recipe,state.snapshot,workspace);return;}const recipe=studioFrom(state.recipe);state.update({...recipe,template:id,slotCount:undefined,palette:DEFAULT_PALETTE,title:'',titleEnabled:false,weightMode:'equal',materialPhase:.35}); },
  move(id,target){const state=get(),ids=[...state.recipe.assetIds],from=ids.indexOf(id),to=ids.indexOf(target);if(from<0||to<0||from===to)return;ids.splice(from,1);ids.splice(to,0,id);state.update({assetIds:ids,seed:1701});},
  place(id,target){const state=get();if(!state.assets[id]||id===target)return;const ids=[...state.recipe.assetIds],at=ids.indexOf(target),from=ids.indexOf(id);if(at<0)return;if(from>=0)[ids[at],ids[from]]=[ids[from]!,ids[at]!];else ids[at]=id;
    const sourceRanks=Object.fromEntries(ids.map(key=>[key,state.recipe.sourceRanks[key]??state.assets[key]?.order??ids.indexOf(key)]));
    const assetStats=Object.fromEntries(ids.flatMap(key=>{const stats=state.recipe.assetStats[key]||state.assets[key]?.statistics;return stats?[[key,stats]]:[];}));state.update({assetIds:ids,materialIds:[...new Set([...recipeAssets(state.recipe),id])],sourceRanks,assetStats});},
  frame(id,value){const state=get();if(!state.assets[id]&&!state.recipe.slotImages?.[id])return;state.update({imageFrames:{...state.recipe.imageFrames,[id]:value}});},
  choose(incoming){const state=get(),recipe=studioFrom(state.recipe),ids=[...new Set(incoming.map(a=>a.id))];if(ids.length>LIMITS.candidates||incoming.reduce((sum,a)=>sum+a.bytes+a.thumbnail.size,0)>LIMITS.candidateBytes)throw new Error('RESPONSE_TOO_LARGE');const assets={...state.assets,...Object.fromEntries(incoming.map(a=>[a.id,a]))};const refs=new Set([state,...state.past,...state.future,...state.gestureFuture||[],...(state.gesture?[state.gesture]:[])].flatMap(f=>workspaceAssets(f.recipe,f.workspace)));ids.forEach(id=>refs.add(id));const retained=Object.fromEntries(Object.entries(assets).filter(([id])=>refs.has(id)));if(Object.values(retained).reduce((sum,a)=>sum+a.bytes+a.thumbnail.size,0)>LIMITS.candidateBytes)throw new Error('RESPONSE_TOO_LARGE');set({assets:retained});state.update({...recipe,materialIds:ids,slotImages:Object.fromEntries(Object.entries(recipe.slotImages||{}).filter(([,id])=>ids.includes(id))),imageFrames:Object.fromEntries(Object.entries(recipe.imageFrames||{}).filter(([slot])=>ids.includes(recipe.slotImages?.[slot]||'')))});},
  assign(id,slot){const state=get();if(!state.assets[id]||!usesImages(state.recipe.template))return;let recipe=state.recipe;if(recipe.slotImages===undefined){const tiles=geometry(recipe),index=tiles.findIndex(t=>t.id===slot);if(index<0)return;recipe=studioFrom(recipe);slot=geometry(recipe)[index]!.id;}if(!SLOT_IDS.includes(slot))return;const slotImages={...recipe.slotImages,[slot]:id};state.update({...recipe,slotImages,materialIds:state.workspace?.flow==='quick'?[...new Set(Object.values(slotImages))]:[...new Set([...recipe.materialIds||[],id])],imageFrames:Object.fromEntries(Object.entries(recipe.imageFrames||{}).filter(([key])=>key!==slot))});},
  accept(incoming){const state=get(),frames=[state,...state.past,...state.future,...state.gestureFuture||[],...(state.gesture?[state.gesture]:[])],referenced=new Set(frames.flatMap(frame=>workspaceAssets(frame.recipe,frame.workspace)));incoming.forEach(asset=>referenced.add(asset.id));const assets=Object.fromEntries(Object.entries({...state.assets,...Object.fromEntries(incoming.map(asset=>[asset.id,asset]))}).filter(([id])=>referenced.has(id)));if(incoming.length>LIMITS.candidates||Object.values(assets).reduce((sum,asset)=>sum+asset.bytes+asset.thumbnail.size,0)>LIMITS.candidateBytes)throw Error('RESPONSE_TOO_LARGE');set({assets});},
  identify(id){const state=get();if(state.workspace?.editingId===id)return;const workspace=state.workspace?{...state.workspace,editingId:id}:workspaceFor(state.recipe,state.recipe,id),reidentify=(frame:EditorFrame):EditorFrame=>({...frame,workspace:frame.workspace?{...frame.workspace,editingId:id}:workspaceFor(frame.recipe,frame.recipe,id)});set({workspace,past:state.past.map(reidentify),future:state.future.map(reidentify),gesture:state.gesture?reidentify(state.gesture):undefined,gestureFuture:state.gestureFuture?.map(reidentify),revision:state.revision+1});},
  restoreSlot(slot){const state=get(),recipe=studioFrom(state.recipe),original=state.workspace?.origins[state.recipe.template]||studioRecipe([],state.recipe.template),baseline=studioFrom(original),index=geometry(state.recipe).findIndex(tile=>tile.id===slot);if(index<0)return;const target=geometry(recipe)[index]!.id,oldSlot=geometry(baseline)[index]?.id,value=oldSlot?baseline.slotImages?.[oldSlot]:undefined,slotImages={...recipe.slotImages},imageFrames={...recipe.imageFrames};if(value)slotImages[target]=value;else delete slotImages[target];if(oldSlot&&baseline.imageFrames?.[oldSlot])imageFrames[target]=baseline.imageFrames[oldSlot]!;else delete imageFrames[target];state.update({...recipe,slotImages,imageFrames,materialIds:state.workspace?.flow==='quick'?[...new Set(Object.values(slotImages))]:recipe.materialIds});},
  reset(){const state=get(),recipe=studioFrom(state.recipe);state.update({...recipe,slotCount:undefined,parameters:{...recipe.parameters,[recipe.template]:{}},seed:1701,palette:DEFAULT_PALETTE,paletteLocked:false,title:'',titleEnabled:false,materialPhase:.35,weightMode:'equal',imageFrames:{}});},
}));
