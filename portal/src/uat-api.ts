import type {ShippingConfirmation} from "../functions/uat-checkout.mjs";
import type { Auth } from "firebase/auth";
import {
  policyVersion,
  validConfig,
  type Config,
  type Profile,
  type Selection,
} from "../functions/uat-contract.mjs";
export interface UatAccount {
  environment: "uat-simulation";
  publicId: string;
  activeProfileId: string;
  profileIds: string[];
  testPlan: Selection["plan"];
  interval: Selection["interval"];
  lastOrderId: string;
  initialOrderId: string;
  lifecycleState?:'active'|'pending-deletion'|'retired'|'invalid';
  remainingGraceDays?:number;
  lifecycleRevision?:number;
  lifecycle?:{state:string;revision:number;deadlineAtMs:number;keepPublic:boolean};
  billing?:{provider:'stripe-sandbox';subscriptionId?:string;cancelAtPeriodEnd?:boolean;status?:string};
}
export interface OwnerState {
  config: Config;
  account: UatAccount | null;
  profiles: Profile[];
  publication?: {
    published: boolean;
    activeProfileId?: string;
    revision?: number;
  };
}
export interface PublicState {
  publicId: string;
  profile: Profile;
  branding: "wallpaper" | "footer" | "none";
  publicationRevision: number;
  environment: "uat-simulation";
}
export function makeUatApi(auth: Auth) {
  const demo = import.meta.env.VITE_USE_EMULATORS === "true";
  const port = Number(import.meta.env.VITE_UAT_FUNCTION_PORT || 5001);
  if (demo && (!Number.isInteger(port) || port < 1024 || port > 65535))
    throw Error("Invalid local UAT function port.");
  const endpoint = demo
    ? `http://127.0.0.1:${port}/demo-hellocuff/us-east1/photoApi/uat-api/v1`
    : "/uat-api/v1";
  async function request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      private?: boolean;
      expectedUid?: string;
      binary?: boolean;
    } = {},
  ): Promise<T> {
    const user = auth.currentUser,
      uid = user?.uid;
    if (options.expectedUid && uid !== options.expectedUid)
      throw Error(
        "Your signed-in account changed. Choose the image again in this account.",
      );
    if (options.private && !user) throw Error("Sign in to continue.");
    const token = options.private ? await user!.getIdToken() : null;
    const same = () => {
      if (options.private && auth.currentUser?.uid !== uid)
        throw Error(
          "Your signed-in account changed. Reload this page before continuing.",
        );
    };
    same();
    let response: Response;
    try {
      response = await fetch(endpoint + "/" + path, {
        method: options.method || "GET",
        cache: "no-store",
        headers: {
          "X-HelloCuff-UAT": "1",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch {
      same();
      throw Error(
        "Connection failed. Check your network and retry. Your edits remain on this screen.",
      );
    }
    same();
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      same();
      throw Error(
        body?.error ||
          "The UAT request failed. Your edits remain on this screen.",
      );
    }
    const value = options.binary
      ? new Uint8Array(await response.arrayBuffer())
      : await response.json();
    same();
    return value;
  }
  return {
    async config() {
      const r = await request<{ config: Config }>("config");
      if (!validConfig(r.config))
        throw Error("UAT plan configuration is invalid.");
      return r.config;
    },
    async load() {
      const r = await request<OwnerState>("account", { private: true });
      if (!validConfig(r.config))
        throw Error("UAT plan configuration is invalid.");
      return r;
    },
    order: (id:string,selection:Selection,shipping:ShippingConfirmation|null,kind:"initial"|"plan-change"="initial") => request<{order:{id:string;selection:Selection;paid:false;status:"simulated";quote:{totalCents:number}};alreadyCompleted:boolean}>(kind === "initial"?"orders":"plan-changes",{method:"POST",body:{id,selection,acceptedPolicyVersion:policyVersion,...(kind === "initial"?{shipping}:{})},private:true}),
    getOrder:(id:string)=>request<{order:{id:string;paid:false;status:"simulated";quote:{totalCents:number};shipping?:ShippingConfirmation}}>("orders/"+id,{private:true}),
    requestDeletion:(body:{id:string;revision:number;keepPublic:boolean;confirmation:string})=>request("account/deletion",{method:"POST",private:true,body}),
    reactivate:(revision:number)=>request("account/reactivate",{method:"POST",private:true,body:{revision}}),
    addProfile: (label: string) =>
      request<{ id: string }>("profiles", {
        method: "POST",
        body: { label },
        private: true,
      }),
    save: (p: Profile) =>
      request("profiles/" + p.id, { method: "PUT", body: p, private: true }),
    rename:(id:string,label:string,revision:number)=>request<{revision:number}>("profiles/"+id+"/rename",{method:"POST",body:{label,revision},private:true}),
    remove: (id: string) =>
      request("profiles/" + id, { method: "DELETE", private: true }),
    publish: (id: string, published: boolean) =>
      request("publication", {
        method: "POST",
        body: { profileId: id, published },
        private: true,
      }),
    async upload(kind: "photo" | "logo", web: Blob, vcf: Blob | null) {
      const expectedUid = auth.currentUser?.uid;
      if (!expectedUid) throw Error("Sign in to upload an image.");
      const encode = async (b: Blob) => {
        let binary = "";
        for (const byte of new Uint8Array(await b.arrayBuffer()))
          binary += String.fromCharCode(byte);
        return btoa(binary);
      };
      return request<{ id: string }>("assets", {
        method: "POST",
        private: true,
        expectedUid,
        body: {
          kind,
          web: await encode(web),
          vcf: vcf ? await encode(vcf) : null,
        },
      });
    },
    privateImage: (id: string, variant = "web") =>
      request<Uint8Array>(`assets/${id}/${variant}`, {
        private: true,
        binary: true,
      }),
    public: (id: string) => request<PublicState>("public/" + id),
    publicImage: (
      id: string,
      kind: "photo" | "logo",
      variant: string,
      revision: number,
    ) =>
      request<Uint8Array>(`public/${id}/media/${kind}/${variant}/${revision}`, {
        binary: true,
      }),
  };
}
