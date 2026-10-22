import type {Profile} from '../functions/uat-contract.mjs';
// Shared by Publish, published Save changes and Pro Activate. Server approval is
// independently enforced; this coordinates the customer-facing sequence only.
export async function publishReviewedProfile({profileId,moderationRequired,load,review,publish,check}:{profileId:string;moderationRequired:boolean;load:()=>Promise<{profiles:Profile[]}>;review:(profile:Profile)=>Promise<{state:string}>;publish:(id:string)=>Promise<unknown>;check:()=>void}){
 check();if(moderationRequired){const saved=await load();check();const profile=saved.profiles.find(p=>p.id===profileId);if(!profile)throw Error('Your saved profile changed. Refresh before publishing.');const result=await review(profile);check();if(result.state!=='approved')return false;}
 check();await publish(profileId);check();return true;
}
