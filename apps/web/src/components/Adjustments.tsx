import * as Slider from '@radix-ui/react-slider';
import {useState,useEffect} from 'react';
import {useEditor} from '../editor-store.ts';
import {controlsFor} from '@playlist-avatar/artwork';
import {Icon} from './Icon.tsx';

export function Adjustments({chinese}:{chinese:boolean}) {
 const editor=useEditor(),[number,setNumber]=useState(String(editor.recipe.seed));
 useEffect(()=>setNumber(String(editor.recipe.seed)),[editor.recipe.seed]);
 function commit(){if(/^\d{1,10}$/.test(number)&&Number(number)<=4294967295)editor.update({seed:Number(number)});else setNumber(String(editor.recipe.seed));}
 return <div className="adjustments">
  {controlsFor(editor.recipe).map(({key,en,zh,value,min,max})=><div className="slider-field" key={key}>
   <label id={`label-${key}`}>{chinese?zh:en}<span>{Number(editor.recipe.parameters[editor.recipe.template]?.[key]??value)}</span></label>
   <Slider.Root className="slider" aria-labelledby={`label-${key}`} value={[Number(editor.recipe.parameters[editor.recipe.template]?.[key]??value)]} min={min} max={max} step={1}
    onPointerDown={editor.begin} onPointerUp={editor.end} onPointerCancel={editor.cancelGesture}
    onKeyDown={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))editor.begin();}} onKeyUp={editor.end} onBlur={editor.end}
    onValueChange={values=>editor.parameter(key,values[0]!)} onValueCommit={editor.end}>
    <Slider.Track className="slider-track"><Slider.Range className="slider-range"/></Slider.Track><Slider.Thumb className="slider-thumb" aria-label={chinese?zh:en}/>
   </Slider.Root></div>)}
  {editor.recipe.template==='type'&&<div className="type-parameter"><label htmlFor="type-text">{chinese?'字形文字':'Lettering'}</label><input id="type-text" value={String(editor.recipe.parameters.type?.text||'')} maxLength={12} placeholder="PA" onFocus={editor.begin} onBlur={editor.end} onChange={event=>editor.parameter('text',event.target.value)}/></div>}
  {!['mosaic','sleeve','wall','duo','focus','contact','strips'].includes(editor.recipe.template)&&<div className="variation-parameter"><label htmlFor="variation-number">{chinese?'构图编号':'Composition number'}</label><div className="number-stepper">
   <button aria-label={chinese?'上一种构图':'Previous composition'} onClick={()=>editor.update({seed:(editor.recipe.seed-1)>>>0})}><Icon name="arrow-left"/></button>
   <input id="variation-number" inputMode="numeric" value={number} onChange={event=>setNumber(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){commit();event.currentTarget.blur();}if(event.key==='Escape')setNumber(String(editor.recipe.seed));}}/>
   <button aria-label={chinese?'下一种构图':'Next composition'} onClick={()=>editor.update({seed:(editor.recipe.seed+1)>>>0})}><Icon name="arrow-right"/></button>
  </div></div>}
  <button className="quiet-button reset-parameters" onClick={editor.reset}><Icon name="rotate-ccw"/>{chinese?'恢复默认参数':'Reset parameters'}</button>
 </div>;
}
