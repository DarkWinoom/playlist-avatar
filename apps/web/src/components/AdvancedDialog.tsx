import * as Dialog from '@radix-ui/react-dialog';
import {useEffect,useRef,useState}from'react';
import {CapabilitiesSchema}from'@playlist-avatar/contracts';
import type{Capabilities}from'@playlist-avatar/contracts';
import {repository}from'../repository.ts';
import {ConfirmDialog}from'./ConfirmDialog.tsx';
interface Connection{token:string;profileId:string;username:string;version:string;expiresAt:string}
interface SavedConnection{id:string;profileId:string;username:string;token:string;name:string;expiresAt:string}
interface Props{chinese:boolean;read:(route:string,body:unknown,token?:string)=>Promise<void>;cancel:()=>void}
export function AdvancedDialog({chinese,read,cancel}:Props){
 const[open,setOpen]=useState(false),[tab,setTab]=useState<'lastfm'|'library'>('lastfm'),[caps,setCaps]=useState<Capabilities>();
 const[username,setUsername]=useState(''),[password,setPassword]=useState(''),[cookie,setCookie]=useState(''),[period,setPeriod]=useState('1month');
 const[kind,setKind]=useState<'top-albums'|'recent-tracks'>('top-albums'),[profileId,setProfileId]=useState(''),[remember,setRemember]=useState(false);
 const[connection,setConnection]=useState<Connection>(),[collections,setCollections]=useState<{id:string;name:string}[]>([]),[saved,setSaved]=useState<SavedConnection[]>([]);
 const[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[forget,setForget]=useState<string>();
 const task=useRef<AbortController|undefined>(undefined),epoch=useRef(0),automaticClose=useRef(false),wasOpen=useRef(false);
 const profile=caps?.profiles.find(p=>p.id===profileId),lastfmReady=caps?.sources.some(s=>s.id==='lastfm'&&s.state==='available');
 function invalidate(stopImport=true){epoch.current++;task.current?.abort();if(stopImport)cancel();setBusy(false);}
 function begin(stopImport=false){invalidate(stopImport);const controller=new AbortController();task.current=controller;return{controller,id:epoch.current};}
 function valid(job:{controller:AbortController;id:number}){return job.id===epoch.current&&!job.controller.signal.aborted;}
 async function savedConnections(){try{setSaved(await(await repository().database).getAll('connections'));}catch{}}
 useEffect(()=>()=>{task.current?.abort();if(wasOpen.current)cancel();},[]);
 useEffect(()=>{if(!open){if(wasOpen.current)invalidate(!automaticClose.current);wasOpen.current=false;automaticClose.current=false;setPassword('');setCookie('');return;}wasOpen.current=true;
   const job=begin();void fetch('/api/v1/capabilities',{signal:job.controller.signal}).then(r=>r.json()).then(value=>{if(!valid(job))return;const data=CapabilitiesSchema.parse(value);setCaps(data);if(!profileId)setProfileId(data.profiles[0]?.id||'');}).catch(()=>{if(valid(job))setNotice(chinese?'读取配置失败':'Could not read configuration');});void savedConnections();return()=>job.controller.abort();},[open]);
 async function call(route:string,options:RequestInit,controller:AbortController,token?:string){const response=await fetch(route,{...options,signal:controller.signal,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}) ,...options.headers}});if(!response.ok)throw new Error('CONNECTION_REQUIRED');return response.json();}
 async function list(token:string,controller:AbortController){const value=await call('/api/v1/connections/collections',{},controller,token);return Array.isArray(value.items)?value.items.filter((v:unknown)=>v&&typeof v==='object'&&typeof(v as {id?:unknown}).id==='string'&&typeof(v as {name?:unknown}).name==='string').slice(0,200):[];}
 function switchTab(value:'lastfm'|'library'){invalidate();setTab(value);setNotice('');}
 function switchProfile(id:string){invalidate();setProfileId(id);setConnection(undefined);setCollections([]);setNotice('');}
 async function connect(){const job=begin(true),selected=profile,keep=remember;setBusy(true);setNotice(chinese?'正在连接…':'Connecting…');
   try{const value:Connection=await call('/api/v1/connections',{method:'POST',body:JSON.stringify({profileId,username,password,cookie:selected?.kind==='netease-api'?cookie:undefined})},job.controller);if(!valid(job))return;
     const items=await list(value.token,job.controller);if(!valid(job))return;
     if(keep){const db=await repository().database;if(!valid(job))return;const previous=await db.get('connections',value.profileId);if(!valid(job))return;
       await db.put('connections',{id:value.profileId,profileId:value.profileId,name:selected?.name||value.profileId,username:value.username,token:value.token,expiresAt:value.expiresAt});
       if(!valid(job)){const latest=await db.get('connections',value.profileId);if(latest?.token===value.token){if(previous)await db.put('connections',previous);else await db.delete('connections',value.profileId);}return;}await savedConnections();if(!valid(job))return;
     }
     setConnection(value);setCollections(items);setPassword('');setCookie('');setNotice(chinese?'集合可读取；封面将在导入时逐张检查':'Collections available; covers will be checked during import.');
   }catch{if(valid(job))setNotice(chinese?'连接失败，请检查账号、服务和协议版本':'Connection failed. Check account, service and protocol version.');}finally{if(valid(job))setBusy(false);}}
 async function resumeSaved(record:SavedConnection){const job=begin(true);setBusy(true);try{const items=await list(record.token,job.controller);if(!valid(job))return;setProfileId(record.profileId);setConnection({token:record.token,profileId:record.profileId,username:record.username,version:chinese?'保存的会话':'Saved session',expiresAt:record.expiresAt});setCollections(items);setNotice('');}catch{if(valid(job))setNotice(chinese?'会话已过期，请重新连接':'Session expired. Reconnect.');}finally{if(valid(job))setBusy(false);}}
 async function importData(route:string,body:unknown,token?:string){const job=begin();setBusy(true);setNotice(chinese?'正在读取…':'Reading…');try{await read(route,body,token);if(!valid(job))return;automaticClose.current=true;setOpen(false);}catch{if(valid(job))setNotice(chinese?'读取失败，原作品已保留':'Read failed; previous artwork retained');}finally{if(valid(job))setBusy(false);}}
 async function disconnect(){const value=connection,job=begin(true);if(!value)return;try{await call('/api/v1/connections/current',{method:'DELETE'},job.controller,value.token);}catch{}if(valid(job)){setConnection(undefined);setCollections([]);setNotice(chinese?'本应用已断开':'This app is disconnected');}}
 async function forgetSaved(){const record=saved.find(v=>v.id===forget),job=begin(true);if(!record)return;try{await call('/api/v1/connections/current',{method:'DELETE'},job.controller,record.token);}catch{}
   if(!valid(job))return;await(await repository().database).delete('connections',record.id);if(!valid(job))return;if(connection?.token===record.token){setConnection(undefined);setCollections([]);}setForget(undefined);await savedConnections();}
 return <>
 <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><button className="quiet-button full-width">{chinese?'更多来源':'More sources'}</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content advanced-dialog" aria-describedby={undefined}>
 <div className="dialog-heading"><Dialog.Title>{chinese?'更多来源':'More sources'}</Dialog.Title><Dialog.Close asChild><button className="quiet-button">{chinese?'关闭':'Close'}</button></Dialog.Close></div>
 <div className="segmented"><button aria-pressed={tab==='lastfm'} onClick={()=>switchTab('lastfm')}>Last.fm</button><button aria-pressed={tab==='library'} onClick={()=>switchTab('library')}>{chinese?'自建库 / 兼容 API':'Self-hosted / compatible API'}</button></div>
 {tab==='lastfm'?<>
   {!lastfmReady?<p className="import-status">{chinese?'当前部署未配置 Last.fm，公开歌单和本地图片仍可使用':'Last.fm is not configured. Public playlists and local images remain available.'}</p>:<>
   <label htmlFor="lastfm-user">{chinese?'Last.fm 用户名':'Last.fm username'}</label><input id="lastfm-user" value={username} maxLength={64} onChange={event=>setUsername(event.target.value)}/>
   <div className="segmented"><button aria-pressed={kind==='top-albums'} onClick={()=>setKind('top-albums')}>{chinese?'常听专辑':'Top albums'}</button><button aria-pressed={kind==='recent-tracks'} onClick={()=>setKind('recent-tracks')}>{chinese?'最近取得的播放':'Recent completed plays'}</button></div>
   {kind==='top-albums'&&<div className="periods">{['7day','1month','3month','6month','12month','overall'].map((p,i)=><button key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{(chinese?['近7天','近1月','近3月','近半年','近1年','全部']:['7 days','1 month','3 months','6 months','12 months','Overall'])[i]}</button>)}</div>}
   <button className="primary-button full-width" disabled={busy||!username.trim()} onClick={()=>void importData('/api/v1/lastfm',{username,kind,period})}>{chinese?'读取':'Read'}</button></>}
 </>:<>
   {!caps?.profiles.length?<p className="import-status">{chinese?'部署方尚未配置允许连接的服务':'No allowed service profiles are configured.'}</p>:<>
   <div className="connection-profiles">{caps.profiles.map(p=><button key={p.id} aria-pressed={profileId===p.id} onClick={()=>switchProfile(p.id)}>{p.name}<small>{p.implementation}</small></button>)}</div>
   {!connection?<>
     <label htmlFor="service-username">{profile?.kind==='netease-api'?(chinese?'预期账户 ID':'Expected account ID'):(chinese?'用户名':'Username')}</label><input id="service-username" value={username} maxLength={128} autoComplete="username" onChange={event=>setUsername(event.target.value)}/>
     {profile?.kind==='netease-api'?<><label htmlFor="service-cookie">{chinese?'已有本人会话':'Existing own session'}</label><textarea id="service-cookie" value={cookie} maxLength={8192} onChange={event=>setCookie(event.target.value)}/></>:<><label htmlFor="service-password">{chinese?'密码':'Password'}</label><input id="service-password" type="password" autoComplete="current-password" value={password} maxLength={1024} onChange={event=>setPassword(event.target.value)}/></>}
     <button role="checkbox" aria-checked={remember} className="quiet-button full-width" onClick={()=>setRemember(!remember)}>{chinese?'记住此浏览器的连接令牌':'Remember this browser’s connection token'}</button>
     <button className="primary-button full-width" disabled={busy||!username.trim()||profile?.kind==='qq-api'} onClick={()=>void connect()}>{chinese?'连接':'Connect'}</button>
     {profile?.kind==='qq-api'&&<p className="import-status">{chinese?'此私人会话协议尚未验证，可使用普通公开歌单入口':'This private-session protocol is unverified; use the public playlist entry.'}</p>}
   </>:<>
     <p className="import-status">{connection.username} · {connection.version}</p><div className="collection-list">{collections.map(item=><button key={item.id} disabled={busy} onClick={()=>void importData('/api/v1/connections/resolve',{kind:'playlist',collectionId:item.id,offset:0},connection.token)}>{item.name}</button>)}</div>
     {(profile?.kind==='subsonic'||profile?.kind==='jellyfin')&&<div className="segmented"><button disabled={busy} onClick={()=>void importData('/api/v1/connections/resolve',{kind:'recent-albums',offset:0},connection.token)}>{chinese?'来源最近专辑':'Source recent albums'}</button><button disabled={busy} onClick={()=>void importData('/api/v1/connections/resolve',{kind:'frequent-albums',offset:0},connection.token)}>{chinese?'来源常听专辑':'Source frequent albums'}</button></div>}
     <button className="quiet-button full-width" onClick={()=>void disconnect()}>{chinese?'断开本应用连接':'Disconnect this app'}</button>
   </>}
   {saved.length>0&&<div className="saved-connections">{saved.map(record=><div key={record.id}><button onClick={()=>void resumeSaved(record)}>{record.name} · {record.username}</button><button onClick={()=>setForget(record.id)}>{chinese?'忘记':'Forget'}</button></div>)}</div>}
   </>}
 </>}
 <p className="import-status" role="status">{notice}</p>
 </Dialog.Content></Dialog.Portal></Dialog.Root>
 <ConfirmDialog open={!!forget} title={chinese?'忘记此连接？':'Forget this connection?'} description={chinese?'移除当前浏览器保存的令牌，作品会保留。':'Remove the saved browser token; artworks are retained.'} chinese={chinese} cancel={()=>setForget(undefined)} confirm={forgetSaved}/>
 </>;
}
