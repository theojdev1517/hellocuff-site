import {publishReviewedProfile} from './reviewed-publication';
import {Modal} from './Modal';
import {PaymentReturn} from "./PaymentReturn";
import {PolicyLink} from "./TermsModal";
import {VerificationGuide} from "./VerificationGuide";
import {AccountLifecycle} from "./AccountLifecycle";
import {makeIntegrationsApi} from "./uat-integrations-api";
import {PlanCards} from "./PlanCards";
import {ProfileDesigner} from './ProfileDesigner';
import { useCallback, useEffect, useRef, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import * as authApi from "./firebase";
import { Header } from "./Header";
import { AuthForm, ActionPage, Settings } from "./account-ui";
import { AppLink, navigate, useRoute } from "./navigation";
import { HomePage, FaqPage } from "./sales-ui";
import { PricingPage } from "./pricing-ui";
import { PrivacyPage } from "./privacy-ui";
import { TermsPage } from "./terms-ui";
import { DesignPreviewPage } from "./design-preview";
import { PhotoEditor } from "./PhotoEditor";
import { makeUatApi, type OwnerState, type PublicState } from "./uat-api";
import { readCart, writeCart, newCart, type Cart } from "./uat-cart";
import {UatCheckout,OrderConfirmation} from "./UatCheckout";
import {AnonymousDesigner} from "./AnonymousDesigner";
import {readSetup,writeSetup,newSetup,imageBlob,type SetupDraft} from "./uat-setup";
import { UatCard } from "./uat-card";
import { UatColorPicker } from "./UatColorPicker";
import { optimizeLogo } from "./uat-logo";
import { vcfFilename, formatUsPhone } from "./domain";
import {toUatVcf} from "./uat-vcf";
import { errorMessage } from "./owner-model";
import {
  clone,
  emptyProfile,
  fields,
  fieldCaps,
  fonts,
  normalizeContent,
  profileErrors,
  orderQuote,
  website,
  policyVersion,
  type Config,
  type Profile,
  type PlanId,
  type Selection,
} from "../functions/uat-contract.mjs";
import "./uat.css";
import "./uat-pass2.css";
const api = makeUatApi(authApi.auth);
const integrations=makeIntegrationsApi(authApi.auth);
const paymentMode=import.meta.env.VITE_UAT_PAYMENTS === "stripe-sandbox" ? "stripe-sandbox" : "mock";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
const title = (s: string) => s[0].toUpperCase() + s.slice(1);
export const allowedUatLocation = () =>
  authApi.emulator
    ? ["127.0.0.1", "localhost"].includes(location.hostname) &&
      authApi.app.options.projectId === "demo-hellocuff"
    : location.origin === "https://hellocuff-e8dec--uat-l8bne92f.web.app" &&
      authApi.app.options.projectId === "hellocuff-e8dec";
async function download(
  profile: Profile,
  publicId: string,
  photo?: Uint8Array,
) {
  const url = URL.createObjectURL(
      new Blob([toUatVcf(profile.content, publicId, photo)], {
        type: "text/vcard;charset=utf-8",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = vcfFilename(profile.content.name);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function useImage(loader: (() => Promise<Uint8Array>) | null, key: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    url: string;
    error: boolean;
  }>({ key: "", url: "", error: false });
  useEffect(() => {
    let live = true,
      url = "",
      timer: ReturnType<typeof setTimeout> | undefined;
    setState({ key, url: "", error: false });
    const load = async (retries: number) => {
      if (!loader) return;
      try {
        const bytes = await loader();
        if (!live) return;
        url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
        );
        setState({ key, url, error: false });
      } catch {
        if (!live) return;
        if (retries < 2)
          timer = setTimeout(() => void load(retries + 1), 500 * (retries + 1));
        else setState({ key, url: "", error: true });
      }
    };
    void load(0);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, attempt]);
  return {
    url: state.key === key ? state.url : undefined,
    error: state.key === key && state.error,
    retry: () => setAttempt((n) => n + 1),
  };
}
function PlanPicker({config,onPick,currentPlan,currentInterval,selection}:{config:Config;onPick:(s:Selection)=>void;currentPlan?:PlanId;currentInterval?:Selection['interval'];selection?:Selection}) {
 return <main className="plans-shell uc-plan-picker"><h1>{currentPlan?'Manage your plan':'Choose your plan'}</h1><p>Your networking bracelet is {money(config.braceletCents)}, with Free Shipping.</p><PlanCards config={config} onStart={onPick} currentPlan={currentPlan} currentInterval={currentInterval} selection={selection}/><p><AppLink to="/app/design-preview">Explore themes and colors</AppLink></p></main>;
}
function UatPublic({
  id,
  user,
  owner,
}: {
  id: string;
  user: User | null;
  owner: OwnerState | null;
}) {
  const [state, setState] = useState<{
      id: string;
      value: PublicState | null;
      error: string;
    }>({ id: "", value: null, error: "" }),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true,
      inFlight = false;
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      void api
        .public(id)
        .then((value) => {
          if (live && navigator.onLine) setState({ id, value, error: "" });
        })
        .catch((e) => {
          if (live) setState({ id, value: null, error: e.message });
        })
        .finally(() => {
          inFlight = false;
        });
    };
    const offline = () => {
      if (live) setState({ id, value: null, error: "Connection unavailable." });
    };
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") load();
    }, 30000);
    addEventListener("focus", load);
    addEventListener("online", load);
    addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      live = false;
      clearInterval(timer);
      removeEventListener("focus", load);
      removeEventListener("online", load);
      removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [id, retry]);
  const value = state.id === id ? state.value : null;
  const photo = useImage(
      value?.profile.photo
        ? () => api.publicImage(id, "photo", "web", value.publicationRevision)
        : null,
      `${id}:${value?.publicationRevision}:photo`,
    ),
    logo = useImage(
      value?.profile.logo
        ? () => api.publicImage(id, "logo", "web", value.publicationRevision)
        : null,
      `${id}:${value?.publicationRevision}:logo`,
    );
  if (!value)
    return (
      <main className="auth-shell">
        <section className="panel">
          <h1>
            {state.id === id && state.error
              ? "Contact unavailable"
              : "Opening contact…"}
          </h1>
          {state.id === id && state.error && (
            <>
              <p>This contact is unavailable right now.</p>
              <button onClick={() => setRetry((x) => x + 1)}>Try again</button>
              <p>
                <AppLink to="/">HelloCuff home</AppLink>
              </p>
            </>
          )}
        </section>
      </main>
    );
  return (
    <main className="uc-public">
      <h1 className="sr-only">{value.profile.content.name}'s contact card</h1>
      <UatCard
        profile={value.profile}
        branding={value.branding}
        photo={photo.url}
        logo={logo.url}
        footer={<div className="uc-public-links">
        {user && owner?.account?.publicId === id ? (
          <AppLink to="/app/profile">Edit my card</AppLink>
        ) : !user ? (
          <AppLink to="/app/sign-in">Sign in</AppLink>
        ) : null}
        <AppLink to="/app/privacy">Privacy</AppLink>
        <AppLink to="/app/terms">Terms</AppLink>
      </div>}
        onDownload={async () => {
          const fresh = await api.public(id);
          if (fresh.publicationRevision !== value.publicationRevision)
            throw Error(
              "This card changed. Reload before downloading the latest contact.",
            );
          const bytes = value.profile.photo
            ? await api.publicImage(
                id,
                "photo",
                "vcf",
                value.publicationRevision,
              )
            : undefined;
          await download(value.profile, id, bytes);
        }}
      />
      {(photo.error || logo.error) && (
        <p className="notice" role="status">
          Card images could not be loaded.{" "}
          <button
            onClick={() => {
              photo.retry();
              logo.retry();
            }}
          >
            Retry card images
          </button>
        </p>
      )}

    </main>
  );
}
function Editor({
  user,
  state,
  reload,
  dirty,
  setDirty,
}: {
  user: User;
  state: OwnerState;
  reload: () => Promise<void>;
  dirty: boolean;
  setDirty: (v: boolean) => void;
}) {
  const a = state.account!,
    plan = state.config.plans[a.testPlan];
  const [selected, setSelected] = useState(a.activeProfileId),
    [draft, setDraft] = useState<Profile>(() =>
      clone(state.profiles.find((p) => p.id === a.activeProfileId)!),
    ),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [renameId,setRenameId]=useState<string|null>(null),
    [confirmation,setConfirmation]=useState<{title:string;body:string;label:string;action:()=>Promise<void>}|null>(null),
    [renameLabel,setRenameLabel]=useState("");
  const lock = useRef(false),
    session = user.uid,logoController=useRef<AbortController|null>(null);
  useEffect(()=>()=>logoController.current?.abort(),[session]);
  const selectedProfile =
    state.profiles.find((p) => p.id === selected) || state.profiles[0];
  useEffect(() => {
    if (!dirty && selectedProfile) {
      setSelected(selectedProfile.id);
      setDraft(clone(selectedProfile));
    }
  }, [selectedProfile?.id, selectedProfile?.revision]);
  const same = () => {
    if (authApi.auth.currentUser?.uid !== session)
      throw Error("Your account changed. Reload before continuing.");
  };
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      same();
      await operation();
      same();
    } catch (e) {
      if (authApi.auth.currentUser?.uid === session) setNotice(errorMessage(e));
    } finally {
      lock.current = false;
      if (authApi.auth.currentUser?.uid === session) setBusy(false);
    }
  };
  const change = (next: Profile) => {
    setDraft(next);
    setDirty(true);
    setErrors({});
  };
  const photo = useImage(
      draft.photo ? () => api.privateImage(draft.photo!) : null,
      `${session}:${draft.photo || ""}`,
    ),
    logo = useImage(
      draft.logo ? () => api.privateImage(draft.logo!) : null,
      `${session}:${draft.logo || ""}`,
    );
  const save = async () => {
    const normalized = {
      ...draft,
      content: normalizeContent(draft.content),
      design: {
        ...draft.design,
        ctaLabel: draft.design.ctaLabel.trim(),
        ctaUrl: website(draft.design.ctaUrl),
      },
    };
    const issues = profileErrors(normalized, plan);
    setErrors(issues);
    if (Object.keys(issues).length)
      throw Error("Check the highlighted details.");
    await api.save(normalized);
    same();
    setDirty(false);
    setDraft({ ...normalized, revision: normalized.revision + 1 });
    await reload();
    same();
    setNotice("Saved. Publish to update your public card.");
    return normalized.id;
  };
  const publishSaved=async(id:string)=>{
      await authApi.refreshUser(user);same();await user.getIdToken(true);same();
      const approved=await publishReviewedProfile({profileId:id,moderationRequired:import.meta.env.VITE_UAT_MODERATION==='true',load:api.load,review:p=>integrations.review(p,api.privateImage),publish:id=>api.publish(id,true),check:same});
      if(!approved)setNotice('Your changes are held for review. Your previous public card stays live. Contact support@hellocuff.com if you need help.');return approved;
  };
  const publish=()=>run(async()=>{const id=dirty?await save():draft.id;if(!await publishSaved(id))return;await reload();same();setNotice('Your selected card is published at the same stable link.');});
  const switchTo = (id: string) => {
    if(dirty){setConfirmation({title:'Switch profiles?',body:'Discard unsaved changes before switching profiles?',label:'Discard and switch',action:async()=>{same();setDirty(false);setSelected(id);const p=state.profiles.find(p=>p.id===id);if(p)setDraft(clone(p));setNotice('');setErrors({});}});return;}
    setDirty(false);
    setSelected(id);
    const p = state.profiles.find((p) => p.id === id);
    if (p) setDraft(clone(p));
    setNotice("");
    setErrors({});
  };
  const profileManager = (plan.profileLimit>1&&<section className="panel uc-profile-manager" aria-label="Manage profiles"><h2 id="profile-manager-heading" tabIndex={-1}>Your profiles</h2><p>One bracelet link; choose which saved profile visitors see. Activate publishes that profile after verification.</p><ul className="uc-profile-list">{state.profiles.map(p=><li key={p.id}><div><strong>{p.label}</strong>{p.id===a.activeProfileId&&<span className="hint"> Active</span>}</div><div className="button-row"><button disabled={busy} onClick={()=>switchTo(p.id)}>Edit <span className="sr-only">{p.label}</span></button><button disabled={busy||dirty} onClick={()=>{setRenameId(p.id);setRenameLabel(p.label);}}>Rename <span className="sr-only">{p.label}</span></button><button disabled={busy||p.id===a.activeProfileId} onClick={()=>void run(async()=>{if(dirty)throw Error("Save or discard your edits before activating another profile.");if(!await publishSaved(p.id))return;await reload();same();switchTo(p.id);setNotice("Active profile updated at the same bracelet link.");})}>Activate <span className="sr-only">{p.label}</span></button><button disabled={busy||state.profiles.length<=1||p.id===a.activeProfileId} onClick={()=>setConfirmation({title:'Delete profile?',body:'Delete '+p.label+'? Your active profile will be retained.',label:'Delete profile',action:async()=>{if(dirty)throw Error('Save or discard your edits before deleting a profile.');await api.remove(p.id);same();setDirty(false);setSelected(a.activeProfileId);await reload();setNotice('Profile deleted. Your active profile is retained.');requestAnimationFrame(()=>document.getElementById('profile-manager-heading')?.focus());}})}>Delete <span className="sr-only">{p.label}</span></button></div>{renameId===p.id&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{if(dirty)throw Error("Save or discard your edits before renaming this profile.");same();await api.rename(p.id,renameLabel,p.revision);same();setRenameId(null);await reload();setNotice("Profile renamed.");});}}><label>New profile name<input autoFocus required maxLength={40} value={renameLabel} onChange={e=>setRenameLabel(e.target.value)}/></label><div className="button-row"><button disabled={busy||dirty} type="submit">Save name</button><button type="button" disabled={busy} onClick={()=>setRenameId(null)}>Cancel rename</button></div></form>}</li>)}</ul><span className="uc-profile-limit" aria-label={state.profiles.length>=plan.profileLimit?"Profile limit reached. Edit or remove an inactive profile to add another.":undefined} tabIndex={state.profiles.length>=plan.profileLimit?0:undefined} title={state.profiles.length>=plan.profileLimit?'Your plan includes up to 3 profiles. Edit or remove an inactive profile to add another.':undefined}><button disabled={busy||state.profiles.length>=plan.profileLimit} onClick={()=>void run(async()=>{if(dirty)throw Error("Save or discard changes before adding a profile.");const label=`Profile ${state.profiles.length+1}`,result=await api.addProfile(label);same();await reload();setSelected(result.id);setDraft(emptyProfile(result.id,label));setNotice("New profile ready to edit.");})}>Add profile</button></span><p className="hint">Keep at least one profile. Activate another profile before deleting the active one.</p></section>);
  return (
    <main className="uc-editor">
      <div className="uc-editor-heading">
        <div>
          <p className="eyebrow">{title(a.testPlan)} · your card</p>
          <h1>Make it yours.</h1>
          <p
            className={`uc-publication ${state.publication?.published ? "published" : "unpublished"}`}
          >
            {state.publication?.published
              ? "Published"
              : "Unpublished — your card is offline"}
          </p>
          <p className="hint">
            Your bracelet link stays the same when details or your active
            profile change.
          </p>
        </div>
        <div>
          <AppLink to={`/uat/p/${a.publicId}`} target="_blank" rel="noopener noreferrer">View my card</AppLink>
          <p>
            <AppLink to="/app/plans">Manage plan</AppLink>
          </p>
        </div>
      </div>

      {Object.keys(profileErrors(draft,plan)).some(k=>["design","cta","logo"].includes(k))&&<div className="notice"><p>Your saved choices are retained; some are outside the current plan.</p><button onClick={()=>change({...draft,logo:plan.logo?draft.logo:null,design:{...draft.design,theme:plan.themes[0],color:plan.colors[0],font:plan.fonts[0],ctaLabel:plan.cta?draft.design.ctaLabel:"",ctaUrl:plan.cta?draft.design.ctaUrl:""}})}>Use style included in {title(a.testPlan)}</button></div>}
      <ProfileDesigner intro={profileManager} key={selected} draft={draft} plan={plan} planId={a.testPlan} config={state.config} onChange={change} photo={photo.url} logo={logo.url} busy={busy} errors={errors} mode={selectedProfile.revision===0&&!selectedProfile.content.name?"guided":"editor"} startStep={selectedProfile.revision===0&&!selectedProfile.content.name?"contact":"preview"} finishLabel="Save my card" onFinish={()=>void run(async()=>{await save();})} onPhoto={async image=>{if(lock.current)throw Error("Wait for the current operation, then retry this crop.");lock.current=true;setBusy(true);try{same();const result=await api.upload("photo",image.web,image.vcf);same();setDraft(current=>({...current,photo:result.id}));setDirty(true);setErrors({});}finally{lock.current=false;if(authApi.auth.currentUser?.uid===session)setBusy(false);}}} onRemovePhoto={()=>change({...draft,photo:null})} onLogo={async file=>{if(lock.current)throw Error("Wait for the current operation, then retry this logo.");lock.current=true;setBusy(true);try{logoController.current?.abort();logoController.current=new AbortController();const blob=await optimizeLogo(file,state.config.photo,logoController.current.signal);same();const result=await api.upload("logo",blob,null);same();setDraft(current=>({...current,logo:result.id}));setDirty(true);setErrors({});}finally{lock.current=false;if(authApi.auth.currentUser?.uid===session)setBusy(false);}}} onRemoveLogo={()=>change({...draft,logo:null})} preview={<UatCard profile={draft} branding={plan.branding} photo={photo.url} logo={logo.url} preview onDownload={async()=>download({...draft,content:normalizeContent(draft.content)},a.publicId,draft.photo?await api.privateImage(draft.photo,"vcf"):undefined)}/>}/>
      {(photo.error||logo.error)&&<div role="status"><p>A saved image could not load. Your saved image is retained.</p><button onClick={()=>{photo.retry();logo.retry();}}>Retry saved images</button></div>}
      <div className="uc-view-card"><AppLink to={`/uat/p/${a.publicId}`} target="_blank" rel="noopener noreferrer">View my card ↗</AppLink></div><div className="button-row uc-publish-actions"><button disabled={busy||!dirty} onClick={()=>state.publication?.published&&selected===a.activeProfileId?void publish():void run(async()=>{await save();})}>Save changes</button><button className="primary" disabled={busy||!user.emailVerified} onClick={()=>void publish()}>{selected===a.activeProfileId?"Publish card":"Make active and publish"}</button><button disabled={busy||!state.publication?.published} onClick={()=>void run(async()=>{await api.publish(a.activeProfileId,false);await reload();setNotice("Your card is unpublished. Saved drafts are retained.");})}>Unpublish</button><button disabled={busy||!dirty} onClick={()=>setConfirmation({title:'Discard edits?',body:'Your unsaved edits will be discarded. Your saved profile stays unchanged.',label:'Discard edits',action:async()=>{same();setDirty(false);setDraft(clone(selectedProfile));setNotice('');}})}>Discard edits</button></div><p className="notice" role="status">{busy?"Working...":notice}</p>{confirmation&&<Modal title={confirmation.title} onClose={()=>{if(!busy)setConfirmation(null);}}><p>{confirmation.body}</p><div className="button-row"><button disabled={busy} className="primary" onClick={()=>void run(async()=>{await confirmation.action();same();setConfirmation(null);})}>{busy?"Working...":confirmation.label}</button><button disabled={busy} onClick={()=>setConfirmation(null)}>Keep editing</button></div></Modal>}
    </main>
  );
}
export function UatApp() {
  return allowedUatLocation() ? (
    <SandboxApp />
  ) : (
    <main className="auth-shell">
      <h1>UAT unavailable on this host</h1>
    </main>
  );
}
async function importInitialDesign(uid:string,orderId:string){
 const pending=readSetup(sessionStorage);if(!pending?.ready||pending.boundUid!==uid||pending.importedOrderId===orderId)return;
 const same=()=>{if(authApi.auth.currentUser?.uid!==uid)throw Error("Your account changed. Your retained design was not applied to another account.");};same();const state=await api.load();same();if(!state.account||state.account.initialOrderId!==orderId)return;const profile=state.profiles.find(p=>p.id===state.account!.activeProfileId);if(!profile||profile.revision>0||profile.content.name)return;
 let photo:string|null=null,logo:string|null=null;if(pending.photo){const r=await api.upload("photo",imageBlob(pending.photo.web),imageBlob(pending.photo.vcf));same();photo=r.id;}if(pending.logo){const r=await api.upload("logo",imageBlob(pending.logo),null);same();logo=r.id;}
 const value={...pending.profile,id:profile.id,revision:profile.revision,photo,logo,content:normalizeContent(pending.profile.content),design:{...pending.profile.design,ctaUrl:website(pending.profile.design.ctaUrl)}};await api.save(value);same();writeSetup(sessionStorage,{...pending,importedOrderId:orderId});
}
function SandboxApp() {
  const route = useRoute(),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [config, setConfig] = useState<Config | null>(null),
    [stored, setStored] = useState<{ uid: string; value: OwnerState } | null>(
      null,
    ),
    [loadError, setLoadError] = useState(""),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [dirty, setDirty] = useState(false),
    [editorEpoch, setEditorEpoch] = useState(0),
    [cart, setCartState] = useState<Cart | null>(
      () =>
        readCart(sessionStorage) ||
        newCart({ plan: "standard", interval: "monthly", backup: false }),
    ),
    [setup,setSetupState]=useState<SetupDraft>(()=>readSetup(sessionStorage)||newSetup()),
    setupRef=useRef(setup),
    lock = useRef(false);
  setupRef.current=setup;
  const setSetup=(value:SetupDraft|((d:SetupDraft)=>SetupDraft))=>{const next=typeof value === "function"?value(setupRef.current):value;if(next.boundUid&&next.boundUid!==authApi.auth.currentUser?.uid)throw Error("Your account changed. Open setup again in this account.");writeSetup(sessionStorage,next);setupRef.current=next;setSetupState(next);};
  const owner = stored?.uid === user?.uid ? stored?.value || null : null;
  const setCart = (value: Cart) => {
    writeCart(sessionStorage, value);
    setCartState(value);
  };
  const reload = useCallback(async () => {
    const uid = authApi.auth.currentUser?.uid;
    if (!uid) return;
    const next = await api.load();
    if (authApi.auth.currentUser?.uid === uid) {
      setStored({ uid, value: next });
      setConfig(next.config);
    }
  }, []);
  useEffect(
    () =>
      onIdTokenChanged(authApi.auth, (next) => {
        if(next){const pending=readCart(sessionStorage);if(pending){const value=pending.customerUid&&pending.customerUid!==next.uid?newCart({plan:"free",interval:"monthly",backup:false}):{...pending,customerUid:next.uid};writeCart(sessionStorage,value);setCartState(value);}const design=readSetup(sessionStorage);if(design){const value=design.boundUid&&design.boundUid!==next.uid?newSetup():{...design,boundUid:next.uid};writeSetup(sessionStorage,value);setupRef.current=value;setSetupState(value);}}
        if(!next){const design=readSetup(sessionStorage);if(design?.boundUid){const blank=newSetup();writeSetup(sessionStorage,blank);setupRef.current=blank;setSetupState(blank);}const pending=readCart(sessionStorage);if(pending?.customerUid){const blank=newCart({plan:"free",interval:"monthly",backup:false});writeCart(sessionStorage,blank);setCartState(blank);}}
        setUser(next);
        setReady(true);
      }),
    [],
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    let live = true;
    void api
      .config()
      .then((c) => {
        if (live) setConfig(c);
      })
      .catch((e) => {
        if (live) setLoadError(e.message);
      });
    return () => {
      live = false;
    };
  }, [retry]);
  useEffect(() => {
    setStored(null);
    setDirty(false);
    setLoadError("");
    const uid = user?.uid;
    if (!uid) return;
    let live = true;
    const started = performance.now();
    void (async () => {
      try {
        const pending=readCart(sessionStorage);let value=await api.load();
        if(pending?.complete && pending.customerUid===uid && pending.kind==="initial" && value.account?.initialOrderId===pending.id){await importInitialDesign(uid,pending.id);value=await api.load();}
        if (live && authApi.auth.currentUser?.uid === uid) {
          setStored({ uid, value });setConfig(value.config);const design=readSetup(sessionStorage);if(design){setupRef.current=design;setSetupState(design);}
          if(["/app/signup","/app/sign-in"].includes(location.pathname))navigate(value.account?"/app/profile":pending?"/app/checkout":"/app/plans",true);
          performance.measure("hellocuff-uat-owner-load", {
            start: started,
            end: performance.now(),
          });
        }
      } catch (e) {
        if (live) setLoadError(errorMessage(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [user?.uid, retry]);
  useEffect(() => {
    if (!ready) return;
    if (route.path === "/app")
      navigate(user ? "/app/profile" : "/app/sign-in", true);
    if (user && owner && ["/app/signup", "/app/sign-in"].includes(route.path))
      navigate(owner.account ? "/app/profile" : cart ? "/app/checkout" : "/app/plans", true);
  }, [ready, user?.uid, !!owner, route.path]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      void reload().catch((e) => {
        if (authApi.auth.currentUser?.uid === user.uid)
          setNotice(errorMessage(e));
      });
    };
    addEventListener("focus", refresh);
    return () => removeEventListener("focus", refresh);
  }, [user?.uid, reload]);
  const choose = (selection: Selection) => {
    if(dirty&&!confirm("Discard unsaved edits and choose a plan?"))return;
    setDirty(false);setEditorEpoch(x=>x+1);const kind=owner?.account?"plan-change":"initial",previous=cart&&cart.kind===kind&&(!cart.customerUid||cart.customerUid===user?.uid)?cart:null;setCart({...previous||newCart(selection,kind),selection:{...selection,backup:kind==="initial"&&previous?.selection.backup||false},kind,customerUid:user?.uid||null,complete:false,accepted:false});
    navigate("/app/checkout");
  };
  const run = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    const uid = user?.uid;
    try {
      await operation();
    } catch (e) {
      if (authApi.auth.currentUser?.uid === uid) setNotice(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const checkout=()=>void run(async()=>{
    if(!cart||!user){navigate("/app/signup");return;}const uid=user.uid;if(cart.customerUid&&cart.customerUid!==uid)throw Error("This checkout belongs to another account. Start again.");
    const complete={...cart,complete:true,customerUid:uid,committedUid:uid};setCart(complete);
    if(paymentMode==='stripe-sandbox'){
      if(cart.kind==='plan-change'&&owner?.account?.billing?.subscriptionId){if(cart.selection.plan==='free'){await integrations.cancelRenewal();setNotice('Renewal is stopped. Your paid access continues through the paid period; saved profiles are retained.');navigate('/app/profile',true);return;}await integrations.changePlan(cart.selection);setNotice('Your billing change is pending or scheduled. Saved profiles are retained.');navigate('/app/profile',true);return;}
      const r=await integrations.checkout(cart);if(r.url){location.assign(r.url);return;}if(r.status==='processing'&&r.orderId){navigate('/app/payment-return?order='+r.orderId,true);return;}if(r.resumeOrderId){const old=await integrations.order(r.resumeOrderId);setCart({...cart,id:r.resumeOrderId,selection:old.order.selection,shipping:old.order.shipping,address:old.order.shipping?.address||cart.address});throw Error('Your earlier checkout is ready to resume. Continue again.');}await reload();navigate('/app/profile',true);return;
    }
    const result=await api.order(cart.id,cart.selection,cart.shipping,cart.kind);if(authApi.auth.currentUser?.uid!==uid)throw Error("Your account changed.");
    setCart({...complete,id:result.order.id,selection:result.order.selection});
    if(cart.kind==="initial"&&result.order.id===cart.id)await importInitialDesign(uid,result.order.id);
    sessionStorage.setItem("hellocuff-verification-due-"+uid,"1");
    await reload();const design=readSetup(sessionStorage);if(design){setupRef.current=design;setSetupState(design);}navigate("/app/profile",true);
  });
  if (!allowedUatLocation())
    return (
      <main className="auth-shell">
        <h1>UAT unavailable on this host</h1>
      </main>
    );
  const publicCard = route.path.startsWith("/uat/p/"),
    publicSite = [
      "/",
      "/app/faq",
      "/app/pricing",
      "/app/privacy",
      "/app/terms",
      "/app/design-preview",
    ].includes(route.path);
  let content: React.ReactNode;
  if (route.path === "/") content = <HomePage signedIn={!!user} />;
  else if (route.path === "/app/faq") content = <FaqPage signedIn={!!user} />;
  else if (route.path === "/app/pricing")
    content = (
      <PricingPage
        signedIn={!!user}
        simulation
        config={config || undefined}
        onSelect={choose}
      />
    );
  else if (route.path === "/app/privacy") content = <PrivacyPage />;
  else if (route.path === "/app/terms") content = <TermsPage />;
  else if (route.path === "/app/design-preview")
    content = <DesignPreviewPage />;
  else if (publicCard)
    content = (
      <UatPublic
        id={route.path.split("/")[3] || ""}
        user={user}
        owner={owner}
      />
    );
  else if (route.path === "/app/action")
    content = <ActionPage search={route.search} />;
  else if(route.path === "/app/payment-return"&&user)content=<PaymentReturn id={new URLSearchParams(route.search).get("order")||""} load={integrations.order} onConfirmed={async id=>{const uid=user.uid;if(authApi.auth.currentUser?.uid!==uid)throw Error("Account changed.");await importInitialDesign(uid,id);if(authApi.auth.currentUser?.uid!==uid)throw Error("Account changed.");sessionStorage.setItem("hellocuff-verification-due-"+uid,"1");await reload();navigate("/app/profile",true);}}/>;
  else if (route.path === "/app/reset") content = <AuthForm mode="reset" />;
  else if(route.path === "/app/design" && user && owner?.account && cart?.kind === "initial")content=<OrderConfirmation orderId={owner.account.initialOrderId||owner.account.lastOrderId} load={api.getOrder}/>;
  else if(route.path === "/app/design" && config && cart)content=<main className="auth-shell"><h1>Choose your bracelet and plan first</h1><AppLink className="primary" to="/app/checkout">Continue to checkout</AppLink></main>;
  else if(route.path === "/app/checkout" && config){
    if(!ready)content=<main className="auth-shell"><p>Checking your sign-in…</p></main>;
    else if(user&&!owner)content=<main className="auth-shell"><p>{loadError||"Checking your existing checkout…"}</p></main>;
    else if(owner?.account && cart?.kind!=="plan-change")content=<OrderConfirmation orderId={owner.account.initialOrderId||owner.account.lastOrderId} load={api.getOrder}/>;
    else content=<UatCheckout paymentMode={paymentMode} config={config} cart={cart||newCart({plan:"free",interval:"monthly",backup:false})} setCart={setCart} onComplete={checkout} busy={busy} accountEmail={user?.email||undefined}/>;
  }
  else if (route.path === "/app/plans" && config)
    content = <PlanPicker config={config} onPick={choose} currentPlan={owner?.account?.testPlan} currentInterval={owner?.account?.interval} selection={owner?.account?(cart?.kind==="plan-change"?cart.selection:undefined):cart?.selection}/>;
  else if (["/app/plans", "/app/checkout", "/app/design"].includes(route.path) && !config)
    content = (
      <main className="auth-shell">
        <section className="panel">
          <h1>
            {loadError ? "UAT setup unavailable" : "Loading plan options…"}
          </h1>
          {loadError && (
            <>
              <p role="alert">{loadError}</p>
              <button onClick={() => setRetry((x) => x + 1)}>Retry</button>
            </>
          )}
        </section>
      </main>
    );
  else if (!ready)
    content = (
      <main className="auth-shell">
        <p>Checking your sign-in…</p>
      </main>
    );
  else if (!user)
    content = (
      <AuthForm mode={route.path === "/app/signup" ? "signup" : "login"} afterSignup={cart?"/app/checkout":"/app/plans"} initialEmail={cart?.email||""}/>
    );
  else if (!owner)
    content = (
      <main className="auth-shell">
        <section className="panel">
          <h1>
            {loadError
              ? "Your account could not be opened"
              : "Opening your account…"}
          </h1>
          {loadError && (
            <>
              <p role="alert">{loadError}</p>
              <button onClick={() => setRetry((x) => x + 1)}>Retry</button>
            </>
          )}
        </section>
      </main>
    );
  else if (!owner.account)
    content = config ? <PlanPicker config={config} onPick={choose} /> : null;
  else if (owner.account.lifecycleState&&owner.account.lifecycleState!=="active")content=<main className="auth-shell"><AccountLifecycle user={user} account={owner.account} reload={reload} api={api} integrations={integrations}/></main>;
  else if (route.path === "/app/settings")
    content = (
      <><Settings
        owner={{
          user,
          busy,
          notice,
          entitlement: { plan: owner.account.testPlan },
          run,
          update: (p) => setNotice(p.notice),
        }}
      /><AccountLifecycle user={user} account={owner.account} reload={reload} api={api} integrations={integrations}/></>
    );
  else if (["/app/profile", "/app"].includes(route.path)) content = null;
  else
    content = (
      <main className="auth-shell">
        <section className="panel">
          <h1>Page unavailable</h1>
          <AppLink to="/">HelloCuff home</AppLink>
        </section>
      </main>
    );
  const showEditor =
    !!user && !!owner?.account && (!owner.account.lifecycleState||owner.account.lifecycleState==="active") && ["/app/profile", "/app"].includes(route.path);
  return (
    <div
      data-hellocuff-entry="uat-isolated-v1"
      className={publicCard ? "" : "app-chrome"+(publicSite?" public-site":"")}
    >
      {!publicCard && (
        <Header
          owner={{
            user,
            data: owner?.account
              ? { account: { publicId: owner.account.publicId } }
              : null,
            busy,
            dirty,
          }}
          route={route.path}
          authReady={ready}
          publicSite={true}
          publicCardPrefix="/uat/p/"
        />
      )}
      {authApi.emulator && (
        <div className="dev-banner">
          LOCAL EMULATORS · fictional accounts and test orders
        </div>
      )}
      {content}
      {showEditor&&user&&<VerificationGuide user={user} onVerified={reload}/>}
      {user && owner?.account && (!owner.account.lifecycleState||owner.account.lifecycleState==="active") && (
        <div hidden={!showEditor}>
          <Editor
            key={`${user.uid}:${editorEpoch}`}
            user={user}
            state={owner}
            reload={reload}
            dirty={dirty}
            setDirty={setDirty}
          />
        </div>
      )}
      {notice && route.path !== "/app/settings" && (
        <p className="notice global-notice" role="status">
          {notice}
        </p>
      )}
      {!publicCard && (
        <footer className="site-footer uc-footer">
          <PolicyLink kind="privacy" label="Privacy"/>
          <PolicyLink label="Terms & acceptable use"/>
          <span className="uc-copyright">© {new Date().getFullYear()} HelloCuff</span><span>HelloCuff · Wear it. Tap it. Say hello.</span>
        </footer>
      )}
    </div>
  );
}
