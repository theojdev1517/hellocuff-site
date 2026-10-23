import {AppLink} from './navigation';
import {FaqList,useSalesMeta} from './sales-ui';
import {faqs,productOffer} from './sales-content';
import {PlanCards} from './PlanCards';
import type{Config,Selection} from '../functions/uat-contract.mjs';
import './pricing.css';
export function PricingPage({signedIn,simulation=false,onSelect,config}:{signedIn:boolean;simulation?:boolean;config?:Config;onSelect?:(s:Selection)=>void}){
 useSalesMeta('HelloCuff Pricing - Your cuff and contact card','One networking bracelet. A Free profile forever, or more ways to make it yours.');
 return <main className="pricing-page sales-container" id="main-content" tabIndex={-1}><header className="pricing-intro"><h1>Pricing</h1><p>All plans require a bracelet: {productOffer.price}, with {productOffer.shipping}.</p></header><section className="pricing-plans" aria-label="Profile plans"><PlanCards config={config} onStart={onSelect} paidAvailable={simulation}/></section><section className="pricing-faq"><h2>Frequently Asked Questions</h2><FaqList entries={faqs.filter(f=>['free-hosting','included-profile','update-details'].includes(f.id))}/><AppLink to="/app/faq">Read all FAQs</AppLink></section>{!signedIn&&!onSelect&&<p><AppLink to="/app/plans">Get started</AppLink></p>}</main>;
}
