import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { useEditor } from '../editor-store.ts';
const PALETTES=[['#d66641','#456f8c','#233d31','#ddbb73'],['#253342','#b5cfcc','#e3b67e','#bd583f'],['#f35e7d','#533fa8','#6dc6c3','#f5ce80'],['#25332d','#85a897','#e3e2c8','#a19d70'],['#121725','#6387f5','#b9cbef','#fc7468'],['#272727','#737373','#bcbcbc','#ededed']];
export function PaletteEditor({chinese}:{chinese:boolean}){
 const editor=useEditor(),[hex,setHex]=useState('');return <Popover.Root><Popover.Trigger asChild><button className="palette-trigger" aria-label={chinese?'编辑配色':'Edit palette'}><span className="swatches">{editor.recipe.palette.slice(0,6).map((color,i)=><i key={i} style={{background:color}} />)}</span></button></Popover.Trigger><Popover.Portal><Popover.Content className="palette-popover" sideOffset={8}>
 <h3>{chinese?'配色':'Palette'}</h3>{PALETTES.map((palette,i)=><button key={i} className="preset-palette" aria-label={`${chinese?'预设色板':'Palette preset'} ${i+1}`} onClick={()=>editor.update({palette,paletteLocked:true})}>{palette.map(color=><i key={color} style={{background:color}} />)}</button>)}
 <label htmlFor="hex-color">{chinese?'自定义颜色':'Custom color'}</label><div className="import-actions"><input id="hex-color" value={hex} maxLength={7} placeholder="#526ec9" onChange={event=>setHex(event.target.value)} /><button disabled={!/^#[\da-f]{6}$/i.test(hex)} onClick={()=>{editor.update({palette:[hex,...editor.recipe.palette.slice(1)],paletteLocked:true});setHex('');}}>{chinese?'应用':'Apply'}</button></div><Popover.Close asChild><button className="quiet-button full-width">{chinese?'关闭':'Close'}</button></Popover.Close>
 </Popover.Content></Popover.Portal></Popover.Root>;
}
