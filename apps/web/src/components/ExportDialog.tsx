import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useEditor } from '../editor-store.ts';
import { download, exportArtwork } from '../export.ts';
import type { ExportOptions } from '@playlist-avatar/contracts';
export function ExportDialog({ chinese,name:projectName }: { chinese: boolean;name?:string }) {
  const [size, setSize] = useState<512 | 1024 | 2048>(1024), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [format,setFormat]=useState<ExportOptions['format']>('image/png'),[transparent,setTransparent]=useState(false),[circle,setCircle]=useState(false),[background,setBackground]=useState('#ffffff'),[quality,setQuality]=useState(.92);
  const [output, setOutput] = useState<{ url: string; name: string; bytes: number; milliseconds: number;type:string }>();
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  async function generate() { setBusy(true); setStatus(chinese ? '正在生成…' : 'Rendering…');
    try { const start = performance.now(), { recipe, assets } = useEditor.getState(); const blob = await exportArtwork(recipe, assets, { format, size, transparent:transparent&&format!=='image/jpeg', circle, background, quality });
      const slug=(projectName||recipe.title||'playlist-avatar').normalize().replace(/[^\p{L}\p{N}_ -]/gu,'').slice(0,60)||'playlist-avatar';const ext=format==='image/jpeg'?'jpg':format==='image/webp'?'webp':'png';
      const name = `${slug}-${recipe.template}-${size}-${new Date().toISOString().slice(0,10)}.${ext}`; setOutput({ url: URL.createObjectURL(blob), name, bytes: blob.size, milliseconds: Math.round(performance.now() - start),type:format });
      download(blob, name); setStatus(chinese ? `已生成 ${ext.toUpperCase()}，下载已发起` : `${ext.toUpperCase()} ready; download started`); }
    catch(error) { setStatus(error instanceof Error&&error.message==='UNSUPPORTED_FORMAT'?(chinese?'此浏览器不支持该编码，请选 PNG':'This encoder is unavailable. Choose PNG.'):(chinese ? '导出失败，请重试或选择较小尺寸' : 'Export failed. Try a smaller size.')); } finally { setBusy(false); }
  }
  return <Dialog.Root><Dialog.Trigger asChild><button className="primary-button">{chinese ? '导出' : 'Export'}</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content" aria-describedby={undefined}>
    <div className="dialog-heading"><Dialog.Title>{chinese ? '导出作品' : 'Export artwork'}</Dialog.Title><Dialog.Close asChild><button className="quiet-button">{chinese ? '关闭' : 'Close'}</button></Dialog.Close></div>
    <fieldset><legend>{chinese ? '尺寸' : 'Size'}</legend><div className="segmented">{([512, 1024, 2048] as const).map(value => <button key={value} aria-pressed={size === value} onClick={() => setSize(value)}>{value}</button>)}</div></fieldset>
    <fieldset><legend>{chinese?'格式':'Format'}</legend><div className="segmented">{(['image/png','image/jpeg','image/webp']as const).map(type=><button key={type} aria-pressed={format===type} onClick={()=>setFormat(type)}>{type==='image/jpeg'?'JPG':type.split('/')[1]!.toUpperCase()}</button>)}</div></fieldset>
    <div className="export-toggles"><button role="checkbox" aria-checked={transparent&&format!=='image/jpeg'} disabled={format==='image/jpeg'} onClick={()=>setTransparent(!transparent)}>{chinese?'透明背景':'Transparent background'}</button><button role="checkbox" aria-checked={circle} onClick={()=>setCircle(!circle)}>{chinese?'圆形裁切':'Circular crop'}</button></div>
    {!transparent||format==='image/jpeg'?<><label htmlFor="export-background">{chinese?'底色':'Background'}</label><input id="export-background" value={background} maxLength={7} onChange={event=>setBackground(event.target.value)}/></>:null}
    {format!=='image/png'&&<div className="segmented" aria-label={chinese?'品质':'Quality'}>{[.8,.92,1].map(value=><button key={value} aria-pressed={quality===value} onClick={()=>setQuality(value)}>{Math.round(value*100)}%</button>)}</div>}
    <button className="primary-button full-width" disabled={busy||!/^#[\da-f]{6}$/i.test(background)} onClick={() => void generate()}>{busy ? (chinese ? '生成中…' : 'Rendering…') : `${chinese?'下载':'Download'} ${format==='image/jpeg'?'JPG':format.split('/')[1]!.toUpperCase()}`}</button><p className="import-status" role="status">{status}</p>
    {output && <div className="export-result" data-format={output.type} data-bytes={output.bytes} data-milliseconds={output.milliseconds}><img src={output.url} alt={chinese ? '实际导出预览' : 'Actual export preview'} /><a href={output.url} download={output.name}>{chinese ? '保存图片文件' : 'Save image file'}</a></div>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
