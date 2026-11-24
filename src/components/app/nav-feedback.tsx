"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLinkStatus } from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT = "avora:navigate";
/** Call right before router.push/replace so programmatic navigation shows the bar too. No-op for the current URL. */
export function startNavigation(href: string) {
  const url = new URL(href, location.href);
  if (url.pathname !== location.pathname || url.search !== location.search) window.dispatchEvent(new Event(EVENT));
}

/** Thin bar at the top of the screen from the click until the URL has changed. */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const start = () => {
      setActive(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), 20_000); // never get stuck if a navigation is cancelled
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => { if ((e.target as HTMLFormElement).id === "avora-signout") start(); };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(EVENT, start);
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL change is the "finished" signal
    setActive(false);
  }, [pathname, search]);

  return (
    <div aria-hidden data-nav-progress={active ? "on" : "off"} className={cn("pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-200", active ? "opacity-100" : "opacity-0")}>
      <div className={cn("h-full w-full origin-left bg-primary", active && "animate-nav-progress")} />
    </div>
  );
}

/** Must sit inside a <Link>. Swaps its children for a spinner while that link is loading. */
export function LinkIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className={cn("size-4 shrink-0 animate-spin", className)} /> : <>{children}</>;
}

/** Must sit inside a <Link>. Underlines a tab that is loading, without shifting layout. */
export function LinkPendingLine() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-0.5 bg-primary", pending ? "animate-pulse" : "hidden")} />;
}
