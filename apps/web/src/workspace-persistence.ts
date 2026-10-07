import {useEffect,useRef,useState}from'react';
import type{RefObject}from'react';
import type{ArtworkAsset,Project}from'@playlist-avatar/contracts';
import{studioRecipe,useEditor}from'./editor-store.ts';import{recipeAssets,projectAssets}from'@playlist-avatar/contracts';
import type{TemplateId}from'@playlist-avatar/contracts';import{workspaceFor}from'./studio-workspace.ts';
import{repository,storageMessage}from'./repository.ts';import{invalidateStorage,serializedStorage,storageEpoch}from'./storage-coordinator.ts';

export function useWorkspacePersistence(chinese:boolean,operation:RefObject<number>,store=repository(),active=true){
 const[ready,setReady]=useState(false),[status,setStatus]=useState<'loading'|'saved'|'saving'|'dirty'|'error'>('loading'),[error,setError]=useState(''),[current,updateCurrent]=useState<Project>();
 const locale=useRef(chinese);locale.current=chinese;const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),paused=useRef(false),currentRef=useRef<Project|undefined>(undefined);currentRef.current=current;
 function cancelWrites(){clearTimeout(timer.current);invalidateStorage();}
 function setCurrent(value:Project|undefined){currentRef.current=value;updateCurrent(value);}
 useEffect(()=>{let cancelled=false;const initial=useEditor.getState().revision,token=operation.current;
   void(async()=>{if(initial>0){setReady(true);setStatus('dirty');return;}try{
     const draft=await serializedStorage(()=>store.get('draft'));if(cancelled)return;
     if(token!==operation.current||initial!==useEditor.getState().revision){paused.current=true;setReady(true);setStatus('dirty');return;}
     if(draft){useEditor.getState().load(draft.project.recipe,draft.assets,draft.project.snapshot,draft.project.workspace||workspaceFor(draft.project.recipe,studioRecipe([],draft.project.recipe.template)));const id=draft.project.workspace?.editingId;if(id){const original=await store.get(id);if(!cancelled&&token===operation.current&&original?.project.state==='active')setCurrent(original.project);}}
else{const recipe=studioRecipe();useEditor.getState().load(recipe,[],undefined,workspaceFor(recipe,recipe));}
     setReady(true);setStatus(draft?'saved':'dirty');
   }catch(failure){paused.current=true;if(cancelled)return;
     if(token===operation.current&&initial===useEditor.getState().revision){const recipe=studioRecipe();useEditor.getState().load(recipe,[],undefined,workspaceFor(recipe,recipe));}
     setReady(true);setStatus('error');setError(failure instanceof Error&&failure.message==='STORAGE_UPGRADE_BLOCKED'?storageMessage(failure,locale.current):(locale.current?'草稿无法恢复，旧记录已保留。可另存作品。':'Draft could not be restored; previous records retained. Save a copy to continue.'));
   }})();return()=>{cancelled=true;cancelWrites();};
 },[]);
 useEffect(()=>{if(!ready||!active)return;let disposed=false;
   function schedule(){cancelWrites();if(paused.current||useEditor.getState().gesture)return;setStatus('dirty');const token=storageEpoch();
     timer.current=setTimeout(()=>{if(token!==storageEpoch()||paused.current||useEditor.getState().gesture)return;const state=useEditor.getState(),now=new Date().toISOString(),revision=state.revision;
       const project:Project={version:1,id:'draft',name:currentRef.current?.name||state.snapshot?.title?.slice(0,120)||'Untitled',createdAt:now,updatedAt:now,recipe:structuredClone(state.recipe),snapshot:state.snapshot?structuredClone(state.snapshot):undefined,workspace:state.workspace?structuredClone(state.workspace):undefined};
       const assets=projectAssets(project).map(id=>state.assets[id]!).filter(Boolean);setStatus('saving');
       void serializedStorage(async()=>{if(token!==storageEpoch()||paused.current)return;try{await store.save(project,assets);if(!disposed&&token===storageEpoch()&&useEditor.getState().revision===revision){setStatus('saved');setError('');}}
         catch(failure){if(!disposed&&token===storageEpoch()){setStatus('error');setError(storageMessage(failure,locale.current));}}});
     },600);
   }
   const unsubscribe=useEditor.subscribe((next,previous)=>{if(next.revision!==previous.revision||!!next.gesture!==!!previous.gesture)schedule();});if(!paused.current)schedule();
   return()=>{disposed=true;cancelWrites();unsubscribe();};
 },[ready,active]);
 async function save(name:string,copy=false){const state=useEditor.getState(),now=new Date().toISOString(),existing=copy?undefined:currentRef.current,token=operation.current,writeEpoch=storageEpoch(),identity=currentRef.current?.id,revision=state.revision,id=existing?.id||`project:${crypto.randomUUID()}`;
   const project:Project={version:1,id,name:name.trim(),createdAt:existing?.createdAt||now,updatedAt:now,recipe:structuredClone(state.recipe),snapshot:state.snapshot?structuredClone(state.snapshot):undefined,workspace:state.workspace?{...structuredClone(state.workspace),editingId:id}:workspaceFor(state.recipe,state.recipe,id)};
   const{renderExport}=await import('./export-render.ts');const assets=projectAssets(project).map(id=>state.assets[id]!).filter(Boolean),thumbnail=await renderExport(project.recipe,assets,{format:'image/png',size:512,transparent:false,circle:false,background:'#fff',quality:.92});
   try{await serializedStorage(()=>{if(token!==operation.current||writeEpoch!==storageEpoch())throw new Error('CANCELLED');return store.save(project,assets,thumbnail,undefined,undefined,true);});}catch(error){if(error instanceof Error&&error.message==='PROJECT_DELETED'&&currentRef.current?.id===id){setCurrent(undefined);useEditor.getState().identify();}throw error;}if(token===operation.current&&writeEpoch===storageEpoch()&&identity===currentRef.current?.id&&revision===useEditor.getState().revision){setCurrent(project);useEditor.getState().identify(project.id);}return project;
 }
 async function flush(){cancelWrites();if(paused.current||!ready)return;useEditor.getState().end();const state=useEditor.getState(),now=new Date().toISOString(),token=operation.current,epoch=storageEpoch(),revision=state.revision,project:Project={version:1,id:'draft',name:currentRef.current?.name||state.snapshot?.title.slice(0,120)||'Untitled',createdAt:now,updatedAt:now,recipe:structuredClone(state.recipe),snapshot:state.snapshot?structuredClone(state.snapshot):undefined,workspace:state.workspace?structuredClone(state.workspace):undefined},assets=projectAssets(project).map(id=>state.assets[id]!).filter(Boolean);
   await serializedStorage(()=>{if(token!==operation.current||epoch!==storageEpoch())throw Error('CANCELLED');return store.save(project,assets);});if(token===operation.current&&revision===useEditor.getState().revision){setStatus('saved');setError('');}
 }
 async function open(id:string){cancelWrites();const token=operation.current,revision=useEditor.getState().revision;await flush();await serializedStorage(()=>{if(token!==operation.current||revision!==useEditor.getState().revision)throw Error('CANCELLED');return store.preserveDraft();});const value=await serializedStorage(()=>store.get(id));
   if(token!==operation.current||revision!==useEditor.getState().revision)return;if(!value)throw new Error('INVALID_PACKAGE');const workspace=value.project.workspace?{...structuredClone(value.project.workspace),editingId:id,origins:{...structuredClone(value.project.workspace.origins),[value.project.recipe.template]:structuredClone(value.project.recipe)}}:workspaceFor(value.project.recipe,value.project.recipe,id);useEditor.getState().load(value.project.recipe,value.assets,value.project.snapshot,workspace);setCurrent(value.project);
 }
 async function start(template:TemplateId,base?:string){const token=operation.current,revision=useEditor.getState().revision;await flush();await serializedStorage(()=>{if(token!==operation.current||revision!==useEditor.getState().revision)throw Error('CANCELLED');return store.preserveDraft();});const value=base?await serializedStorage(()=>store.get(base)):undefined;if(token!==operation.current||revision!==useEditor.getState().revision)throw Error('CANCELLED');const recipe=value?.project.recipe||studioRecipe([],template),workspace=value?.project.workspace?{...structuredClone(value.project.workspace),editingId:undefined,origins:Object.fromEntries([...new Set([recipe.template,...Object.keys(value.project.workspace.origins),...Object.keys(value.project.workspace.variants)])].map(id=>[id,studioRecipe([],id as TemplateId)]))}:workspaceFor(recipe,studioRecipe([],recipe.template));setCurrent(undefined);paused.current=false;useEditor.getState().load(recipe,value?.assets||[],value?.project.snapshot,workspace);setStatus('dirty');setError('');}
 async function clear(scopes:{draft:boolean;projects:boolean;connections:boolean;images?:boolean}){cancelWrites();await serializedStorage(()=>store.clear(scopes));if(scopes.draft){paused.current=false;setStatus('dirty');setError('');}if(scopes.projects)setCurrent(undefined);}
 async function remove(id:string){cancelWrites();await serializedStorage(()=>store.removeProject(id));if(currentRef.current?.id===id)setCurrent(undefined);if(useEditor.getState().workspace?.editingId===id)useEditor.getState().identify();}
 const label=status==='saved'?(chinese?'草稿已保存':'Draft saved'):status==='saving'?(chinese?'正在保存…':'Saving…'):status==='error'?(chinese?'保存失败':'Save failed'):status==='loading'?(chinese?'正在恢复…':'Restoring…'):(chinese?'尚未保存':'Unsaved');
 return{ready,status,label,error,current,save,open,clear,remove,setCurrent,cancelWrites,flush,start};
}
