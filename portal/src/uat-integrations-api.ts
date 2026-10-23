import type {Auth} from 'firebase/auth';
import type {Cart} from './uat-cart';
import type {Profile,Selection} from '../functions/uat-contract.mjs';
export function makeIntegrationsApi(auth:Auth){
 const endpoint=import.meta.env.VITE_USE_EMULATORS==='true'?`http://127.0.0.1:${Number(import.meta.env.VITE_UAT_FUNCTION_PORT||5001)}/demo-hellocuff/us-east1/uatIntegrations`:'/uat-integrations';
 async function request<T>(path:string,body?:unknown,expectedUid?:string):Promise<T>{const user=auth.currentUser,uid=user?.uid;if(!uid||expectedUid&&uid!==expectedUid)throw Error('Your account changed. Reload before continuing.');const token=await user!.getIdToken(),same=()=>{if(auth.currentUser?.uid!==uid)throw Error('Your account changed. This request cannot continue in another account.');};same();let r:Response;try{r=await fetch(endpoint+path,{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:'Bearer '+token,'X-HelloCuff-UAT':'1',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Error('The integration could not be reached. Your entries are retained.');}same();const v=await r.json();same();if(!r.ok)throw Error(v.error||'The integration could not finish. Retry later.');return v;}
 const base64=(b:Uint8Array)=>{let value='';for(const n of b)value+=String.fromCharCode(n);return btoa(value);};
 return{
 checkout:(cart:Cart)=>request<{url?:string;orderId?:string;resumeOrderId?:string;status?:string}>('/stripe/'+(cart.kind==='plan-change'?'plan-checkout':'checkout'),{id:cart.id,selection:cart.selection,shipping:cart.shipping,acceptedPolicyVersion:cart.acceptedPolicyVersion,replacePending:true}),
 order:(id:string)=>request<{order:{id:string;status:string;selection:Selection;shipping:Cart['shipping'];paid:boolean}}>('/stripe/orders/'+id),
 cancelRenewal:()=>request<{cancelAtPeriodEnd:boolean}>('/stripe/cancel-renewal',{}),
 changePlan:(s:Selection)=>request<{pending?:boolean;scheduled?:boolean}>('/stripe/change-plan',{plan:s.plan,interval:s.interval}),
 async review(p:Profile,image:(id:string,variant?:string)=>Promise<Uint8Array>){const uid=auth.currentUser?.uid;if(!uid)throw Error('Sign in to continue.');const images:Record<string,Record<string,string>>={};for(const kind of ['photo','logo'] as const)if(p[kind]){images[kind]={web:base64(await image(p[kind]!,'web'))};if(kind==='photo')images[kind].vcf=base64(await image(p[kind]!,'vcf'));}return request<{state:string}>('/moderation/review',{profileId:p.id,revision:p.revision,images},uid);},
 };
}
