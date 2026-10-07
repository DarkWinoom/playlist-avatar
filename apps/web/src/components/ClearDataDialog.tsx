import { useEffect,useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { repository,storageMessage } from '../repository.ts';
import{emptyDataCounts,settingsDataCount,availableScopes}from'../local-data.ts';import type{DataCounts}from'../local-data.ts';
export function ClearDataDialog({open,close,chinese,resetSettings,clear}:{open:boolean;close:()=>void;chinese:boolean;resetSettings:()=>void;clear:(scopes:{draft:boolean;projects:boolean;connections:boolean;images?:boolean})=>Promise<void>}){
 const [scopes,setScopes]=useState({draft:false,projects:false,connections:false,images:false,settings:false}),[error,setError]=useState('');
 const[counts,setCounts]=useState<DataCounts>(emptyDataCounts),[ready,setReady]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{if(!open)return;let cancelled=false;setReady(false);setScopes({...emptyDataCounts,draft:false,projects:false,connections:false,images:false,settings:false});setError('');void repository().dataCounts().then(value=>{if(cancelled)return;setCounts({...value,settings:settingsDataCount(localStorage.getItem('playlist-avatar.preferences.v1'),localStorage.getItem('playlist-avatar:favorites'))});setReady(true);}).catch(failure=>{if(!cancelled)setError(storageMessage(failure,chinese));});return()=>{cancelled=true;};},[open,version]);
 const selected=availableScopes(scopes,counts),canConfirm=ready&&Object.values(selected).some(Boolean);
 const labels=chinese?{draft:'草稿',projects:'全部作品',images:'图片库',connections:'保存的连接',settings:'偏好与收藏'}:{draft:'Draft',projects:'All covers',images:'Image library',connections:'Saved connections',settings:'Preferences and favorites'};
 return <ConfirmDialog open={open} title={chinese?'清空所选本地数据？':'Clear selected local data?'} description={chinese?'清空后无法恢复。请先导出需要的图片。':'This cannot be undone. Export any images you need first.'} chinese={chinese} confirmDisabled={!canConfirm} cancel={close} confirm={async()=>{if(!canConfirm)return;try{await clear(selected);if(selected.settings)resetSettings();close();}catch(error){setError(storageMessage(error,chinese));throw error;}}}>
 <div className="clear-scopes">{(Object.keys(scopes)as(keyof typeof scopes)[]).map(key=><button key={key} role="checkbox" aria-checked={selected[key]} disabled={!ready||counts[key]===0} onClick={()=>setScopes(value=>({...value,[key]:!value[key]}))}><span>{selected[key]?'✓':'○'}</span><span>{labels[key]}</span><strong className="clear-count">{ready?counts[key]:'—'}</strong></button>)}</div>{error&&<><p role="alert">{error}</p><button className="quiet-button" onClick={()=>setVersion(value=>value+1)}>{chinese?'重试':'Try again'}</button></>}
 </ConfirmDialog>;
}
