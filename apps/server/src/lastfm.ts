import {createHash}from'node:crypto';
import{sourceKey,LIMITS}from'@playlist-avatar/contracts';
import type{SourceSnapshot,Track}from'@playlist-avatar/contracts';
import type{ProviderResult,ProviderTrack}from'./providers.ts';
import{upstreamJSON}from'./network.ts';import{ServiceError}from'./errors.ts';
type Raw=Record<string,unknown>;const object=(v:unknown):Raw=>v&&typeof v==='object'&&!Array.isArray(v)?v as Raw:{};
const array=(v:unknown)=>Array.isArray(v)?v:[];const text=(v:unknown)=>typeof v==='string'?v.slice(0,1024):'';
function count(v:unknown){const value=typeof v==='string'&&/^\d+$/.test(v)?Number(v):v;return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:undefined;}
export function normalizeLastfm(raw:Raw,username:string,kind:'top-albums'|'recent-tracks',period:SourceSnapshot['period']='1month'):ProviderResult{
 if(raw.error!==undefined){const code=Number(raw.error);throw new ServiceError(code===6?'NOT_PUBLIC_OR_UNAVAILABLE':[10,26].includes(code)?'UNCONFIGURED_SOURCE':code===29?'RATE_LIMITED':'INCOMPLETE_SOURCE',code===6?404:[10,26].includes(code)?501:code===29?429:502);}
 const container=object(raw[kind==='top-albums'?'topalbums':'recenttracks']);if(!Object.keys(container).length)throw new ServiceError('INCOMPLETE_SOURCE',502);
 const values=array(container[kind==='top-albums'?'album':'track']).filter(value=>kind!=='recent-tracks'||![true,'true'].includes(object(object(value)['@attr']).nowplaying as boolean|string)).slice(0,kind==='top-albums'?50:200);
 const tracks:ProviderTrack[]=[];
 for(const [order,value]of values.entries()){
   const entry=object(value),artist=object(entry.artist),album=kind==='top-albums'?entry:object(entry.album),title=text(entry.name),albumName=text(album.name??album['#text']),artistName=text(artist.name??artist['#text']);
   const event=count(object(entry.date).uts);if(!title||kind==='recent-tracks'&&(event===undefined||event>8640000000000))continue;
   const mbid=text(entry.mbid),identity=/^[\w-]{1,128}$/.test(mbid)?mbid:createHash('sha256').update(JSON.stringify([artistName,albumName,title,event])).digest('hex');
   const albumId=text(album.mbid)||createHash('sha256').update(JSON.stringify([artistName,albumName,albumName?null:title])).digest('hex');
   const image=array(entry.image).map(v=>text(object(v)['#text'])).filter(Boolean).at(-1);
   const statistics:Track['statistics']={};const plays=count(entry.playcount),rank=count(object(entry['@attr']).rank);
   if(plays!==undefined)statistics.playCount=plays;if(rank!==undefined)statistics.rankScore=rank;if(event!==undefined)statistics.eventAt=new Date(event*1000).toISOString();
   const itemKind=kind==='top-albums'?'album':'event';tracks.push({key:sourceKey('lastfm',undefined,itemKind,identity,order),source:'lastfm',sourceId:identity,kind:itemKind,title,artists:artistName?[artistName]:[],albumId,album:albumName||undefined,order,coverUrl:image,statistics:Object.keys(statistics).length?statistics:undefined});
 }
 const reported=count(object(container['@attr']).total),verified=reported!==undefined&&reported>=tracks.length?reported:undefined,complete=verified!==undefined&&tracks.length===verified&&tracks.length===values.length;
 const id=`${username}:${kind}:${kind==='top-albums'?period:'latest-200'}`;
 return{tracks,snapshot:{key:sourceKey('lastfm',undefined,'collection',id),source:'lastfm',collectionId:id,title:`${username} · ${kind==='top-albums'?period:'recent'}`,kind,period:kind==='top-albums'?period:undefined,fetchedAt:new Date().toISOString(),warnings:tracks.length!==values.length?['INCOMPLETE_SOURCE']:[],coverage:{offset:0,received:tracks.length,reportedTotal:reported,knownTotal:verified,complete,...(complete?{}:{limitReason:tracks.length!==values.length?'missing-details':verified===undefined?'unknown-total':'budget'})}}};
}
export async function lastfm(username:string,kind:'top-albums'|'recent-tracks',period:SourceSnapshot['period'],key:string|undefined,signal:AbortSignal,deadline:number){
 if(!key)throw new ServiceError('UNCONFIGURED_SOURCE',501);const query=new URLSearchParams({method:kind==='top-albums'?'user.getTopAlbums':'user.getRecentTracks',user:username,period:period||'1month',limit:kind==='top-albums'?'50':'200',page:'1',api_key:key,format:'json'});
 const raw=await upstreamJSON(`https://ws.audioscrobbler.com/2.0/?${query}`,{allowed:host=>host==='ws.audioscrobbler.com',signal,deadline});return normalizeLastfm(raw,username,kind,period);
}
