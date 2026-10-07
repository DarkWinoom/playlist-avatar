import{useEffect,useState}from'react';
export function useAutoCycle(length:number,active=true,paused=false){
 const[index,setIndex]=useState(0);
 useEffect(()=>{setIndex(value=>value%Math.max(1,length));},[length]);
 useEffect(()=>{if(!active||length<2)return;let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{clearTimeout(timer);if(paused||document.hidden||document.documentElement.dataset.reduceMotion==='true')return;timer=setTimeout(()=>{setIndex(value=>(value+1)%length);schedule();},5000);};
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce-motion']});document.addEventListener('visibilitychange',schedule);schedule();
  return()=>{clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',schedule);};
 },[length,active,paused]);
 return[index,(offset:number)=>setIndex(value=>(value+offset+length)%Math.max(1,length)),setIndex]as const;
}
