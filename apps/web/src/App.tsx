import { useEffect, useRef, useState } from 'react';
import { translator } from './i18n.ts';
import { usePreferences } from './preferences.ts';
import { PreferencesDialog } from './components/PreferencesDialog.tsx';
import { Icon } from './components/Icon.tsx';
import { ArtworkCanvas } from './components/ArtworkCanvas.tsx';
import { Adjustments } from './components/Adjustments.tsx';
import { ExportDialog } from './components/ExportDialog.tsx';
import { TemplateLibrary } from './components/TemplateLibrary.tsx';
import { AnimatedName } from './components/AnimatedName.tsx';
import { CATALOG } from '@playlist-avatar/artwork';
import { MotionConfig } from 'motion/react';
import { MobileSheet,useCompact } from './components/MobileSheet.tsx';
import { LibraryDialog } from './components/LibraryDialog.tsx';
import { ClearDataDialog } from './components/ClearDataDialog.tsx';
import { useWorkspacePersistence } from './workspace-persistence.ts';
import { browserLocale } from './i18n.ts';
import {repository}from'./repository.ts';
import {serializedStorage}from'./storage-coordinator.ts';
import {AdvancedDialog}from'./components/AdvancedDialog.tsx';
import {MaterialControls}from'./components/MaterialControls.tsx';
import { identifyShare } from '@playlist-avatar/contracts';
import type { ArtworkAsset, PublicPlatform, SourceSnapshot } from '@playlist-avatar/contracts';
import { usePlaylistImport } from './import-playlist.ts';
import type { Candidate } from './import-playlist.ts';
import { LIMITS } from '@playlist-avatar/contracts';
import { errorMessage } from './error-messages.ts';
import { normalizeAsset } from './assets.ts';
import { prepareImport } from './prepare-import.ts';
import { readEnd,canReadNext } from './read-range.ts';
import { useEditor } from './editor-store.ts';
import styles from './App.module.css';

