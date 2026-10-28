"use client";
import { cameraHref } from "./camera-context";
import { ContextLink as Link } from "./camera-context";
import { useEffect } from "react";
function storageKey(href: string) {
  const url = new URL(href, "http://local");
  url.searchParams.sort();
  return `ctv:scroll:${url.pathname}?${url.searchParams}`;
}
export function CardLink({
  href,
  returnHref,
  children,
  ...props
}: {
  href: string;
  returnHref: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Link
      {...props}
      href={href}
      onClick={() => {
        try {
          sessionStorage.setItem(
            storageKey(cameraHref(returnHref, window.location.search)),
            JSON.stringify({
              top: window.scrollY,
              quickOpen:
                document.querySelector<HTMLDetailsElement>(".quick-scenarios")
                  ?.open,
              advancedOpen:
                document.querySelector<HTMLDetailsElement>(".advanced-filters")
                  ?.open,
            }),
          );
        } catch {
          /* Storage may be disabled. Navigation remains available. */
        }
      }}
    >
      {children}
    </Link>
  );
}
export function RestoreWorkspaceScroll({ href }: { href: string }) {
  useEffect(() => {
    try {
      const key = storageKey(href),
        value = sessionStorage.getItem(key);
      if (value !== null) {
        sessionStorage.removeItem(key);
        const saved = JSON.parse(value);
        const top = Number(typeof saved === "number" ? saved : saved.top);
        if (typeof saved === "object")
          for (const [selector, open] of [
            [".quick-scenarios", saved.quickOpen],
            [".advanced-filters", saved.advancedOpen],
          ] as const) {
            const details =
              document.querySelector<HTMLDetailsElement>(selector);
            if (details && typeof open === "boolean") details.open = open;
          }
        if (Number.isFinite(top))
          requestAnimationFrame(() =>
            window.scrollTo({ top, behavior: "instant" }),
          );
      }
    } catch {
      /* Storage is optional. */
    }
  }, [href]);
  return null;
}
