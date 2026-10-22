import React, { useEffect, useState } from "react";
const routeEvent = "hellocuff:navigate";
export function navigate(to: string, replace = false) {
  const url = new URL(to, location.origin);
  if (url.origin !== location.origin) {
    location.assign(url.href);
    return;
  }
  if (replace) history.replaceState({}, "", url.pathname + url.search);
  else if (url.pathname + url.search !== location.pathname + location.search)
    history.pushState({}, "", url.pathname + url.search);
  dispatchEvent(new Event(routeEvent));
}
export function AppLink({
  to,
  children,
  className,
  ...props
}: { to: string; children: React.ReactNode; className?: string } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  return (
    <a
      href={to}
      className={className}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !props.target
        ) {
          const url = new URL(to, location.origin);
          if (url.origin === location.origin && url.pathname !== "/") {
            event.preventDefault();
            navigate(to);
          }
        }
      }}
    >
      {children}
    </a>
  );
}
export function useRoute() {
  const [route, setRoute] = useState(() => location.pathname + location.search);
  useEffect(() => {
    const update = () => setRoute(location.pathname + location.search);
    addEventListener("popstate", update);
    addEventListener(routeEvent, update);
    return () => {
      removeEventListener("popstate", update);
      removeEventListener(routeEvent, update);
    };
  }, []);
  const url = new URL(route, location.origin);
  return {
    path: url.pathname.replace(/\/$/, "") || "/",
    search: url.search,
    params: url.searchParams,
  };
}