function AssetImage({ asset }: { asset: ArtworkAsset }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const next = URL.createObjectURL(asset.thumbnail); setUrl(next); return () => URL.revokeObjectURL(next); }, [asset.thumbnail]);
  return url ? <img src={url} alt={asset.label} /> : null;
}
export function App() {
  const [preferences, setPreferences,effectiveReduced] = usePreferences(), [share, setShare] = useState('');
  const [platform, setPlatform] = useState<PublicPlatform | undefined>(), [circle, setCircle] = useState(false), [notice, setNotice] = useState('');
  const [checks,setChecks]=useState(false);
  const localInput = useRef<HTMLInputElement>(null); const applied = useRef<unknown>(undefined);
  const mutation = useRef(0); const [preparedImport, setPreparedImport] = useState<{ assets: ArtworkAsset[]; snapshot: SourceSnapshot }>();
  const importer = usePlaylistImport(), editor = useEditor();
  const chinese = preferences.locale === 'zh-CN', busy = importer.phase === 'reading' || importer.phase === 'images';
  const persistence=useWorkspacePersistence(chinese,mutation),[clearData,setClearData]=useState(false);
  async function openProject(id:string){mutation.current++;importer.cancel();setPreparedImport(undefined);await persistence.open(id);}
  async function importPackage(file:Blob,signal:AbortSignal){const token=++mutation.current,revision=useEditor.getState().revision;importer.cancel();setPreparedImport(undefined);persistence.cancelWrites();
    const controller=new AbortController(),abort=()=>controller.abort();if(signal.aborted)abort();signal.addEventListener('abort',abort,{once:true});
    const unsubscribe=useEditor.subscribe(state=>{if(state.revision!==revision)controller.abort();});
    try{const {restorePackage}=await import('./project-package.ts');const value=await restorePackage(file,controller.signal);if(controller.signal.aborted||token!==mutation.current||revision!==useEditor.getState().revision)throw new Error('CANCELLED');
      const now=new Date().toISOString(),project={...value.project,id:`project:${crypto.randomUUID()}`,createdAt:now,updatedAt:now};await serializedStorage(()=>{if(controller.signal.aborted||token!==mutation.current||revision!==useEditor.getState().revision)throw new Error('CANCELLED');return repository().save(project,value.assets,undefined,LIMITS.projectBytes,controller.signal);});
      if(!controller.signal.aborted&&token===mutation.current&&revision===useEditor.getState().revision){unsubscribe();editor.load(project.recipe,value.assets,project.snapshot);persistence.setCurrent(project);}
    }finally{unsubscribe();signal.removeEventListener('abort',abort);}}
  const t = translator(preferences.locale);
  const compact=useCompact();const [panel,setPanel]=useState<'import'|'templates'|'materials'|'adjust'>();
  const lastPanel=useRef('import');function openPanel(id:'import'|'templates'|'materials'|'adjust'){lastPanel.current=id;setPanel(id);}
  useEffect(() => {
    const result = importer.result; if (!result || applied.current === result || importer.phase !== 'ready') return;
    let cancelled = false; const current = ++mutation.current;
    void (async () => { try {
      const {assets:prepared,skipped}=await prepareImport(result.candidates,()=>cancelled||current!==mutation.current);
      if (!cancelled && current === mutation.current && prepared.length) {
        const state = useEditor.getState(), pristine = state.revision <= 1 && !state.snapshot && state.recipe.assetIds.every(id => state.assets[id]?.label.startsWith('Original '));
        if (pristine) state.add(prepared, result.collection.snapshot, true); else setPreparedImport({ assets: prepared, snapshot: result.collection.snapshot });
        applied.current = result; setNotice(skipped?(chinese?`已跳过 ${skipped} 张不可用或超出预算的封面`:`Skipped ${skipped} unavailable or over-budget covers`):'');
      } else if(!cancelled&&current===mutation.current)setNotice(chinese?'封面无法准备，原作品已保留':'Covers could not be prepared; previous artwork retained');
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
  async function advancedImport(route:string,body:unknown,token?:string){mutation.current++;setPreparedImport(undefined);await importer.request(route,body,token);}
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
    try { const asset = await normalizeAsset(candidate.blob!, candidate.label, false, candidate.key); if (current === mutation.current) editor.add([{...asset,order:candidate.order,statistics:candidate.statistics}]); }
    catch { if (current === mutation.current) setNotice(chinese ? '素材预算已满，请先保存作品' : 'Material budget reached; save your artwork first'); }
  }
  const sourceControls=<>
<label htmlFor="share">{t('playlist')}</label>
        <textarea id="share" value={share} onChange={event => setShare(event.target.value)} placeholder={t('playlistPlaceholder')} rows={3} />
        {ambiguous && <div className="segmented import-platform" aria-label={chinese ? '选择平台' : 'Choose platform'}>{(['netease', 'qqmusic'] as const).map(value => <button key={value} aria-pressed={platform === value} onClick={() => setPlatform(value)}>{value === 'netease' ? '网易云' : 'QQ Music'}</button>)}</div>}
        <div className="import-actions"><button className="primary-button" disabled={!share.trim() || (ambiguous && !platform)} onClick={read}>{chinese ? '读取歌单' : 'Read playlist'}</button>{busy && <button className="quiet-button" onClick={importer.cancel}>{chinese ? '取消' : 'Cancel'}</button>}</div>
        <div className="import-status" role={importer.phase === 'error' ? 'alert' : 'status'}>{importer.phase === 'reading' ? (chinese ? '正在读取…' : 'Reading…') : importer.phase === 'images' ? `${chinese ? '准备封面' : 'Preparing covers'} ${importer.prepared} / ${importer.total}` : importer.phase === 'cancelled' ? (chinese ? '已取消读取' : 'Reading cancelled') : importer.error ? errorMessage(importer.error, preferences.locale) : importer.result ? `${importer.result.collection.tracks.length} ${chinese ? '首 · ' : 'tracks · '}${importer.result.candidates.filter(value => value.status === 'ready').length} ${chinese ? '张封面' : 'covers'}` : ''}</div>
        {importer.pending && <div className="import-status">{importer.pending.collection.snapshot.title} · {chinese ? '封面不可用，可换用本地图片' : 'Covers unavailable; choose local images'}</div>}
        {preparedImport && <button className="primary-button full-width" onClick={() => { try { editor.add(preparedImport.assets, preparedImport.snapshot, true); setPreparedImport(undefined); } catch { setNotice(chinese ? '素材预算已满，请先保存作品' : 'Material budget reached; save your artwork first'); } }}>{chinese ? '应用到作品' : 'Apply to artwork'}</button>}
        {importer.result && !importer.result.collection.snapshot.coverage.complete && <div className="import-status">{chinese ? '已读范围 ' : 'Read range '}{importer.result.collection.snapshot.coverage.offset}–{readEnd(importer.result.collection.snapshot.coverage)}{importer.result.collection.snapshot.coverage.knownTotal !== undefined ? ` / ${importer.result.collection.snapshot.coverage.knownTotal}` : (chinese ? ' · 总量未确认' : ' · Total unverified')}
          {canReadNext(importer.result.collection.snapshot) && <button className="quiet-button" onClick={() => { const s = importer.result!.collection.snapshot; if (s.source === 'netease' || s.source === 'qqmusic') startImport(s.collectionId, s.source, readEnd(s.coverage)); }}>{chinese ? '读取下一段' : 'Read next range'}</button>}</div>}
        <button className="quiet-button full-width" onClick={() => localInput.current?.click()}>{chinese ? '添加本地图片' : 'Add local images'}</button><input ref={localInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label={chinese ? '本地图片文件' : 'Local image files'} onChange={event => void local(event.target.files)} />
        <AdvancedDialog chinese={chinese} read={advancedImport} cancel={()=>{mutation.current++;importer.cancel();setPreparedImport(undefined);}}/>
  </>;
  const materialsControls=<>
        <div className="materials-heading"><span>{chinese ? '素材' : 'Materials'} · {editor.recipe.assetIds.length} / 16</span></div><MaterialControls chinese={chinese}/>
        <div className="selected-grid">{editor.recipe.assetIds.map((id, index) => <div className="selected-asset" key={id}><button aria-label={`${chinese ? '取消选择' : 'Deselect'} ${editor.assets[id]?.label}`} onClick={() => editor.select(id)}>{editor.assets[id] && <AssetImage asset={editor.assets[id]!} />}</button><div><button disabled={index === 0} aria-label={`${chinese ? '前移' : 'Move earlier'} ${index + 1}`} onClick={() => editor.reorder(index, -1)}>←</button><button disabled={index === editor.recipe.assetIds.length - 1} aria-label={`${chinese ? '后移' : 'Move later'} ${index + 1}`} onClick={() => editor.reorder(index, 1)}>→</button></div></div>)}</div>
        {!!importer.result && <details className="candidates-panel"><summary>{chinese ? '候选封面' : 'Candidate covers'}</summary><div className="candidate-grid">{importer.result.candidates.map(value => <button key={value.key} className="candidate" title={value.label} disabled={!value.blob} aria-label={`${chinese ? '添加' : 'Add'} ${value.label}`} onClick={() => void chooseCandidate(value)}>{value.url ? <img src={value.url} alt={value.label} /> : <span>{value.status === 'budget' ? (chinese ? '未准备' : 'Not prepared') : (chinese ? '缺图' : 'Missing')}</span>}</button>)}</div></details>}
  </>;
  return <MotionConfig reducedMotion={effectiveReduced?'always':'user'}><div className={styles.app}>
    <header className={styles.header}><div className={styles.brand}><Icon name="grid" /><span>Playlist Avatar</span></div>
      <div className={styles.headerActions}><span className={styles.sourceBadge}>{persistence.current?.name||editor.snapshot?.title || t('example')}</span><LibraryDialog chinese={chinese} save={persistence.save} open={openProject} current={persistence.current} onClear={()=>setClearData(true)} importPackage={importPackage}/><ExportDialog chinese={chinese} name={persistence.current?.name}/><PreferencesDialog value={preferences} onChange={setPreferences} /></div></header>
    <main className={styles.workspace}>
      {!compact&&<aside className={styles.left}><h1>{t('create')}</h1>{sourceControls}
        <TemplateLibrary chinese={chinese} reduce={effectiveReduced} />
      </aside>}
      <section className={styles.stage} aria-label={chinese ? '作品预览' : 'Artwork preview'}><div className={styles.stageLabel}><AnimatedName value={CATALOG.find(item=>item.id===editor.recipe.template)!.en} reduce={effectiveReduced} /><span role="status">{persistence.label}</span></div>
        <ArtworkCanvas recipe={editor.recipe} assets={editor.assets} reduce={effectiveReduced} circle={circle} direct={!!editor.gesture} checks={checks} />
        <div className="canvas-toolbar"><div className="segmented"><button aria-pressed={!circle} onClick={() => setCircle(false)}>{chinese ? '方形' : 'Square'}</button><button aria-pressed={circle} onClick={() => setCircle(true)}>{chinese ? '圆形' : 'Circle'}</button></div><button disabled={!editor.past.length} onClick={editor.undo}>{chinese ? '撤销' : 'Undo'}</button><button disabled={!editor.future.length} onClick={editor.redo}>{chinese ? '重做' : 'Redo'}</button></div>
        <button className="quiet-button" aria-pressed={checks} onClick={()=>setChecks(!checks)}>{chinese?'头像检查':'Avatar check'}</button><p role={persistence.error?'alert':'status'} className="import-status">{persistence.error||notice}</p>
        {!compact&&materialsControls}
      </section>
      {!compact&&<aside className={styles.right}><Adjustments chinese={chinese} /></aside>}
      {compact&&<><nav className="mobile-nav" aria-label={chinese?'工作区工具':'Workspace tools'}>{(['import','templates','materials','adjust'] as const).map((id,i)=><button key={id} data-mobile-panel={id} aria-expanded={panel===id} onClick={()=>openPanel(id)}>{(chinese?['导入','模板','素材','调整']:['Import','Templates','Materials','Adjust'])[i]}</button>)}</nav><MobileSheet returnFocus={()=>document.querySelector<HTMLButtonElement>(`[data-mobile-panel="${lastPanel.current}"]`)?.focus({preventScroll:true})} closeLabel={chinese?"关闭":"Close"} open={!!panel} close={()=>setPanel(undefined)} title={(chinese?{import:'导入',templates:'模板',materials:'素材',adjust:'调整'}:{import:'Import',templates:'Templates',materials:'Materials',adjust:'Adjust'})[panel||'import']} reduce={effectiveReduced}>{panel==='import'?sourceControls:panel==='templates'?<TemplateLibrary chinese={chinese} reduce={effectiveReduced}/>:panel==='materials'?materialsControls:<Adjustments chinese={chinese}/>}</MobileSheet></>}
    </main>
    <ClearDataDialog open={clearData} close={()=>setClearData(false)} chinese={chinese} clear={async scopes=>{mutation.current++;importer.cancel();setPreparedImport(undefined);await persistence.clear(scopes);}} resetSettings={()=>{localStorage.removeItem('playlist-avatar:favorites');window.dispatchEvent(new Event('playlist-avatar:reset-favorites'));localStorage.removeItem('playlist-avatar.preferences.v1');setPreferences({locale:browserLocale(),theme:'system',reduceMotion:false});}}/>
  </div></MotionConfig>;
}
