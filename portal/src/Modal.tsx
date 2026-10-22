import {useEffect,useId,useRef,type ReactNode}from'react';
export function Modal({title,children,onClose,onOpen,closeLabel='Close dialog',open=true}:{title:string;children:ReactNode;onClose:()=>void;onOpen?:(dialog:HTMLDialogElement)=>void;closeLabel?:string;open?:boolean}){
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),opened=useRef(onOpen);
 useEffect(()=>{if(!open)return;const element=dialog.current!,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;element.showModal();document.body.style.overflow='hidden';const frame=requestAnimationFrame(()=>opened.current?.(element));return()=>{cancelAnimationFrame(frame);element.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[open]);
 if(!open)return null;
 return <dialog ref={dialog} className="uc-modal" aria-labelledby={id} onCancel={event=>{event.preventDefault();onClose();}} onClose={onClose}><div className="uc-modal-heading"><h2 id={id}>{title}</h2><button type="button" className="uc-modal-close" aria-label={closeLabel} autoFocus onClick={onClose}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button></div>{children}</dialog>;
}
