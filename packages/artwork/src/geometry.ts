import type { Recipe } from '@playlist-avatar/contracts';
export interface Tile { id: string; x: number; y: number; width: number; height: number; angle: number; radius: number; alpha: number }
export function parameter(recipe: Recipe, key: string, fallback: number) {
  const value = recipe.parameters[recipe.template]?.[key]; return typeof value === 'number' ? value : fallback;
}
export function geometry(recipe: Recipe): Tile[] {
  const ids = recipe.assetIds;
  if (recipe.template === 'sleeve') {
    const spread = parameter(recipe, 'spread', 55) / 100, tilt = parameter(recipe, 'rotation', 0) / 100;
    return ids.slice(0, 7).map((id, i, all) => ({ id, x: .5 + (i - (all.length - 1) / 2) * .08 * spread,
      y: .56 + Math.abs(i - (all.length - 1) / 2) * .015, width: .62, height: .62,
      angle: (i - (all.length - 1) / 2) * .24 * spread + tilt, radius: .005, alpha: 1 }));
  }
  const columns = Math.max(1, Math.min(4, Math.round(parameter(recipe, 'layout', Math.ceil(Math.sqrt(Math.max(1, ids.length)))))));
  const gap = parameter(recipe, 'gap', 3) / 200, radius = parameter(recipe, 'radius', 0) / 300;
  const cell = (1 - gap * (columns + 1)) / columns;
  return ids.slice(0, columns * columns).map((id, i) => ({ id, x: gap + cell / 2 + (i % columns) * (cell + gap),
    y: gap + cell / 2 + Math.floor(i / columns) * (cell + gap), width: cell, height: cell, angle: 0, radius, alpha: 1 }));
}
export function interpolateTiles(from: Tile[], to: Tile[], amount: number): Tile[] {
  const old = new Map(from.map(tile => [tile.id, tile]));
  return to.map(target => { const start = old.get(target.id) || { ...target, alpha: 0 }; const tile = { ...target };
    for (const field of ['x', 'y', 'width', 'height', 'angle', 'radius', 'alpha'] as const) tile[field] = start[field] + (target[field] - start[field]) * amount;
    return tile; });
}
export function imageProjections(recipe: Recipe, size: number) {
  const result = new Map<string, number>();
  for (const tile of geometry(recipe)) result.set(tile.id, Math.min(size, Math.ceil(Math.max(tile.width, tile.height) * size / 128) * 128));
  return result;
}
export function seeded(seed: number) { let state = seed >>> 0; return () => { state += 0x6D2B79F5;
  let t = Math.imul(state ^ (state >>> 15), 1 | state); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
