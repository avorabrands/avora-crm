"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { CommandDialog, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/features/search/actions";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await globalSearch(q))), 250);
    return () => clearTimeout(t);
  }, [q]);

  const shown = q.trim().length < 2 ? [] : hits;
  const groups = shown.reduce<Record<string, SearchHit[]>>((acc, h) => ((acc[h.type] ??= []).push(h), acc), {});

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40">
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Search leads, clients, projects…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search across the CRM">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Type at least 2 characters…" />
          <CommandList>
            {pending && <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Searching…</div>}
            {!pending && q.trim().length >= 2 && <CommandEmpty>No matches for “{q}”.</CommandEmpty>}
            {Object.entries(groups).map(([type, items]) => (
              <CommandGroup key={type} heading={type}>
                {items.map((h) => (
                  <CommandItem key={h.type + h.id} value={h.type + h.id} onSelect={() => { setOpen(false); router.push(h.href); }}>
                    <div className="min-w-0">
                      <p className="truncate">{h.title}</p>
                      {h.subtitle && <p className="truncate text-xs text-muted-foreground">{h.subtitle}</p>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
