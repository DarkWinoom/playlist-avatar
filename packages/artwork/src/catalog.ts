import type { Recipe, TemplateId } from '@playlist-avatar/contracts';
export interface Control { key: string; en: string; zh: string; value: number; min: number; max: number; step?: number }
export const CATALOG: { id: TemplateId; en: string; zh: string; group: number; controls: Control[] }[] = [
  { id:'mosaic',en:'Mosaic',zh:'拼贴',group:0,controls:[{key:'layout',en:'Grid',zh:'布局',value:2,min:1,max:4},{key:'gap',en:'Gap',zh:'间距',value:3,min:0,max:15},{key:'radius',en:'Corners',zh:'圆角',value:0,min:0,max:25}] },
  { id:'sleeve',en:'Sleeve',zh:'唱片套',group:0,controls:[{key:'spread',en:'Spread',zh:'展开度',value:55,min:0,max:100},{key:'rotation',en:'Rotation',zh:'旋转',value:0,min:-50,max:50},{key:'count',en:'Sleeves',zh:'唱片套数',value:5,min:1,max:7}] },
  { id:'disc',en:'Disc',zh:'唱片',group:0,controls:[{key:'scale',en:'Disc size',zh:'圆盘比例',value:65,min:40,max:85},{key:'offset',en:'Offset',zh:'偏移',value:55,min:20,max:80},{key:'texture',en:'Grooves',zh:'刻纹',value:55,min:0,max:100}] },
  { id:'wall',en:'Wall',zh:'封面墙',group:0,controls:[{key:'perspective',en:'Perspective',zh:'透视',value:60,min:0,max:100},{key:'density',en:'Density',zh:'密度',value:12,min:6,max:16},{key:'focus',en:'Focus',zh:'主图',value:0,min:0,max:15}] },
  { id:'film',en:'Film',zh:'胶片',group:1,controls:[{key:'frames',en:'Frames',zh:'窗格',value:3,min:1,max:4},{key:'exposure',en:'Exposure',zh:'曝光',value:50,min:0,max:100},{key:'grain',en:'Grain',zh:'颗粒',value:30,min:0,max:100}] },
  { id:'riso',en:'Riso',zh:'孔版',group:1,controls:[{key:'inks',en:'Inks',zh:'油墨',value:3,min:2,max:3},{key:'offset',en:'Registration',zh:'错版',value:40,min:0,max:100},{key:'grain',en:'Texture',zh:'纹理',value:50,min:0,max:100}] },
  { id:'halftone',en:'Halftone',zh:'网点',group:1,controls:[{key:'dots',en:'Dots',zh:'网点',value:28,min:16,max:64},{key:'contrast',en:'Contrast',zh:'对比',value:60,min:0,max:100},{key:'color',en:'Ink',zh:'油墨色',value:2,min:0,max:7}] },
  { id:'type',en:'Type',zh:'字形',group:1,controls:[{key:'weight',en:'Weight',zh:'字重',value:80,min:30,max:90},{key:'layout',en:'Layout',zh:'构图',value:0,min:0,max:2},{key:'offset',en:'Offset',zh:'错位',value:30,min:0,max:100}] },
  { id:'aura',en:'Aura',zh:'光晕',group:2,controls:[{key:'spread',en:'Diffusion',zh:'扩散',value:60,min:20,max:100},{key:'core',en:'Core',zh:'光核',value:55,min:0,max:100},{key:'grain',en:'Grain',zh:'颗粒',value:30,min:0,max:100}] },
  { id:'orbit',en:'Orbit',zh:'轨道',group:2,controls:[{key:'density',en:'Density',zh:'密度',value:7,min:3,max:12},{key:'space',en:'Space',zh:'留白',value:50,min:0,max:100},{key:'eccentricity',en:'Eccentricity',zh:'偏心',value:50,min:0,max:100}] },
  { id:'pulse',en:'Pulse',zh:'律动',group:2,controls:[{key:'rhythm',en:'Rhythm',zh:'节奏',value:12,min:5,max:24},{key:'direction',en:'Direction',zh:'方向',value:25,min:0,max:100},{key:'amplitude',en:'Amplitude',zh:'幅度',value:65,min:0,max:100}] },
  { id:'terrain',en:'Terrain',zh:'地形',group:2,controls:[{key:'layers',en:'Layers',zh:'层数',value:12,min:5,max:24},{key:'relief',en:'Relief',zh:'起伏',value:60,min:0,max:100},{key:'color',en:'Color offset',zh:'色彩偏移',value:0,min:0,max:7}] },
  { id:'chrome',en:'Chrome',zh:'液态金属',group:3,controls:[{key:'flow',en:'Flow',zh:'流动',value:50,min:0,max:100},{key:'iridescence',en:'Iridescence',zh:'虹彩',value:65,min:0,max:100},{key:'twist',en:'Twist',zh:'扭转',value:50,min:0,max:100}] },
  { id:'prism',en:'Prism',zh:'棱镜',group:3,controls:[{key:'facets',en:'Facets',zh:'切面',value:5,min:3,max:8},{key:'dispersion',en:'Dispersion',zh:'色散',value:60,min:0,max:100},{key:'direction',en:'Direction',zh:'方向',value:40,min:0,max:100}] },
  { id:'glass',en:'Glass',zh:'琉璃',group:3,controls:[{key:'layers',en:'Layers',zh:'层数',value:3,min:1,max:4},{key:'refraction',en:'Refraction',zh:'折射',value:55,min:0,max:100},{key:'radius',en:'Corners',zh:'圆角',value:45,min:0,max:100}] },
  { id:'eclipse',en:'Eclipse',zh:'日蚀',group:3,controls:[{key:'halo',en:'Halo',zh:'光环',value:60,min:0,max:100},{key:'offset',en:'Offset',zh:'偏移',value:25,min:-60,max:60},{key:'brightness',en:'Brightness',zh:'亮度',value:65,min:0,max:100}] },
];
export const FEATURED: TemplateId[] = ['mosaic','sleeve','disc','film','aura','orbit','glass','eclipse'];
export function controlsFor(recipe: Recipe) {
  return CATALOG.find(item => item.id === recipe.template)!.controls.map(control => ({ ...control,
    value: recipe.template === 'mosaic' && control.key === 'layout' ? Math.ceil(Math.sqrt(Math.max(1, recipe.assetIds.length))) : control.value }));
}
