import * as Slider from '@radix-ui/react-slider';
import { useEditor } from '../editor-store.ts';
import { seeded } from '@playlist-avatar/artwork';
export function Adjustments({ chinese }: { chinese: boolean }) {
  const editor = useEditor(); const sleeve = editor.recipe.template === 'sleeve';
  const controls = sleeve ? [['spread', chinese ? '展开度' : 'Spread', 55, 0, 100], ['rotation', chinese ? '旋转' : 'Rotation', 0, -50, 50]] as const
    : [['layout', chinese ? '布局' : 'Grid', Math.ceil(Math.sqrt(Math.max(1, editor.recipe.assetIds.length))), 1, 4], ['gap', chinese ? '间距' : 'Gap', 3, 0, 15], ['radius', chinese ? '圆角' : 'Corners', 0, 0, 25]] as const;
  return <div className="adjustments"><h2>{chinese ? '调整' : 'Adjust'}</h2>{controls.map(([key, label, fallback, min, max]) => <div className="slider-field" key={key}>
    <label id={`label-${key}`}>{label}<span>{Number(editor.recipe.parameters[editor.recipe.template]?.[key] ?? fallback)}</span></label>
    <Slider.Root className="slider" aria-labelledby={`label-${key}`} value={[Number(editor.recipe.parameters[editor.recipe.template]?.[key] ?? fallback)]} min={min} max={max} step={1}
      onPointerDown={editor.begin} onPointerUp={editor.end} onPointerCancel={editor.end} onKeyDown={editor.begin} onKeyUp={editor.end}
      onValueChange={values => editor.parameter(key, values[0]!)} onValueCommit={editor.end}>
      <Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track><Slider.Thumb className="slider-thumb" aria-label={label} />
    </Slider.Root></div>)}
    <button className="quiet-button" onClick={() => { const seed = crypto.getRandomValues(new Uint32Array(1))[0]!, random = seeded(seed), assetIds = [...editor.recipe.assetIds];
      for (let i = assetIds.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [assetIds[i], assetIds[j]] = [assetIds[j]!, assetIds[i]!]; } editor.update({ seed, assetIds }); }}>{chinese ? '再来一张' : 'New variation'}</button>
    <div className="section-title">{chinese ? '配色' : 'Palette'}</div><div className="swatches">{editor.recipe.palette.map((color, i) => <button key={i} style={{ background: color }} aria-label={`${chinese ? '色彩' : 'Color'} ${i + 1}: ${color}`} onClick={() => editor.update({ palette: [...editor.recipe.palette.slice(1), editor.recipe.palette[0]!] })} />)}</div>
    <button className="quiet-button" aria-pressed={editor.recipe.paletteLocked} onClick={() => editor.update({ paletteLocked: !editor.recipe.paletteLocked })}>{chinese ? '锁定配色' : 'Lock palette'}</button>
    <button className="toggle-row" role="switch" aria-checked={editor.recipe.titleEnabled} onClick={() => editor.update({ titleEnabled: !editor.recipe.titleEnabled })}><span>{chinese ? '标题' : 'Title'}</span><span className="switch-track" data-checked={editor.recipe.titleEnabled}><span /></span></button>
    {editor.recipe.titleEnabled && <input aria-label={chinese ? '作品标题' : 'Artwork title'} maxLength={120} value={editor.recipe.title} onFocus={editor.begin} onBlur={editor.end} onChange={event => editor.update({ title: event.target.value })} />}
  </div>;
}
