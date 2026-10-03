import { useEffect, useRef, useState } from 'react';
import { translator } from './i18n.ts';
import { usePreferences } from './preferences.ts';
import { PreferencesDialog } from './components/PreferencesDialog.tsx';
import { Icon } from './components/Icon.tsx';
import { ArtworkCanvas } from './components/ArtworkCanvas.tsx';
import { Adjustments } from './components/Adjustments.tsx';
import { ExportDialog } from './components/ExportDialog.tsx';
import { identifyShare } from '@playlist-avatar/contracts';
import type { ArtworkAsset, PublicPlatform, SourceSnapshot } from '@playlist-avatar/contracts';
import { usePlaylistImport } from './import-playlist.ts';
import type { Candidate } from './import-playlist.ts';
import { LIMITS } from '@playlist-avatar/contracts';
import { errorMessage } from './error-messages.ts';
import { normalizeAsset, originalAssets } from './assets.ts';
import { useEditor } from './editor-store.ts';
import styles from './App.module.css';

let example: Promise<ArtworkAsset[]> | undefined;
function AssetImage({ asset }: { asset: ArtworkAsset }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const next = URL.createObjectURL(asset.thumbnail); setUrl(next); return () => URL.revokeObjectURL(next); }, [asset.thumbnail]);
  return url ? <img src={url} alt={asset.label} /> : null;
}
export function App() {
  const [preferences, setPreferences] = usePreferences(), [share, setShare] = useState('');
  const [platform, setPlatform] = useState<PublicPlatform | undefined>(), [circle, setCircle] = useState(false), [notice, setNotice] = useState('');
  const localInput = useRef<HTMLInputElement>(null); const applied = useRef<unknown>(undefined);
  const mutation = useRef(0); const [preparedImport, setPreparedImport] = useState<{ assets: ArtworkAsset[]; snapshot: SourceSnapshot }>();
  const importer = usePlaylistImport(), editor = useEditor();
  const chinese = preferences.locale === 'zh-CN', busy = importer.phase === 'reading' || importer.phase === 'images';
  const t = translator(preferences.locale);
  useEffect(() => { let cancelled = false; example ??= originalAssets(); void example.then(assets => {
    if (!cancelled && !useEditor.getState().recipe.assetIds.length && !useEditor.getState().revision) useEditor.getState().add(assets, undefined, true);
  }); return () => { cancelled = true; }; }, []);
  useEffect(() => {
    const result = importer.result; if (!result || applied.current === result || importer.phase !== 'ready') return;
    let cancelled = false, bytes = 0; const current = ++mutation.current, prepared: ArtworkAsset[] = [];
    void (async () => { try {
      for (const candidate of result.candidates.filter(value => value.status === 'ready').slice(0, 16)) {
        const asset = await normalizeAsset(candidate.blob!, candidate.label, false, candidate.key);
        if (cancelled || current !== mutation.current) return; bytes += asset.bytes + asset.thumbnail.size;
        if (bytes > LIMITS.candidateBytes / 2) throw new Error('RESPONSE_TOO_LARGE'); prepared.push(asset);
      }
      if (!cancelled && current === mutation.current && prepared.length) {
        const state = useEditor.getState(), pristine = state.revision <= 1 && !state.snapshot && state.recipe.assetIds.every(id => state.assets[id]?.label.startsWith('Original '));
        if (pristine) state.add(prepared, result.collection.snapshot, true); else setPreparedImport({ assets: prepared, snapshot: result.collection.snapshot });
        applied.current = result; setNotice('');
      }
    } catch { if (!cancelled) setNotice(chinese ? '素材准备失败，原作品已保留' : 'Material preparation failed; previous artwork retained'); } })();
    return () => { cancelled = true; };
  }, [importer.result, importer.phase]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, textarea, [contenteditable=true]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? useEditor.getState().redo() : useEditor.getState().undo(); }
    }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  let ambiguous = false; try { ambiguous = identifyShare(share).kind === 'platform'; } catch {}
  function startImport(input: string, source?: PublicPlatform, offset = 0) { mutation.current++; setPreparedImport(undefined); void importer.start(input, source, offset); }
  function read() { let input = share;
    try { const parsed = identifyShare(share, platform); if (parsed.kind === 'short') input = parsed.url;
      else if (parsed.kind === 'playlist') { startImport(parsed.id, parsed.source); return; } } catch {}
    startImport(input, platform);
  }
  async function local(files: FileList | null) {
    if (!files) return; const current = ++mutation.current; importer.cancel(); setPreparedImport(undefined); setNotice(chinese ? '正在准备图片…' : 'Preparing images…');
    try { const assets: ArtworkAsset[] = []; let bytes = 0; for (const file of [...files].slice(0, 16)) { const asset = await normalizeAsset(file, file.name, true); if (current !== mutation.current) return;
      bytes += asset.bytes + asset.thumbnail.size; if (bytes > LIMITS.candidateBytes / 2) throw new Error('RESPONSE_TOO_LARGE'); assets.push(asset); }
      if (current === mutation.current) { useEditor.getState().add(assets); setNotice(''); } }
    catch (error) { if (current === mutation.current) setNotice(error instanceof Error && error.message === 'RESPONSE_TOO_LARGE' ? (chinese ? '图片超出大小或素材预算' : 'Image or material budget exceeded') : (chinese ? '图片无法读取，请选 PNG、JPG 或 WebP' : 'Use a valid PNG, JPG or WebP image')); }
    finally { if (localInput.current) localInput.current.value = ''; }
  }
  async function chooseCandidate(candidate: Candidate) { const current = ++mutation.current; importer.cancel(); setPreparedImport(undefined);
    try { const asset = await normalizeAsset(candidate.blob!, candidate.label, false, candidate.key); if (current === mutation.current) editor.add([asset]); }
    catch { if (current === mutation.current) setNotice(chinese ? '素材预算已满，请先保存作品' : 'Material budget reached; save your artwork first'); }
  }
  return <div className={styles.app}>
    <header className={styles.header}><div className={styles.brand}><Icon name="grid" /><span>Playlist Avatar</span></div>
      <div className={styles.headerActions}><span className={styles.sourceBadge}>{editor.snapshot?.title || t('example')}</span><ExportDialog chinese={chinese} /><PreferencesDialog value={preferences} onChange={setPreferences} /></div></header>
    <main className={styles.workspace}>
      <aside className={styles.left}><h1>{t('create')}</h1><label htmlFor="share">{t('playlist')}</label>
        <textarea id="share" value={share} onChange={event => setShare(event.target.value)} placeholder={t('playlistPlaceholder')} rows={3} />
        {ambiguous && <div className="segmented import-platform" aria-label={chinese ? '选择平台' : 'Choose platform'}>{(['netease', 'qqmusic'] as const).map(value => <button key={value} aria-pressed={platform === value} onClick={() => setPlatform(value)}>{value === 'netease' ? '网易云' : 'QQ Music'}</button>)}</div>}
        <div className="import-actions"><button className="primary-button" disabled={!share.trim() || (ambiguous && !platform)} onClick={read}>{chinese ? '读取歌单' : 'Read playlist'}</button>{busy && <button className="quiet-button" onClick={importer.cancel}>{chinese ? '取消' : 'Cancel'}</button>}</div>
        <div className="import-status" role={importer.phase === 'error' ? 'alert' : 'status'}>{importer.phase === 'reading' ? (chinese ? '正在读取…' : 'Reading…') : importer.phase === 'images' ? `${chinese ? '准备封面' : 'Preparing covers'} ${importer.prepared} / ${importer.total}` : importer.phase === 'cancelled' ? (chinese ? '已取消读取' : 'Reading cancelled') : importer.error ? errorMessage(importer.error, preferences.locale) : importer.result ? `${importer.result.collection.tracks.length} ${chinese ? '首 · ' : 'tracks · '}${importer.result.candidates.filter(value => value.status === 'ready').length} ${chinese ? '张封面' : 'covers'}` : ''}</div>
        {importer.pending && <div className="import-status">{importer.pending.collection.snapshot.title} · {chinese ? '封面不可用，可换用本地图片' : 'Covers unavailable; choose local images'}</div>}
        {preparedImport && <button className="primary-button full-width" onClick={() => { try { editor.add(preparedImport.assets, preparedImport.snapshot, true); setPreparedImport(undefined); } catch { setNotice(chinese ? '素材预算已满，请先保存作品' : 'Material budget reached; save your artwork first'); } }}>{chinese ? '应用到作品' : 'Apply to artwork'}</button>}
        {importer.result && !importer.result.collection.snapshot.coverage.complete && <div className="import-status">{chinese ? '已读范围 ' : 'Read range '}{importer.result.collection.snapshot.coverage.offset}–{importer.result.collection.snapshot.coverage.offset + importer.result.collection.tracks.length}{importer.result.collection.snapshot.coverage.knownTotal !== undefined ? ` / ${importer.result.collection.snapshot.coverage.knownTotal}` : (chinese ? ' · 总量未确认' : ' · Total unverified')}
          {importer.result.collection.snapshot.coverage.limitReason === 'budget' && importer.result.collection.snapshot.coverage.knownTotal !== undefined && importer.result.collection.snapshot.coverage.offset + importer.result.collection.tracks.length < importer.result.collection.snapshot.coverage.knownTotal && <button className="quiet-button" onClick={() => { const s = importer.result!.collection.snapshot; if (s.source === 'netease' || s.source === 'qqmusic') startImport(s.collectionId, s.source, s.coverage.offset + importer.result!.collection.tracks.length); }}>{chinese ? '读取下一段' : 'Read next range'}</button>}</div>}
        <button className="quiet-button full-width" onClick={() => localInput.current?.click()}>{chinese ? '添加本地图片' : 'Add local images'}</button><input ref={localInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label={chinese ? '本地图片文件' : 'Local image files'} onChange={event => void local(event.target.files)} />
        <div className={styles.sectionTitle}>{t('templates')}</div><div className="template-list">{(['mosaic', 'sleeve'] as const).map(id => <button key={id} className={styles.templateCard} aria-pressed={editor.recipe.template === id} onClick={() => editor.template(id)}><span className={`${styles.miniature} ${id}`}><i /><i /><i /><i /></span><span>{id === 'mosaic' ? 'Mosaic' : 'Sleeve'}</span></button>)}</div>
      </aside>
      <section className={styles.stage} aria-label={chinese ? '作品预览' : 'Artwork preview'}><div className={styles.stageLabel}><span>{editor.recipe.template === 'sleeve' ? 'Sleeve' : 'Mosaic'}</span><span>{t('unsaved')}</span></div>
        <ArtworkCanvas recipe={editor.recipe} assets={editor.assets} reduce={preferences.reduceMotion} circle={circle} direct={!!editor.gesture} />
        <div className="canvas-toolbar"><div className="segmented"><button aria-pressed={!circle} onClick={() => setCircle(false)}>{chinese ? '方形' : 'Square'}</button><button aria-pressed={circle} onClick={() => setCircle(true)}>{chinese ? '圆形' : 'Circle'}</button></div><button disabled={!editor.past.length} onClick={editor.undo}>{chinese ? '撤销' : 'Undo'}</button><button disabled={!editor.future.length} onClick={editor.redo}>{chinese ? '重做' : 'Redo'}</button></div>
        <p role="status" className="import-status">{notice}</p>
        <div className="materials-heading"><span>{chinese ? '素材' : 'Materials'} · {editor.recipe.assetIds.length} / 16</span></div>
        <div className="selected-grid">{editor.recipe.assetIds.map((id, index) => <div className="selected-asset" key={id}><button aria-label={`${chinese ? '取消选择' : 'Deselect'} ${editor.assets[id]?.label}`} onClick={() => editor.select(id)}>{editor.assets[id] && <AssetImage asset={editor.assets[id]!} />}</button><div><button disabled={index === 0} aria-label={`${chinese ? '前移' : 'Move earlier'} ${index + 1}`} onClick={() => editor.reorder(index, -1)}>←</button><button disabled={index === editor.recipe.assetIds.length - 1} aria-label={`${chinese ? '后移' : 'Move later'} ${index + 1}`} onClick={() => editor.reorder(index, 1)}>→</button></div></div>)}</div>
        {!!importer.result && <details className="candidates-panel"><summary>{chinese ? '候选封面' : 'Candidate covers'}</summary><div className="candidate-grid">{importer.result.candidates.map(value => <button key={value.key} className="candidate" title={value.label} disabled={!value.blob} aria-label={`${chinese ? '添加' : 'Add'} ${value.label}`} onClick={() => void chooseCandidate(value)}>{value.url ? <img src={value.url} alt={value.label} /> : <span>{value.status === 'budget' ? (chinese ? '未准备' : 'Not prepared') : (chinese ? '缺图' : 'Missing')}</span>}</button>)}</div></details>}
      </section>
      <aside className={styles.right}><Adjustments chinese={chinese} /></aside>
    </main>
  </div>;
}
