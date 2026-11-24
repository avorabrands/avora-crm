"use client";

import { useEffect, useRef } from "react";

/** Keeps the selected tab visible inside a horizontally scrolling strip. */
export function ScrollActive({ watch, className, children }: { watch: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>("[aria-current=page]");
    if (box && el) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2 });
  }, [watch]);
  return <div ref={ref} className={className}>{children}</div>;
}
