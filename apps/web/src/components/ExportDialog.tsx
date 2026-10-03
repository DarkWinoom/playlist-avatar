import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useEditor } from '../editor-store.ts';
import { download, exportArtwork } from '../export.ts';
export function ExportDialog({ chinese }: { chinese: boolean }) {
  const [size, setSize] = useState<512 | 1024 | 2048>(1024), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [output, setOutput] = useState<{ url: string; name: string; bytes: number; milliseconds: number }>();
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  async function generate() { setBusy(true); setStatus(chinese ? '正在生成…' : 'Rendering…');
    try { const start = performance.now(), { recipe, assets } = useEditor.getState(); const blob = await exportArtwork(recipe, assets, { format: 'image/png', size, transparent: false, circle: false, background: '#ffffff', quality: .92 });
      const name = `playlist-avatar-${recipe.template}-${size}.png`; setOutput({ url: URL.createObjectURL(blob), name, bytes: blob.size, milliseconds: Math.round(performance.now() - start) });
      download(blob, name); setStatus(chinese ? '已生成，下载已发起' : 'Ready; download started'); }
    catch { setStatus(chinese ? '导出失败，请重试' : 'Export failed. Try again.'); } finally { setBusy(false); }
  }
  return <Dialog.Root><Dialog.Trigger asChild><button className="primary-button">{chinese ? '导出' : 'Export'}</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content" aria-describedby={undefined}>
    <div className="dialog-heading"><Dialog.Title>{chinese ? '导出作品' : 'Export artwork'}</Dialog.Title><Dialog.Close asChild><button className="quiet-button">{chinese ? '关闭' : 'Close'}</button></Dialog.Close></div>
    <fieldset><legend>{chinese ? '尺寸' : 'Size'}</legend><div className="segmented">{([512, 1024, 2048] as const).map(value => <button key={value} aria-pressed={size === value} onClick={() => setSize(value)}>{value}</button>)}</div></fieldset>
    <button className="primary-button full-width" disabled={busy} onClick={() => void generate()}>{busy ? (chinese ? '生成中…' : 'Rendering…') : (chinese ? '下载 PNG' : 'Download PNG')}</button><p className="import-status" role="status">{status}</p>
    {output && <div className="export-result" data-bytes={output.bytes} data-milliseconds={output.milliseconds}><img src={output.url} alt={chinese ? '实际导出预览' : 'Actual export preview'} /><a href={output.url} download={output.name}>{chinese ? '保存 PNG 文件' : 'Save PNG file'}</a></div>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
