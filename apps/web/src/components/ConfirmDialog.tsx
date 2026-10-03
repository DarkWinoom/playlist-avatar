import * as Dialog from '@radix-ui/react-dialog';
import { useRef,useState } from 'react';
import type { ReactNode } from 'react';
export function ConfirmDialog({open,title,description,cancel,confirm,chinese,children}:{open:boolean;title:string;description:string;cancel:()=>void;confirm:()=>void|Promise<void>;chinese:boolean;children?:ReactNode}) {
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 const cancelButton=useRef<HTMLButtonElement>(null),previous=useRef(false),trigger=useRef<HTMLElement|null>(null);
 if(open&&!previous.current)trigger.current=document.activeElement as HTMLElement;previous.current=open;
 return <Dialog.Root open={open} onOpenChange={value=>{if(!value&&!busy)cancel();}}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content" onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onPointerDownOutside={event=>{if(busy)event.preventDefault();}} onOpenAutoFocus={event=>{event.preventDefault();cancelButton.current?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();if(trigger.current?.isConnected)trigger.current.focus({preventScroll:true});else (document.querySelector<HTMLButtonElement>('.library-dialog button')||document.querySelector<HTMLButtonElement>('.library-trigger'))?.focus({preventScroll:true});}}>
 <div className="dialog-heading"><Dialog.Title>{title}</Dialog.Title></div><Dialog.Description>{description}</Dialog.Description>{children}{error&&<p role="alert">{error}</p>}<div className="confirmation-actions"><button ref={cancelButton} disabled={busy} onClick={cancel}>{chinese?'取消':'Cancel'}</button><button className="danger-button" disabled={busy} onClick={()=>{if(busy)return;setBusy(true);setError('');void Promise.resolve().then(confirm).catch(()=>setError(chinese?'操作未完成，请重试':'Operation failed. Try again.')).finally(()=>setBusy(false));}}>{busy?(chinese?'处理中…':'Working…'):(chinese?'确认':'Confirm')}</button></div>
 </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
