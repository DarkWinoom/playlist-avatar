import * as Slider from '@radix-ui/react-slider';
import { useEditor } from '../editor-store.ts';
import { controlsFor } from '@playlist-avatar/artwork';
import { PaletteEditor } from './PaletteEditor.tsx';
export function Adjustments({ chinese }: { chinese: boolean }) {
  const editor = useEditor(); const controls = controlsFor(editor.recipe);
  return <div className="adjustments"><h2>{chinese ? '调整' : 'Adjust'}</h2>{controls.map(({key,en,zh,value:fallback,min,max}) => { const label=chinese?zh:en; return <div className="slider-field" key={key}>
    <label id={`label-${key}`}>{label}<span>{Number(editor.recipe.parameters[editor.recipe.template]?.[key] ?? fallback)}</span></label>
    <Slider.Root className="slider" aria-labelledby={`label-${key}`} value={[Number(editor.recipe.parameters[editor.recipe.template]?.[key] ?? fallback)]} min={min} max={max} step={1}
      onPointerDown={editor.begin} onPointerUp={editor.end} onPointerCancel={editor.end} onKeyDown={editor.begin} onKeyUp={editor.end}
      onValueChange={values => editor.parameter(key, values[0]!)} onValueCommit={editor.end}>
      <Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track><Slider.Thumb className="slider-thumb" aria-label={label} />
    </Slider.Root></div>; })}
    {editor.recipe.template==='type' && <><label htmlFor="type-text">{chinese?'字形文字':'Type text'}</label><input id="type-text" value={String(editor.recipe.parameters.type?.text||'')} maxLength={12} placeholder="PA" onFocus={editor.begin} onBlur={editor.end} onChange={event=>editor.parameter('text',event.target.value)} /></>}
    <button className="quiet-button" onClick={() => editor.update({seed:crypto.getRandomValues(new Uint32Array(1))[0]!})}>{chinese ? '再来一张' : 'New variation'}</button>
    <div className="section-title">{chinese ? '配色' : 'Palette'}</div><PaletteEditor chinese={chinese} />
    <button className="quiet-button" aria-pressed={editor.recipe.paletteLocked} onClick={() => editor.update({ paletteLocked: !editor.recipe.paletteLocked })}>{chinese ? '锁定配色' : 'Lock palette'}</button>
    <button className="toggle-row" role="switch" aria-checked={editor.recipe.titleEnabled} onClick={() => editor.update({ titleEnabled: !editor.recipe.titleEnabled })}><span>{chinese ? '标题' : 'Title'}</span><span className="switch-track" data-checked={editor.recipe.titleEnabled}><span /></span></button>
    {editor.recipe.titleEnabled && <input aria-label={chinese ? '作品标题' : 'Artwork title'} maxLength={120} value={editor.recipe.title} onFocus={editor.begin} onBlur={editor.end} onChange={event => editor.update({ title: event.target.value })} />}
  </div>;
}
