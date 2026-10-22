// One URL policy for UAT save, publication and contact export. Production keeps its own defaults.
const forbidden=/[<>\s\\\u0000-\u001f\u007f]/;
function canonical(value,allowBare){
 if(typeof value!=='string')return null;
 // Reject controls before trim/URL parsing can silently discard them.
 if(/[\u0000-\u001f\u007f]/.test(value))return null;
 const s=value.trim();if(!s)return '';
 const input=allowBare&&!/^[a-z][a-z0-9+.-]*:/i.test(s)?'https://'+s:s;
 if(forbidden.test(input)||/%(?![0-9a-f]{2})/i.test(input))return null;
 try{const u=new URL(input);if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.hostname.includes('..')||!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(u.hostname))return null;
 const result=u.href.replace(/[|{}^`"]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());return result.length<=300?result:null;
 }catch{return null;}
}
export const website=value=>canonical(value,true)??value;
export const urlOK=value=>typeof value==='string'&&value.length<=300&&(value===''||value.startsWith('https://')&&canonical(value,false)!==null);
