import type {Config,Selection} from './uat-contract.mjs';
export type ShippingAddress=Record<'name'|'line1'|'line2'|'city'|'region'|'postalCode'|'country'|'phone',string>;
export type ShippingConfirmation={address:ShippingAddress;confirmed:boolean;mode:'mock-format-only'};
export const shippingKeys:(keyof ShippingAddress)[];
export function emptyShipping():ShippingAddress;
export function normalizeShipping(value:ShippingAddress):ShippingAddress;
export function shippingErrors(value:ShippingAddress):Record<string,string>;
export function checkedShipping(value:unknown):ShippingConfirmation&{postalValidated:false};
export function planChangeQuote(config:Config,selection:Selection):ReturnType<typeof import('./uat-contract.mjs').orderQuote>;
