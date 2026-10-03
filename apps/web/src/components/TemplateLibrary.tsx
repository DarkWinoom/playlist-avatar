import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { CATALOG, FEATURED, render, prepareRenderer, imageProjections } from '@playlist-avatar/artwork';
import type { RenderImage } from '@playlist-avatar/artwork';
import type { TemplateId } from '@playlist-avatar/contracts';
import { TEMPLATE_IDS } from '@playlist-avatar/contracts';
import { useEditor } from '../editor-store.ts';
const PresenceCard=forwardRef<HTMLDivElement,{children:ReactNode;reduce:boolean}>(function PresenceCard({children,reduce},ref){const present=useIsPresent();return <motion.div ref={ref} layout transition={{duration:reduce?0:.22}} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="template-item" aria-hidden={!present} inert={!present}>{children}</motion.div>;});
function Thumb({ id, active }: { id: TemplateId; active: boolean }) {
  const canvas=useRef<HTMLCanvasElement>(null),editor=useEditor();
  useEffect(()=>{if(!active)return;let cancelled=false;const images=new Map<string,RenderImage>();
    void(async()=>{try{await prepareRenderer(id);const recipe={...editor.recipe,template:id};for(const [key]of imageProjections(recipe,128)){const asset=editor.assets[key];if(!asset)continue;const image=await createImageBitmap(asset.thumbnail);if(cancelled){image.close();return;}images.set(key,{image,width:image.width,height:image.height});}
      if(!cancelled){const c=canvas.current!;c.width=c.height=128;render(c.getContext('2d')!,128,recipe,images);}}
      catch{}finally{images.forEach(v=>(v.image as ImageBitmap).close());}})();return()=>{cancelled=true;};
  },[active,id,editor.recipe,editor.assets]);
  return <span className="template-thumb"><img src={`/templates/${id}.png`} alt="" loading="lazy" /><canvas ref={canvas} style={{opacity:active?1:0}} aria-hidden="true" /></span>;
}
export function TemplateLibrary({ chinese, reduce }: { chinese:boolean;reduce:boolean }) {
  const editor=useEditor(),[filter,setFilter]=useState('featured'),[search,setSearch]=useState(''),[focused,setFocused]=useState<TemplateId>();
  const [favorites,setFavorites]=useState<TemplateId[]>(()=>{try{const parsed=JSON.parse(localStorage.getItem('playlist-avatar:favorites')||'[]');return Array.isArray(parsed)?parsed.filter(v=>TEMPLATE_IDS.includes(v)):[];}catch{return[];}});
  useEffect(()=>{try{localStorage.setItem('playlist-avatar:favorites',JSON.stringify(favorites));}catch{}},[favorites]);
  const labels=chinese?['精选','全部16','收藏','封面','印刷','抽象','材质']:['Featured','All 16','Favorites','Covers','Print','Abstract','Material'];
  const keys=['featured','all','favorites','0','1','2','3'];
  const items=CATALOG.filter(item=>(search.trim()?true:filter==='featured'?FEATURED.includes(item.id):filter==='all'?true:filter==='favorites'?favorites.includes(item.id):item.group===Number(filter))&&`${item.en} ${item.zh}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="template-library"><div className="section-title">{chinese?'模板':'Templates'}</div><div className="template-filters" aria-label={chinese?'模板分类':'Template categories'}>{keys.map((key,i)=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{labels[i]}{filter===key&&<motion.span layoutId="category-line" className="category-line" transition={{duration:reduce?0:.2}} />}</button>)}</div>
    {(filter!=='featured'||search)&&<input aria-label={chinese?'搜索模板':'Search templates'} placeholder={chinese?'搜索模板':'Search templates'} value={search} onChange={event=>setSearch(event.target.value)} />}
    <motion.div className="template-cards" layout><AnimatePresence initial={false} mode="popLayout">{items.map(item=><PresenceCard key={item.id} reduce={reduce}>
      <button className="template-choice" data-template={item.id} aria-pressed={editor.recipe.template===item.id} onClick={()=>editor.template(item.id)} onKeyDown={event=>{const index=items.findIndex(v=>v.id===item.id);const direction=event.key==='ArrowRight'||event.key==='ArrowDown'?1:event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:0;if(!direction)return;event.preventDefault();const next=items[(index+direction+items.length)%items.length]!;editor.template(next.id);event.currentTarget.closest('.template-cards')?.querySelector<HTMLButtonElement>(`[data-template="${next.id}"]`)?.focus();}} onMouseEnter={()=>setFocused(item.id)} onMouseLeave={()=>setFocused(undefined)} onFocus={()=>setFocused(item.id)} onBlur={()=>setFocused(undefined)}><Thumb id={item.id} active={editor.recipe.template===item.id||focused===item.id} /><span>{item.en}{chinese&&<small>{item.zh}</small>}</span></button>
      <button className="favorite-button" aria-label={`${favorites.includes(item.id)?(chinese?'取消收藏':'Unfavorite'):(chinese?'收藏':'Favorite')} ${item.en}`} aria-pressed={favorites.includes(item.id)} onClick={()=>setFavorites(old=>old.includes(item.id)?old.filter(id=>id!==item.id):[...old,item.id])}>{favorites.includes(item.id)?'★':'☆'}</button>
    </PresenceCard>)}</AnimatePresence></motion.div>{!items.length&&<p className="import-status">{chinese?'没有匹配的模板':'No matching templates'}</p>}
  </div>;
}
