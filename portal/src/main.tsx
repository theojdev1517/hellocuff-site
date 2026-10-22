import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { onIdTokenChanged, type User } from "firebase/auth";
import * as api from "./firebase";
import { AppLink, navigate, useRoute } from "./navigation";
import { useOwnerModel } from "./owner-model";
import { Header } from "./Header";
import {
  AuthForm,
  ActionPage,
  PlanSelection,
  Settings,
  Checkout,
} from "./account-ui";
import { PublicPage, Profile, LoadingState } from "./profile-ui";
import { HomePage, FaqPage } from "./sales-ui";
import { PricingPage } from "./pricing-ui";
import { DesignPreviewPage } from "./design-preview";
import { PrivacyPage } from "./privacy-ui";
import { TermsPage } from "./terms-ui";
import "./styles.css";

const designPreviewEnabled =
  import.meta.env.VITE_ENABLE_DESIGN_PREVIEW === "true";

function App() {
  const route = useRoute();
  const designPreview =
    designPreviewEnabled && route.path === "/app/design-preview";
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [authRevision, setAuthRevision] = useState(0);
  useEffect(
    () =>
      onIdTokenChanged(api.auth, (next) => {
        setUser(next);
        setReady(true);
        setAuthRevision((value) => value + 1);
      }),
    [],
  );
  // The fictional playground must never initialize production profile records.
  const owner = useOwnerModel(
    designPreview ? null : user,
    designPreview ? 0 : authRevision,
  );
  const authPath = ["/app/sign-in", "/app/signup", "/app/reset"].includes(
    route.path,
  );
  const protectedPath = [
    "/app/profile",
    "/app/settings",
    "/app/plans",
  ].includes(route.path);
  useEffect(() => {
    if (!ready) return;
    if (route.path === "/app") {
      navigate(user ? "/app/profile" : "/app/sign-in", true);
      return;
    }
    if (!user && protectedPath) {
      navigate("/app/sign-in?next=" + encodeURIComponent(route.path), true);
      return;
    }
    if (user && authPath && route.path !== "/app/reset" && owner.data) {
      const next = route.params.get("next") || "/app/profile";
      const safeNext =
        /^\/(app\/(profile|settings|plans)|p\/[a-f0-9]{32})$/.test(next)
          ? next
          : "/app/profile";
      navigate(
        owner.data.account.freePlanSelected === false ? "/app/plans" : safeNext,
        true,
      );
      return;
    }
    if (
      user &&
      owner.data?.account.freePlanSelected === false &&
      protectedPath &&
      route.path !== "/app/plans"
    )
      navigate("/app/plans", true);
  }, [
    ready,
    user?.uid,
    route.path,
    route.search,
    owner.data?.account.freePlanSelected,
    !!owner.data,
  ]);
  const publicSite =
    ["/", "/app/faq", "/app/pricing", "/app/privacy", "/app/terms"].includes(
      route.path,
    ) || designPreview;
  let content: React.ReactNode;
  if (designPreview) content = <DesignPreviewPage />;
  else if (route.path === "/") content = <HomePage signedIn={!!user} />;
  else if (route.path === "/app/faq") content = <FaqPage signedIn={!!user} />;
  else if (route.path === "/app/terms") content = <TermsPage />;
  else if (route.path === "/app/privacy") content = <PrivacyPage />;
  else if (route.path === "/app/pricing")
    content = <PricingPage signedIn={!!user} />;
  else if (route.path.startsWith("/p/"))
    content = <PublicPage id={route.path.split("/")[2] || ""} owner={owner} />;
  else if (route.path === "/app/action")
    content = <ActionPage search={route.search} />;
  else if (route.path === "/app/checkout") content = <Checkout />;
  else if (!ready) content = <LoadingState kind="account" />;
  else if (route.path === "/app/reset") content = <AuthForm mode="reset" />;
  else if (
    (!user && (authPath || route.path === "/app" || protectedPath)) ||
    (user && authPath && !owner.data && !owner.loadError)
  )
    content = (
      <div aria-busy={!!user}>
        <AuthForm
          mode={route.path === "/app/signup" ? "signup" : "login"}
          preparing={!!user}
        />
      </div>
    );
  else if (user && (authPath || route.path === "/app" || protectedPath))
    content = !owner.data ? (
      <Profile owner={owner} />
    ) : route.path === "/app/plans" ||
      owner.data.account.freePlanSelected === false ? (
      <PlanSelection owner={owner} />
    ) : route.path === "/app/settings" ? (
      <Settings owner={owner} />
    ) : (
      <Profile owner={owner} />
    );
  else
    content = (
      <main className="auth-shell">
        <section className="panel">
          <h1>Page unavailable</h1>
          <AppLink to="/app/profile">Your HelloCuff</AppLink>
          <a href="/">HelloCuff home</a>
        </section>
      </main>
    );
  const shell = (
    <>
      <span hidden data-hellocuff-entry="production-owner-v1" />
      {publicSite && (
        <a className="sales-skip" href="#main-content">
          Skip to content
        </a>
      )}
      <Header
        owner={designPreview ? { ...owner, user } : owner}
        route={route.path}
        authReady={ready}
        publicSite={publicSite}
      />
      {api.emulator && (
        <div className="dev-banner">
          LOCAL DEVELOPMENT · Firebase emulators · no real accounts, emails or
          payments
        </div>
      )}
      {!api.configured && (
        <p className="notice panel" role="alert">
          Firebase is not configured. Follow the local setup instructions in
          portal/README.md.
        </p>
      )}
      {content}
      <footer className="site-footer">
        <AppLink to="/app/privacy">Privacy</AppLink>
        <AppLink to="/app/terms">Terms &amp; acceptable use</AppLink>
        HelloCuff <span>Wear it. Tap it. Say hello.</span>
      </footer>
    </>
  );
  return publicSite ? <div className="public-site">{shell}</div> : shell;
}
const root = createRoot(document.getElementById("root")!);
if (import.meta.env.VITE_UAT_SIMULATION === "true") {
  const local =
    import.meta.env.VITE_USE_EMULATORS === "true" &&
    ["127.0.0.1", "localhost"].includes(location.hostname) &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID === "demo-hellocuff";
  const hosted =
    location.origin === "https://hellocuff-e8dec--uat-l8bne92f.web.app" &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID === "hellocuff-e8dec";
  if (local || hosted)
    void import("./uat-app").then(({ UatApp }) => root.render(<UatApp />));
  else
    root.render(
      <main className="auth-shell">
        <h1>UAT unavailable on this host</h1>
      </main>,
    );
} else root.render(<App />);
