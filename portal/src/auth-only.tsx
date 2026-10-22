import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { EmailActionPage, ResetRequestPage } from "./auth-action-ui";
import { authActionAdapter, continuationContext } from "./firebase-auth-only";

function AuthOnlyApp() {
  const [route, setRoute] = useState(() => location.pathname + location.search);
  useEffect(() => {
    const update = () => setRoute(location.pathname + location.search);
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  const url = new URL(route, location.origin),
    path = url.pathname;
  return (
    <>
      <div className="site-header-bar">
        <header className="site-header">
          <nav aria-label="Home navigation">
            <a href="/" aria-label="HelloCuff home">
              <img
                src="/assets/hellocuff-logo.svg"
                alt="HelloCuff"
                width="190"
                height="45"
              />
            </a>
          </nav>
        </header>
      </div>
      {path === "/app/action" ? (
        <EmailActionPage
          adapter={authActionAdapter}
          search={url.search}
          context={continuationContext}
        />
      ) : path === "/app/reset" ? (
        <ResetRequestPage
          adapter={authActionAdapter}
          search={url.search}
          context={continuationContext}
        />
      ) : (
        <main className="auth-shell">
          <section className="panel auth-panel">
            <h1>Page unavailable</h1>
            <a href="/">HelloCuff home</a>
          </section>
        </main>
      )}
    </>
  );
}
const root = document.getElementById("root");
if (!root) throw Error("Auth action page root is missing.");
createRoot(root).render(<AuthOnlyApp />);
