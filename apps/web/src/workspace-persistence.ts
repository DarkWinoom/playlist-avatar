import {useEffect,useRef,useState}from'react';
import type{RefObject}from'react';
import type{ArtworkAsset,Project}from'@playlist-avatar/contracts';
import{freshRecipe,useEditor}from'./editor-store.ts';import{originalAssets}from'./assets.ts';import{recipeAssets}from'@playlist-avatar/contracts';
import{repository,storageMessage}from'./repository.ts';import{invalidateStorage,serializedStorage,storageEpoch}from'./storage-coordinator.ts';
let originals:Promise<ArtworkAsset[]>|undefined;
export function useWorkspacePersistence(chinese:boolean,operation:RefObject<number>,store=repository()){
 const[ready,setReady]=useState(false),[status,setStatus]=useState<'loading'|'saved'|'saving'|'dirty'|'error'>('loading'),[error,setError]=useState(''),[current,setCurrent]=useState<Project>();
 const locale=useRef(chinese);locale.current=chinese;const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),paused=useRef(false),currentRef=useRef<Project|undefined>(undefined);currentRef.current=current;
 function cancelWrites(){clearTimeout(timer.current);invalidateStorage();}
 useEffect(()=>{let cancelled=false;const initial=useEditor.getState().revision,token=operation.current;
   void(async()=>{if(initial>0){setReady(true);setStatus('dirty');return;}try{
     const draft=await serializedStorage(()=>store.get('draft'));if(cancelled)return;
     if(token!==operation.current||initial!==useEditor.getState().revision){paused.current=true;setReady(true);setStatus('dirty');return;}
     if(draft)useEditor.getState().load(draft.project.recipe,draft.assets,draft.project.snapshot);
else{originals??=originalAssets();const assets=await originals;if(cancelled)return;if(token!==operation.current||initial!==useEditor.getState().revision){paused.current=true;setReady(true);return;}useEditor.getState().load({...freshRecipe(assets.map(a=>a.id)),template:'aura'},assets);}
     setReady(true);setStatus(draft?'saved':'dirty');
   }catch{paused.current=true;originals??=originalAssets();const assets=await originals;if(cancelled)return;
     if(token===operation.current&&initial===useEditor.getState().revision)useEditor.getState().load(freshRecipe(assets.map(a=>a.id)),assets);
     setReady(true);setStatus('error');setError(locale.current?'草稿无法恢复，旧记录已保留。可另存作品。':'Draft could not be restored; previous records retained. Save a copy to continue.');
   }})();return()=>{cancelled=true;cancelWrites();};
 },[]);
 useEffect(()=>{if(!ready)return;let disposed=false;
   function schedule(){cancelWrites();if(paused.current||useEditor.getState().gesture)return;setStatus('dirty');const token=storageEpoch();
     timer.current=setTimeout(()=>{if(token!==storageEpoch()||paused.current||useEditor.getState().gesture)return;const state=useEditor.getState(),now=new Date().toISOString(),revision=state.revision;
       const project:Project={version:1,id:'draft',name:currentRef.current?.name||state.snapshot?.title?.slice(0,120)||'Untitled',createdAt:now,updatedAt:now,recipe:structuredClone(state.recipe),snapshot:state.snapshot?structuredClone(state.snapshot):undefined};
       const assets=recipeAssets(project.recipe).map(id=>state.assets[id]!).filter(Boolean);setStatus('saving');
       void serializedStorage(async()=>{if(token!==storageEpoch()||paused.current)return;try{await store.save(project,assets);if(!disposed&&token===storageEpoch()&&useEditor.getState().revision===revision){setStatus('saved');setError('');}}
         catch(failure){if(!disposed&&token===storageEpoch()){setStatus('error');setError(storageMessage(failure,locale.current));}}});
     },600);
   }
   const unsubscribe=useEditor.subscribe((next,previous)=>{if(next.revision!==previous.revision||!!next.gesture!==!!previous.gesture)schedule();});if(!paused.current)schedule();
   return()=>{disposed=true;cancelWrites();unsubscribe();};
 },[ready]);
 async function save(name:string,copy=false){const state=useEditor.getState(),now=new Date().toISOString(),existing=copy?undefined:current,token=operation.current,writeEpoch=storageEpoch(),identity=currentRef.current?.id;
   const project:Project={version:1,id:existing?.id||`project:${crypto.randomUUID()}`,name:name.trim(),createdAt:existing?.createdAt||now,updatedAt:now,recipe:structuredClone(state.recipe),snapshot:state.snapshot?structuredClone(state.snapshot):undefined};
   const{renderExport}=await import('./export-render.ts');const assets=recipeAssets(project.recipe).map(id=>state.assets[id]!).filter(Boolean),thumbnail=await renderExport(project.recipe,assets,{format:'image/png',size:512,transparent:false,circle:false,background:'#fff',quality:.92});
   await serializedStorage(()=>{if(token!==operation.current||writeEpoch!==storageEpoch())throw new Error('CANCELLED');return store.save(project,assets,thumbnail);});if(token===operation.current&&writeEpoch===storageEpoch()&&identity===currentRef.current?.id)setCurrent(project);return project;
 }
 async function open(id:string){cancelWrites();const token=operation.current,revision=useEditor.getState().revision,value=await serializedStorage(()=>store.get(id));
   if(token!==operation.current||revision!==useEditor.getState().revision)return;if(!value)throw new Error('INVALID_PACKAGE');useEditor.getState().load(value.project.recipe,value.assets,value.project.snapshot);setCurrent(value.project);
 }
 async function clear(scopes:{draft:boolean;projects:boolean;connections:boolean}){cancelWrites();await serializedStorage(()=>store.clear(scopes));if(scopes.draft){paused.current=false;setStatus('dirty');setError('');}if(scopes.projects)setCurrent(undefined);}
 const label=status==='saved'?(chinese?'草稿已保存':'Draft saved'):status==='saving'?(chinese?'正在保存…':'Saving…'):status==='error'?(chinese?'保存失败':'Save failed'):status==='loading'?(chinese?'正在恢复…':'Restoring…'):(chinese?'尚未保存':'Unsaved');
 return{ready,status,label,error,current,save,open,clear,setCurrent,cancelWrites};
}
