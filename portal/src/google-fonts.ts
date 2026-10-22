import {useEffect,useState} from 'react';
import {catalogFamilies} from '../functions/uat-font-catalog.mjs';
const known=new Set(catalogFamilies);
type Entry={link:HTMLLinkElement;refs:number;last:number;failed:boolean;ready:Promise<void>};
const cache=new Map<string,Entry>();
export const googleFontUrl=(id:string)=>id.startsWith('google:')&&known.has(id.slice(7))?'https://fonts.googleapis.com/css2?family='+encodeURIComponent(id.slice(7)).replace(/%20/g,'+')+'&display=swap':null;
function acquire(ids:string[]){
 const active:Entry[]=[];
 for(const id of new Set(ids)){
  const url=googleFontUrl(id);if(!url)continue;
  let item=cache.get(id);
  if(item?.failed){item.link.remove();cache.delete(id);item=undefined;}
  if(!item){
   const link=document.createElement('link');link.rel='stylesheet';link.href=url;link.referrerPolicy='no-referrer';link.dataset.hellocuffFont=id;
   const entry={link,refs:0,last:Date.now(),failed:false,ready:Promise.resolve()};
   entry.ready=new Promise<void>((resolve,reject)=>{link.onload=()=>resolve();link.onerror=()=>{entry.failed=true;reject(Error('Font stylesheet unavailable'));};});
   void entry.ready.catch(()=>undefined);document.head.append(link);cache.set(id,entry);item=entry;
  }
  item.refs++;item.last=Date.now();active.push(item);
 }
 return()=>{for(const item of active){item.refs--;item.last=Date.now();}const idle=[...cache.entries()].filter(([,e])=>e.refs===0).sort((a,b)=>b[1].last-a[1].last);for(const [id,e] of idle.slice(24)){e.link.remove();cache.delete(id);}};
}
// Only exact catalog family names are sent. Never contact text or identifiers.
export function useGoogleFonts(ids:string[]){const key=ids.filter(id=>googleFontUrl(id)).join('|');useEffect(()=>{if(!key)return;let release:(()=>void)|undefined;const timer=setTimeout(()=>release=acquire(key.split('|')),180);return()=>{clearTimeout(timer);release?.();};},[key]);}
export function useGoogleFont(id:string){
 const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{setFailed(false);if(!googleFontUrl(id))return;let live=true;const release=acquire([id]),entry=cache.get(id)!;void entry.ready.then(()=>document.fonts.load('16px '+JSON.stringify(id.slice(7)))).then(fonts=>{if(!fonts.length)entry.failed=true;if(live)setFailed(fonts.length===0);},()=>{entry.failed=true;if(live)setFailed(true);});return()=>{live=false;release();};},[id,attempt]);
 return {failed,retry:()=>setAttempt(n=>n+1)};
}
