import {createHash,randomBytes}from'node:crypto';
import {sourceKey,LIMITS}from'@playlist-avatar/contracts';
import type {SourceId,SourceSnapshot,Track}from'@playlist-avatar/contracts';
import type {ServerConfig}from'./config.ts';
import type {UpstreamOptions}from'./network.ts';import{upstreamJSON}from'./network.ts';
import type {ProviderResult,ProviderTrack}from'./providers.ts';
import {ServiceError}from'./errors.ts';
import{artworkHost}from'./artwork.ts';import type{ArtworkPolicy}from'./artwork.ts';
type Profile=ServerConfig['advancedProfiles'][number];type Raw=Record<string,unknown>;
const object=(value:unknown):Raw=>value&&typeof value==='object'&&!Array.isArray(value)?value as Raw:{};
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value.slice(0,1024):typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:undefined;
interface Session {id:string;owner:string;profile:Profile;username:string;principal:string;namespace:string;expires:number;token?:string;salt?:string;cookie?:string;serverVersion:string;controller:AbortController}
export function profilePolicy(profile:Profile):ArtworkPolicy {
  const base=new URL(profile.baseUrl),prefix=base.pathname.replace(/\/$/,'')+'/';
  return {allowed:host=>host===base.hostname,allowPrivate:profile.allowPrivate,target:url=>url.origin===base.origin&&url.pathname.startsWith(prefix)};
}
function endpoint(profile:Profile,path:string,params?:Record<string,string>){const url=new URL(`${profile.baseUrl}/${path}`);for(const[key,value]of Object.entries(params||{}))url.searchParams.set(key,value);return url;}
function subParams(session:Session){return {u:session.username,t:session.token!,s:session.salt!,v:'1.16.1',c:'PlaylistAvatar',f:'json'};}
function jellyHeaders(session:Pick<Session,'owner'|'token'>){return {Authorization:`MediaBrowser Client="Playlist Avatar", Device="Browser", DeviceId="${session.owner}", Version="0.2.1"${session.token?`, Token="${session.token}"`:''}`};}
function row(source:SourceId,namespace:string,raw:Raw,order:number,kind:'track'|'album'='track'):ProviderTrack|undefined{
  const id=text(raw.Id??raw.id),title=text(raw.Name??raw.title??raw.name);if(!id||!title||id.length>128)return;
  const artists=array(raw.Artists).map(text);if(!artists.length&&text(raw.artist))artists.push(text(raw.artist));
  const stats=object(raw.UserData),statistics:Track['statistics']={};const plays=count(stats.PlayCount??raw.playCount);if(plays!==undefined)statistics.playCount=plays;
  const last=text(stats.LastPlayedDate??raw.played);if(last&&Number.isFinite(Date.parse(last)))statistics.lastPlayedAt=new Date(last).toISOString();
  return {key:sourceKey(source,namespace,kind,id,order),source,sourceId:id,kind,title,artists:artists.slice(0,32),albumId:text(raw.AlbumId??raw.albumId)||(kind==='album'?id:undefined),album:text(raw.Album??raw.album)||(kind==='album'?title:undefined),order,statistics:Object.keys(statistics).length?statistics:undefined};
}
function collection(session:Session,id:string,title:string,kind:SourceSnapshot['kind'],tracks:ProviderTrack[],offset:number,reported?:number,missing=false):ProviderResult{
  const source:SourceId=session.profile.kind==='subsonic'?'subsonic':session.profile.kind==='jellyfin'?'jellyfin':'netease';
  const known=reported!==undefined&&reported>=offset+tracks.length?reported:undefined,complete=offset===0&&!missing&&known!==undefined&&tracks.length===known;
  return {tracks,snapshot:{key:sourceKey(source,session.namespace,'collection',id),connectionId:session.namespace,source,collectionId:id,title,kind,fetchedAt:new Date().toISOString(),warnings:missing?['INCOMPLETE_SOURCE']:[],coverage:{received:tracks.length,offset,reportedTotal:reported,knownTotal:known,complete,...(complete?{}:{limitReason:missing?'missing-details':known===undefined?'unknown-total':'budget'})}}};
}
export class AdvancedSources {
  private sessions=new Map<string,Session>();
  private config:ServerConfig;constructor(config:ServerConfig){this.config=config;}
  require(id:string|undefined,owner:string|undefined){const session=id?this.sessions.get(id):undefined;if(!session||!owner||session.owner!==owner||session.expires<=Date.now()){if(id&&session?.expires&&session.expires<=Date.now()){session.controller.abort(new ServiceError('CONNECTION_REQUIRED',403));this.sessions.delete(id);}throw new ServiceError('CONNECTION_REQUIRED',403);}return session;}
  disconnect(id:string|undefined,owner:string|undefined){const session=this.require(id,owner);session.controller.abort(new ServiceError('CONNECTION_REQUIRED',403));this.sessions.delete(session.id);}
  policy(session:Session):ArtworkPolicy{return {...profilePolicy(session.profile),headers:session.profile.kind==='jellyfin'?jellyHeaders(session):session.profile.kind==='netease-api'&&session.cookie?{Cookie:session.cookie}:undefined};}
  artworkPolicy(session:Session):ArtworkPolicy{return session.profile.kind==='netease-api'?{allowed:artworkHost('netease')}:this.policy(session);}
  private async request(session:Session,path:string,signal:AbortSignal,deadline:number,params?:Record<string,string>,body?:Raw){
    const raw=await upstreamJSON(endpoint(session.profile,path,{...(session.profile.kind==='subsonic'?subParams(session):{}),...params}),{...this.policy(session),privateAuth:true,signal:AbortSignal.any([signal,session.controller.signal]),deadline,method:body?'POST':'GET',headers:{...this.policy(session).headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    if(session.profile.kind==='subsonic'){const value=object(raw['subsonic-response']);if(value.status!=='ok')throw new ServiceError(Number(object(value.error).code)===40?'CONNECTION_REQUIRED':'INCOMPLETE_SOURCE',Number(object(value.error).code)===40?403:502);return value;}return raw;
  }
  async connect(input:{profileId:string;username:string;password:string;cookie?:string},owner:string,signal:AbortSignal,deadline:number){
    const profile=this.config.advancedProfiles.find(p=>p.id===input.profileId);if(!profile)throw new ServiceError('UNCONFIGURED_SOURCE',501);if(profile.kind==='qq-api')throw new ServiceError('UNSUPPORTED_SOURCE',501);
    const session:Session={id:randomBytes(32).toString('base64url'),owner,profile,username:input.username,principal:'',namespace:'',expires:Date.now()+86400000,serverVersion:'',controller:new AbortController()};
    if(profile.kind==='subsonic'){
      session.salt=randomBytes(16).toString('hex');session.token=createHash('md5').update(input.password+session.salt).digest('hex');
      const ping=await this.request(session,'rest/ping.view',signal,deadline);if(!text(ping.version).startsWith('1.16'))throw new ServiceError('UNSUPPORTED_SOURCE',501);session.serverVersion=text(ping.serverVersion)||text(ping.version);
      const user=object((await this.request(session,'rest/getUser.view',signal,deadline,{username:input.username})).user);if(text(user.username)!==input.username)throw new ServiceError('CONNECTION_REQUIRED',403);session.principal=text(user.username);
    }else if(profile.kind==='jellyfin'){
      const info=await this.request(session,'System/Info/Public',signal,deadline);session.serverVersion=text(info.Version);if(!/^(12\.|10\.11\.)/.test(session.serverVersion))throw new ServiceError('UNSUPPORTED_SOURCE',501);
      const auth=await this.request(session,'Users/AuthenticateByName',signal,deadline,undefined,{Username:input.username,Pw:input.password});session.token=text(auth.AccessToken);session.principal=text(object(auth.User).Id);if(!/^[\w-]{16,64}$/.test(session.principal)||!/^[\w.~-]{16,1024}$/.test(session.token))throw new ServiceError('CONNECTION_REQUIRED',403);
      const me=await this.request(session,'Users/Me',signal,deadline);if(text(me.Id)!==session.principal)throw new ServiceError('CONNECTION_REQUIRED',403);session.username=text(me.Name);
    }else{
      if(!input.cookie||!/(?:^|;\s*)MUSIC_U=[^;]+/.test(input.cookie))throw new ServiceError('CONNECTION_REQUIRED',403);session.cookie=input.cookie;
      const status=await this.request(session,'login/status',signal,deadline),account=object(object(status.data).account),profileInfo=object(object(status.data).profile);session.principal=text(account.id??profileInfo.userId);if(!/^\d+$/.test(session.principal)||session.principal!==input.username)throw new ServiceError('CONNECTION_REQUIRED',403);
      const anonymous={...session,cookie:undefined},probe=await this.request(anonymous,'login/status',signal,deadline);if(text(object(object(probe.data).account).id)||text(object(object(probe.data).profile).userId))throw new ServiceError('UNSUPPORTED_SOURCE',501);
      session.username=text(profileInfo.nickname)||input.username;session.serverVersion=profile.implementation;
    }
    session.namespace=`${profile.id}:${createHash('sha256').update(session.principal).digest('hex').slice(0,24)}`;
    for(const[id,record]of this.sessions)if(record.expires<=Date.now()){record.controller.abort(new ServiceError('CONNECTION_REQUIRED',403));this.sessions.delete(id);}if(this.sessions.size>=128)throw new ServiceError('RATE_LIMITED',429,2000);this.sessions.set(session.id,session);
    return {token:session.id,profileId:profile.id,username:session.username,version:session.serverVersion,expiresAt:new Date(session.expires).toISOString()};
  }
  async list(session:Session,signal:AbortSignal,deadline:number){
    if(session.profile.kind==='subsonic'){const raw=await this.request(session,'rest/getPlaylists.view',signal,deadline,{username:session.username});return array(object(raw.playlists).playlist).slice(0,200).map(v=>({id:text(object(v).id),name:text(object(v).name)})).filter(v=>v.id&&v.name);}
    if(session.profile.kind==='jellyfin'){const raw=await this.request(session,'Items',signal,deadline,{UserId:session.principal,IncludeItemTypes:'Playlist',Recursive:'true',Limit:'200'});return array(raw.Items).slice(0,200).map(v=>({id:text(object(v).Id),name:text(object(v).Name)})).filter(v=>v.id&&v.name);}
    const raw=await this.request(session,'user/playlist',signal,deadline,{uid:session.principal,limit:'200',offset:'0'});if(raw.code!==200)throw new ServiceError('INCOMPLETE_SOURCE',502);return array(raw.playlist).slice(0,200).map(v=>({id:text(object(v).id),name:text(object(v).name)})).filter(v=>v.id&&v.name);
  }
  async resolve(session:Session,input:{kind:'playlist'|'recent-albums'|'frequent-albums';collectionId?:string;offset:number},signal:AbortSignal,deadline:number):Promise<ProviderResult>{
    const{id:sessionId,profile}=session;const id=input.kind==='playlist'?input.collectionId||'':input.kind;
    if(input.kind==='playlist'&&!(await this.list(session,signal,deadline)).some(p=>p.id===id))throw new ServiceError('NOT_PUBLIC_OR_UNAVAILABLE',404);
    if(profile.kind==='subsonic'){
      const raw=await this.request(session,input.kind==='playlist'?'rest/getPlaylist.view':'rest/getAlbumList2.view',signal,deadline,input.kind==='playlist'?{id}:{type:input.kind==='recent-albums'?'recent':'frequent',size:'50',offset:String(input.offset)});
      const container=object(raw[input.kind==='playlist'?'playlist':'albumList2']),all=array(container[input.kind==='playlist'?'entry':'album']);const selected=input.kind==='playlist'?all.slice(input.offset,input.offset+LIMITS.metadata):all.slice(0,50);
      const tracks=selected.map((value,i)=>{const item=row('subsonic',session.namespace,object(value),input.offset+i,input.kind==='playlist'?'track':'album');if(item&&text(object(value).coverArt))item.coverUrl=endpoint(profile,'rest/getCoverArt.view',{...subParams(session),id:text(object(value).coverArt),size:'1024'}).href;return item;}).filter((v):v is ProviderTrack=>!!v);
      return collection(session,id,text(container.name)||id,input.kind,tracks,input.offset,input.kind==='playlist'?count(container.songCount)??all.length:undefined,tracks.length!==selected.length);
    }
    if(profile.kind==='jellyfin'){
      const params={UserId:session.principal,Limit:String(input.kind==='playlist'?LIMITS.metadata:50),StartIndex:String(input.offset),Fields:'UserData,Album,AlbumId,Artists',IncludeItemTypes:input.kind==='playlist'?'Audio':'MusicAlbum',Recursive:'true',...(input.kind==='playlist'?{}:{SortBy:input.kind==='recent-albums'?'DatePlayed':'PlayCount',SortOrder:'Descending'})};
      const raw=await this.request(session,input.kind==='playlist'?`Playlists/${encodeURIComponent(id)}/Items`:'Items',signal,deadline,params),values=array(raw.Items).slice(0,input.kind==='playlist'?LIMITS.metadata:50);
      const tracks=values.map((v,i)=>{const data=object(v);if(data.Type&&data.Type!=='Audio'&&data.Type!=='MusicAlbum')return;const item=row('jellyfin',session.namespace,data,input.offset+i,input.kind==='playlist'?'track':'album');if(item)item.coverUrl=endpoint(profile,`Items/${encodeURIComponent(item.albumId||item.sourceId)}/Images/Primary`,{maxWidth:'1024',quality:'90'}).href;return item;}).filter((v):v is ProviderTrack=>!!v);
      return collection(session,id,id,input.kind,tracks,input.offset,count(raw.TotalRecordCount),tracks.length!==values.length);
    }
    if(input.kind!=='playlist')throw new ServiceError('UNSUPPORTED_SOURCE',501);
    const detail=await this.request(session,'playlist/detail',signal,deadline,{id});if(detail.code!==200)throw new ServiceError('INCOMPLETE_SOURCE',502);const playlist=object(detail.playlist);
    const raw=await this.request(session,'playlist/track/all',signal,deadline,{id,limit:String(LIMITS.metadata),offset:String(input.offset)});if(raw.code!==200)throw new ServiceError('INCOMPLETE_SOURCE',502);const values=array(raw.songs).slice(0,LIMITS.metadata);
    const tracks=values.map((v,i)=>{const data=object(v),album=object(data.al);const item=row('netease',session.namespace,{id:data.id,title:data.name,albumId:album.id,album:album.name},input.offset+i);if(item){item.artists=array(data.ar).map(a=>text(object(a).name)).filter(Boolean).slice(0,32);item.coverUrl=text(album.picUrl)||undefined;}return item;}).filter((v):v is ProviderTrack=>!!v);
    return collection(session,id,text(playlist.name)||id,'playlist',tracks,input.offset,count(playlist.trackCount),tracks.length!==values.length);
  }
}
