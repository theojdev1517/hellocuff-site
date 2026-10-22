import {exact,plain,phone} from './uat-contract.mjs';
export const shippingKeys=['name','line1','line2','city','region','postalCode','country','phone'];
export const emptyShipping=()=>Object.fromEntries(shippingKeys.map(k=>[k,k==='country'?'US':'']));
export function normalizeShipping(a){return Object.fromEntries(shippingKeys.map(k=>[k,typeof a?.[k]==='string'?(k==='phone'?phone(a[k]):a[k].normalize('NFC').replace(/\s+/g,' ').trim()):a?.[k]]).map(([k,v])=>[k,['country','region','postalCode'].includes(k)&&typeof v==='string'?v.toUpperCase():v]));}
export function shippingErrors(a){
 if(!exact(a,shippingKeys))return {address:'Complete the test shipping address.'};
 const e={};for(const k of shippingKeys)if(!plain(a[k],k==='line1'||k==='line2'?160:k==='name'?120:80))e[k]='Use a short plain-text value.';
 for(const k of ['name','line1','city','country','postalCode'])if(typeof a[k]!=='string'||!a[k].trim())e[k]='This field is required.';
 if(typeof a.country!=='string'||!/^([A-Z]{2})$/.test(a.country))e.country='Use a two-letter country code.';
 if(a.country==='US'){if(!/^[A-Z]{2}$/.test(a.region))e.region='Use a two-letter state code.';if(!/^\d{5}(-\d{4})?$/.test(a.postalCode))e.postalCode='Use a 5-digit ZIP or ZIP+4.';}
 if(a.phone&&!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(a.phone))e.phone='Enter a 10-digit US phone number, optionally with +1.';
 return e;
}
export function checkedShipping(value){
 if(!exact(value,['address','confirmed','mode'])||value.mode!=='mock-format-only'||value.confirmed!==true||!exact(value.address,shippingKeys))throw Error('Confirm the test address formatting before checkout.');
 const a=normalizeShipping(value.address);if(Object.keys(shippingErrors(a)).length||shippingKeys.some(k=>a[k]!==value.address[k]))throw Error('Check and confirm the normalized test address.');
 return {address:a,confirmed:true,mode:'mock-format-only',postalValidated:false};
}
export function planChangeQuote(config,selection){if(selection.backup)throw Error('Backup bracelets are not part of a plan change.');const p=config.plans[selection.plan],subscriptionCents=selection.interval==='annual'?p.annualCents:p.monthlyCents;return {...selection,braceletCents:0,backupCents:0,subscriptionCents,totalCents:subscriptionCents,replacementCents:p.replacementCents,configRevision:config.revision};}
