import {useState} from 'react';
export function phoneEntry(value:string){
 if(value.length>40||/[^0-9+().\s-]/.test(value))return {accepted:false,value,error:'Phone number should be 10 digits.'};
 const all=value.replace(/\D/g,''),country=all.startsWith('1'),d=country?all.slice(1):all;
 if(d.length>10)return {accepted:false,value,error:'Phone number should be 10 digits.'};
 const display=(country?'+1 ':'')+(d.length<=3?d:d.length<=6?'('+d.slice(0,3)+') '+d.slice(3):'('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6));
 const error=d.length===10&&!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)?'Phone number should be 10 digits.':'';
 return {accepted:true,value:display,error};
}
export function UsPhoneInput({value,onChange,error,id='contact-phone',...rest}:{value:string;onChange:(v:string)=>void;error?:string;id?:string;disabled?:boolean}){
 const [local,setLocal]=useState('');return <><input {...rest} id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={value} aria-invalid={!!(local||error)} aria-describedby={id+'-error'} onChange={e=>{const r=phoneEntry(e.target.value);setLocal(r.error);if(r.accepted)onChange(r.value);}}/><span id={id+'-error'} className="field-error" role={local||error?'alert':undefined}>{local||error}</span></>;
}
