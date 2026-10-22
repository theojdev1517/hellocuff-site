import {PolicyDocument} from './PolicyDocument';
import source from '../../legal/terms-and-acceptable-use-2026-10-21.md?raw';
import {useSalesMeta} from './sales-ui';
import {policyVersion} from '../functions/uat-contract.mjs';
export const termsVersion=policyVersion;
export const termsSource=source;
export function TermsContent({embedded=false,titleId}:{embedded?:boolean;titleId?:string}){return <PolicyDocument source={source} embedded={embedded} titleId={titleId}/>;}
export function TermsPage(){useSalesMeta('HelloCuff — Terms of Service & Acceptable Use Policy','HelloCuff service terms and acceptable use.');return <main className="sales-container" id="main-content" tabIndex={-1}><article className="privacy-copy"><TermsContent/><p className="hint">UAT review · {termsVersion}</p></article></main>;}
