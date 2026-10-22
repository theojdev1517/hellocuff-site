import {emptyProfile,idOK,fields,type Profile} from '../functions/uat-contract.mjs';
export type SetupDraft={profile:Profile;photo:{web:string;vcf:string}|null;logo:string|null;step:string;ready:boolean;boundUid:string|null;importedOrderId:string|null};
const key='hellocuff-uat-setup-v2';
export const newSetup=():SetupDraft=>({profile:emptyProfile(crypto.randomUUID().replaceAll('-','')),photo:null,logo:null,step:'contact',ready:false,boundUid:null,importedOrderId:null});
export function readSetup(storage:Pick<Storage,'getItem'>):SetupDraft|null {try{const raw=storage.getItem(key);if(!raw||raw.length>900000)return null;const d=JSON.parse(raw);if(!idOK(d.profile?.id)||!fields.every(k=>typeof d.profile.content?.[k]==='string')||typeof d.step!=='string'||typeof d.ready!=='boolean'||d.boundUid!==null&&typeof d.boundUid!=='string')return null;return d;}catch{return null;}}
export function writeSetup(storage:Pick<Storage,'setItem'>,draft:SetupDraft){storage.setItem(key,JSON.stringify(draft));}
export const blobData=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('The optimized image could not be retained. Try again.'));reader.readAsDataURL(blob);});
export function imageBlob(data:string){if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data)||data.length>300000)throw Error('The retained optimized image is invalid. Choose it again.');const b=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));return new Blob([b],{type:'image/jpeg'});}
