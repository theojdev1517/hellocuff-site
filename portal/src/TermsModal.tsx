import {useState,type MouseEvent} from 'react';
import {Modal} from './Modal';
import {TermsContent} from './terms-ui';
import {PolicyDocument} from './PolicyDocument';
import {privacySource} from './privacy-ui';
export function PolicyLink({kind='terms',label,acceptableUse=false,asButton=false}: {
 kind?:'terms'|'privacy';label?:string;acceptableUse?:boolean;asButton?:boolean;
}) {
 const [open,setOpen]=useState(false);
 const href='/app/'+kind+(acceptableUse?'#policy-section-5':'');
 const title=kind==='privacy'?'Privacy policy':'Terms & acceptable use';
 const show=(event:MouseEvent)=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();setOpen(true);
 };
 return <>
  {asButton?<button type="button" className="uc-text-button" aria-haspopup="dialog" onClick={()=>setOpen(true)}>{label||title}</button>:<a href={href} aria-haspopup="dialog" onClick={show}>{label||title}</a>}
  {open&&<Modal title={title} closeLabel="Close policy" onClose={()=>setOpen(false)} onOpen={dialog=>{
   if(acceptableUse){
    const target=dialog.querySelector<HTMLElement>('[data-policy-section="5"]');
    target?.scrollIntoView({block:'start'});
    // The sticky title wraps at narrow widths. Reveal the actual target below
    // its rendered bottom, without moving focus or changing the page scroll.
    const header=dialog.querySelector<HTMLElement>('.uc-modal-heading');
    const heading=target?.querySelector<HTMLElement>('h3,h2')||target;
    if(header&&heading){const overlap=header.getBoundingClientRect().bottom+12-heading.getBoundingClientRect().top;if(overlap>0)dialog.scrollTop=Math.max(0,dialog.scrollTop-Math.ceil(overlap));}
    target?.classList.add('uc-policy-highlight');
    setTimeout(()=>target?.classList.remove('uc-policy-highlight'),1800);
   }
  }}>
   {kind==='terms'?<TermsContent embedded/>:<PolicyDocument source={privacySource} embedded/>}
   <p><a href={href} target="_blank" rel="noopener noreferrer">Open the full policy in a new tab</a></p>
  </Modal>}
 </>;
}
export function TermsModal({label='Terms & acceptable use'}:{label?:string}) {
 return <PolicyLink label={label} acceptableUse={/^acceptable use$/i.test(label)} asButton/>;
}
