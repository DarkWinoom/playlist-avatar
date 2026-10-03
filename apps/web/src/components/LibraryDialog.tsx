import * as Dialog from '@radix-ui/react-dialog';
import {useEffect,useRef,useState} from 'react';
import type {Project} from '@playlist-avatar/contracts';
import {repository,storageMessage} from '../repository.ts';
import type {LibraryRecord} from '../repository.ts';
import {ConfirmDialog} from './ConfirmDialog.tsx';
import {download} from '../export.ts';

function Preview({blob}:{blob?:Blob}){
  const [url,setUrl]=useState('');
  useEffect(()=>{if(!blob)return;const next=URL.createObjectURL(blob);setUrl(next);return()=>URL.revokeObjectURL(next);},[blob]);
  return url?<img src={url} alt="" loading="lazy" decoding="async"/>:<span className="library-placeholder"/>;
}
interface Props {
  chinese:boolean;save:(name:string,copy?:boolean)=>Promise<Project>;open:(id:string)=>Promise<void>;
  current?:Project;onClear:()=>void;importPackage:(file:Blob,signal:AbortSignal)=>Promise<void>;
}
export function LibraryDialog({chinese,save,open,current,onClear,importPackage}:Props){
  const [visible,setVisible]=useState(false),[items,setItems]=useState<LibraryRecord[]>([]),[trash,setTrash]=useState(false);
  const [notice,setNotice]=useState(''),[name,setName]=useState(''),[edit,setEdit]=useState<string>();
  const [remove,setRemove]=useState<LibraryRecord>(),[busy,setBusy]=useState(false),[count,setCount]=useState(50);
  const [backup,setBackup]=useState<{url:string;name:string}>();
  const packageInput=useRef<HTMLInputElement>(null),packageTask=useRef<AbortController|undefined>(undefined);
  useEffect(()=>()=>{if(backup)URL.revokeObjectURL(backup.url);},[backup]);
  useEffect(()=>()=>packageTask.current?.abort(),[]);
  useEffect(()=>{if(!visible)packageTask.current?.abort();},[visible]);
  async function refresh(){try{setItems(await repository().list(trash?'trashed':'active',count));}catch(error){setNotice(storageMessage(error,chinese));}}
  useEffect(()=>{if(visible)void refresh();},[visible,trash,count]);
  async function submit(){
    setBusy(true);try{if(edit)await repository().rename(edit,name);else await save(name,true);
      setName('');setEdit(undefined);setNotice(chinese?'已保存':'Saved');await refresh();
    }catch(error){setNotice(storageMessage(error,chinese));}finally{setBusy(false);}
  }
  async function makeBackup(id:string){
    packageTask.current?.abort();const controller=new AbortController();packageTask.current=controller;
    setBusy(true);setNotice(chinese?'正在打包…':'Packing…');
    try{const value=await repository().get(id);if(!value)throw new Error('INVALID_PACKAGE');
      const {backupProject}=await import('../project-package.ts');const blob=await backupProject(value.project,value.assets,controller.signal);
      if(controller.signal.aborted)return;const name=`playlist-avatar-${new Date().toISOString().slice(0,10)}.zip`;
      setBackup({url:URL.createObjectURL(blob),name});download(blob,name);setNotice(chinese?'作品包已生成':'Artwork package ready');
    }catch{if(!controller.signal.aborted)setNotice(chinese?'作品包生成失败，原作品已保留':'Package failed; original artwork retained');}
    finally{setBusy(false);}
  }
  async function restore(file:File|undefined){
    if(!file)return;packageTask.current?.abort();const controller=new AbortController();packageTask.current=controller;
    setBusy(true);setNotice(chinese?'正在恢复…':'Restoring…');
    try{await importPackage(file,controller.signal);if(!controller.signal.aborted){setNotice(chinese?'已导入为新作品':'Imported as a new artwork');await refresh();}}
    catch{if(!controller.signal.aborted)setNotice(chinese?'作品包无效或超出限制，原作品已保留':'Package invalid or over limits; original artwork retained');}
    finally{setBusy(false);if(packageInput.current)packageInput.current.value='';}
  }
  return <>
    <Dialog.Root open={visible} onOpenChange={setVisible}>
      <Dialog.Trigger asChild><button className="quiet-button library-trigger">{chinese?'作品库':'Library'}</button></Dialog.Trigger>
      <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/>
        <Dialog.Content className="dialog-content library-dialog" aria-describedby={undefined}>
          <div className="dialog-heading"><Dialog.Title>{chinese?'作品库':'Library'}</Dialog.Title><Dialog.Close asChild><button className="quiet-button">{chinese?'关闭':'Close'}</button></Dialog.Close></div>
          {current&&<button className="primary-button full-width" disabled={busy} onClick={()=>{setBusy(true);void save(current.name,false).then(()=>{setNotice(chinese?'已保存当前作品':'Current artwork saved');return refresh();}).catch(error=>setNotice(storageMessage(error,chinese))).finally(()=>setBusy(false));}}>{chinese?'保存当前作品':'Save current artwork'}</button>}
          <div className="save-work"><label htmlFor="work-name">{edit?(chinese?'重命名':'Rename'):(chinese?'另存新作品':'Save a copy')}</label>
            <div className="import-actions"><input id="work-name" value={name} maxLength={120} placeholder={current?.name||(chinese?'作品名称':'Artwork name')} onChange={event=>setName(event.target.value)}/><button className="primary-button" disabled={!name.trim()||busy} onClick={()=>void submit()}>{chinese?'保存':'Save'}</button></div>
          </div>
          <div className="library-tabs segmented"><button aria-pressed={!trash} onClick={()=>{setTrash(false);setCount(50);}}>{chinese?'作品':'Artworks'}</button><button aria-pressed={trash} onClick={()=>{setTrash(true);setCount(50);}}>{chinese?'已删除':'Deleted'}</button></div>
          <div className="library-grid">{items.map(item=><article className="library-item" key={item.id}>
            <button disabled={busy} className="library-open" onClick={()=>void open(item.id).then(()=>setVisible(false)).catch(error=>setNotice(storageMessage(error,chinese)))}><Preview blob={item.thumbnail}/><span>{item.name}</span></button>
            <div>{trash?<button disabled={busy} onClick={()=>void repository().state(item.id,'active').then(refresh).catch(error=>setNotice(storageMessage(error,chinese)))}>{chinese?'恢复':'Restore'}</button>:<>
              <button disabled={busy} onClick={()=>{setEdit(item.id);setName(item.name);}}>{chinese?'重命名':'Rename'}</button><button disabled={busy} onClick={()=>setRemove(item)}>{chinese?'删除':'Delete'}</button>
            </>}</div><button className="quiet-button full-width" disabled={busy} onClick={()=>void makeBackup(item.id)}>{chinese?'备份作品包':'Back up artwork'}</button>
          </article>)}</div>
          {!items.length&&<p className="import-status">{chinese?'这里还没有作品':'No artwork here yet'}</p>}
          {items.length===count&&<button className="quiet-button full-width" onClick={()=>setCount(count+50)}>{chinese?'更多作品':'More artworks'}</button>}
          <p role="status" className="import-status">{notice}</p>
          {backup&&<a className="backup-link" href={backup.url} download={backup.name}>{chinese?'保存作品包':'Save artwork package'}</a>}
          <button className="quiet-button full-width" disabled={busy} onClick={()=>packageInput.current?.click()}>{chinese?'导入作品包':'Import artwork package'}</button>
          <input ref={packageInput} className="visually-hidden" type="file" accept=".zip,application/zip" aria-label={chinese?'作品包文件':'Artwork package file'} onChange={event=>void restore(event.target.files?.[0])}/>
          <button className="quiet-button full-width" onClick={()=>{setVisible(false);onClear();}}>{chinese?'管理本地数据':'Manage local data'}</button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <ConfirmDialog open={!!remove} title={chinese?'删除这张作品？':'Delete this artwork?'} description={`${remove?.name||''} · ${chinese?'移至已删除，可恢复':'Move to Deleted; it can be restored'}`} chinese={chinese} cancel={()=>setRemove(undefined)} confirm={async()=>{if(remove){await repository().state(remove.id,'trashed');await refresh();}setRemove(undefined);}}/>
  </>;
}
