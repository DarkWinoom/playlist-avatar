import { expect, it } from 'vitest';
import { geometry, interpolateTiles, seeded, imageProjections } from './geometry.ts';
import type { Recipe } from '@playlist-avatar/contracts';
const recipe: Recipe = { version: 1, templateVersion: 1, template: 'mosaic', assetIds: ['a', 'b', 'c', 'd'], parameters: {}, seed: 5, palette: ['#123456'], paletteLocked: false, title: '', titleEnabled: false, materialPhase: .3,weightMode:'equal',assetStats:{},sourceOrder:[],sourceRanks:{} };
it('preserves identities across grid to fan and midway retargeting', () => {
  const grid = geometry(recipe), fan = geometry({ ...recipe, template: 'sleeve' });
  const half = interpolateTiles(grid, fan, .5), redirected = interpolateTiles(half, grid, .2);
  expect(half.map(t => t.id)).toEqual(grid.map(t=>t.id)); expect(half[0]!.angle).not.toBe(0);
  expect(redirected[0]!.angle).toBeCloseTo(half[0]!.angle * .8);
});
it('bounds interpolation when a RAF timestamp precedes animation setup', () => {
  const rounded = geometry({ ...recipe, parameters: { mosaic: { radius: 20 } } }), flat = geometry(recipe);
  expect(interpolateTiles(rounded, flat, -0.001)).toEqual(rounded);
  expect(interpolateTiles(rounded, flat, 1.01)).toEqual(flat);
});
it('is reproducible without time or pointer state and handles zero / one assets', () => {
  const a = seeded(5), b = seeded(5); expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  expect(geometry({ ...recipe, assetIds: [] })).toEqual([]); expect(geometry({ ...recipe, assetIds: ['a'] })[0]!.width).toBeGreaterThan(.9);
});
it('only prepares visible material at its actual projection', () => {
  const many = { ...recipe, seed:1701, assetIds: Array.from({ length: 16 }, (_, i) => `${i}`) };
  const single = imageProjections({ ...many, parameters: { mosaic: { layout: 1 } } }, 2048);
  expect(single.size).toBe(1); expect(single.get('0')).toBe(2048);
  const sleeve = imageProjections({ ...many, template: 'sleeve', parameters: { sleeve: { count: 7 } } }, 2048);
  expect(sleeve.size).toBe(7); expect(sleeve.get('0')).toBe(1280);
});
