import source from '../../legal/privacy-policy-2026-10-21.md?raw';
import {PolicyDocument} from './PolicyDocument';
import {useSalesMeta} from './sales-ui';
export const privacySource=source;
export function PrivacyPage(){useSalesMeta('HelloCuff — Privacy Policy','HelloCuff Privacy Policy.');return <main className="sales-container" id="main-content" tabIndex={-1}><article className="privacy-copy"><PolicyDocument source={source}/><p className="hint">UAT policy review</p></article></main>;}
