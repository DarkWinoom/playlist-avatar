import { create } from 'zustand';
import { LIMITS, RecipeSchema } from '@playlist-avatar/contracts';
import type { ArtworkAsset, Recipe, SourceSnapshot, TemplateId } from '@playlist-avatar/contracts';

export const DEFAULT_PALETTE = ['#d66641', '#456f8c', '#233d31', '#ddbb73'];
export function freshRecipe(ids: string[] = []): Recipe {
  return { version: 1, templateVersion: 1, template: 'mosaic', assetIds: [...new Set(ids)].slice(0, 16), parameters: {}, seed: 1701,
    palette: DEFAULT_PALETTE, paletteLocked: false, title: '', titleEnabled: false, materialPhase: .35 };
}
interface EditorFrame { recipe: Recipe; snapshot?: SourceSnapshot }
interface EditorState {
  recipe: Recipe; assets: Record<string, ArtworkAsset>; snapshot?: SourceSnapshot; past: EditorFrame[]; future: EditorFrame[];
  gesture?: EditorFrame; revision: number;
  update: (change: Partial<Recipe>, snapshot?: SourceSnapshot) => void; parameter: (key: string, value: number | string | boolean) => void;
  begin: () => void; end: () => void; undo: () => void; redo: () => void;
  add: (assets: ArtworkAsset[], snapshot?: SourceSnapshot, replace?: boolean) => void;
  load: (recipe: Recipe, assets: ArtworkAsset[], snapshot?: SourceSnapshot) => void;
  select: (id: string) => void; reorder: (index: number, direction: number) => void; template: (id: TemplateId) => void;
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
  begin() { if (!get().gesture) set({ gesture: structuredClone({ recipe: get().recipe, snapshot: get().snapshot }) }); },
  end() { const state = get(); if (!state.gesture) return;
    set({ past: distinct(state.gesture, { recipe: state.recipe, snapshot: state.snapshot }) ? [...state.past, state.gesture].slice(-LIMITS.history) : state.past, gesture: undefined }); },
  undo() { get().end(); const state = get(), frame = state.past.at(-1); if (!frame) return;
    set({ ...frame, past: state.past.slice(0, -1), future: [{ recipe: state.recipe, snapshot: state.snapshot }, ...state.future].slice(0, LIMITS.history), revision: state.revision + 1 }); },
  redo() { get().end(); const state = get(), frame = state.future[0]; if (!frame) return;
    set({ ...frame, past: [...state.past, { recipe: state.recipe, snapshot: state.snapshot }].slice(-LIMITS.history), future: state.future.slice(1), revision: state.revision + 1 }); },
  add(incoming, snapshot, replace = false) {
    const state = get(); const assets = { ...state.assets }; incoming.forEach(asset => { assets[asset.id] = asset; });
    const ids = replace ? [...new Set(incoming.map(a => a.id))].slice(0, 16) : [...new Set([...state.recipe.assetIds, ...incoming.map(a => a.id)])].slice(0, 16);
    const referenced = new Set([...state.past, ...state.future, { recipe: state.recipe }].flatMap(r => r.recipe.assetIds));
    incoming.forEach(a => referenced.add(a.id));
    const retained = Object.fromEntries(Object.entries(assets).filter(([id]) => referenced.has(id)));
    if (Object.values(retained).reduce((sum, a) => sum + a.bytes + a.thumbnail.size, 0) > LIMITS.candidateBytes) throw new Error('RESPONSE_TOO_LARGE');
    set({ assets: retained });
    state.update({ assetIds: ids, palette: state.recipe.paletteLocked ? state.recipe.palette : incoming.flatMap(a => a.colors.slice(0, 1)).slice(0, 8).length ? incoming.flatMap(a => a.colors.slice(0, 1)).slice(0, 8) : DEFAULT_PALETTE }, snapshot);
  },
  load(recipe, incoming, snapshot) { RecipeSchema.parse(recipe); const assets = Object.fromEntries(incoming.map(a => [a.id, a]));
    if(incoming.reduce((sum,a)=>sum+a.bytes+a.thumbnail.size,0)>LIMITS.candidateBytes)throw new Error('RESPONSE_TOO_LARGE');
    if (recipe.assetIds.some(id => !assets[id])) throw new Error('INVALID_PACKAGE');
    set({ recipe: structuredClone(recipe), assets, snapshot, past: [], future: [], gesture: undefined, revision: get().revision + 1 }); },
  select(id) { const state = get(); if (!state.assets[id]) return;
    state.update({ assetIds: state.recipe.assetIds.includes(id) ? state.recipe.assetIds.filter(value => value !== id) : [...state.recipe.assetIds, id].slice(0, 16) }); },
  reorder(index, direction) { const state = get(), ids = [...state.recipe.assetIds], next = index + direction;
    if (next < 0 || next >= ids.length) return; [ids[index], ids[next]] = [ids[next]!, ids[index]!]; state.update({ assetIds: ids }); },
  template(id) { get().update({ template: id }); },
}));
