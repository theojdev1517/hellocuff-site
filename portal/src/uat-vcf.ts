import {toVcf,type Contact} from "./domain";
/** UAT must export every website its own save/publication policy accepts. */
export const toUatVcf=(contact:Contact,publicId:string,photo?:Uint8Array)=>toVcf(contact,publicId,photo,"uat");
