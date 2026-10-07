import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { storageMessage } from '../repository.ts';
export function ClearDataDialog({open,close,chinese,resetSettings,clear}:{open:boolean;close:()=>void;chinese:boolean;resetSettings:()=>void;clear:(scopes:{draft:boolean;projects:boolean;connections:boolean;images?:boolean})=>Promise<void>}){
 const [scopes,setScopes]=useState({draft:false,projects:false,connections:false,images:false,settings:false}),[error,setError]=useState('');
 const labels=chinese?{draft:'草稿',projects:'全部作品',images:'图片库',connections:'保存的连接',settings:'偏好与收藏'}:{draft:'Draft',projects:'All covers',images:'Image library',connections:'Saved connections',settings:'Preferences and favorites'};
 return <ConfirmDialog open={open} title={chinese?'清空所选本地数据？':'Clear selected local data?'} description={chinese?'清空后无法恢复。请先备份作品。':'This cannot be undone. Back up your artwork first.'} chinese={chinese} cancel={close} confirm={async()=>{if(!Object.values(scopes).some(Boolean))return;try{await clear(scopes);if(scopes.settings)resetSettings();close();}catch(error){setError(storageMessage(error,chinese));throw error;}}}>
 <div className="clear-scopes">{(Object.keys(scopes)as(keyof typeof scopes)[]).map(key=><button key={key} role="checkbox" aria-checked={scopes[key]} onClick={()=>setScopes(value=>({...value,[key]:!value[key]}))}><span>{scopes[key]?'✓':'○'}</span>{labels[key]}</button>)}</div>{error&&<p role="alert">{error}</p>}
 </ConfirmDialog>;
}
