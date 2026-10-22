import {AppLink}from'./navigation';
import {FaqList,useSalesMeta}from'./sales-ui';
import {faqs,productOffer}from'./sales-content';
import {PlanCards}from'./PlanCards';
import type{Config,Selection}from'../functions/uat-contract.mjs';
import './pricing.css';
export function PricingPage({signedIn,simulation=false,onSelect,config}:{signedIn:boolean;simulation?:boolean;config?:Config;onSelect?:(s:Selection)=>void}){
 useSalesMeta('HelloCuff Pricing - Your cuff and contact card','One networking bracelet. A Free profile forever, or more ways to make it yours.');
 return <main className="pricing-page sales-container" id="main-content" tabIndex={-1}><header className="pricing-intro"><p className="sales-eyebrow">Your cuff. Your card.</p><h1>Pricing</h1><p>One networking bracelet. Your contact card, your way.</p></header><section className="pricing-offer" aria-labelledby="bracelet-offer"><div><p className="sales-eyebrow">The bracelet</p><h2 id="bracelet-offer">Your next hello, on your wrist.</h2><p>Wear it. Tap it. Say hello.</p></div><div><p>One-time networking bracelet purchase</p><strong className="pricing-hardware-price">{productOffer.price}</strong><p>{productOffer.shipping}</p></div></section><section className="pricing-plans" aria-label="Profile plans"><h2>Make it yours.</h2><PlanCards config={config} onStart={onSelect} paidAvailable={simulation}/></section><section className="pricing-faq"><h2>Before you get started.</h2><FaqList entries={faqs.filter(f=>['free-hosting','included-profile','other-plans'].includes(f.id))}/><AppLink to="/app/faq">Read all FAQs</AppLink></section>{!signedIn&&!onSelect&&<p><AppLink to="/app/plans">Get started</AppLink></p>}</main>;
}
