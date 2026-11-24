export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type ResolvedParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 20;

export function str(sp: ResolvedParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" ? s.trim() : undefined;
}

/** Common table params: ?q=&page=&sort=&dir= with a whitelist of sortable columns. */
export function listParams<S extends string>(sp: ResolvedParams, sortable: readonly S[], defaultSort: S, defaultDir: "asc" | "desc" = "desc", pageSize = PAGE_SIZE) {
  const page = Math.max(1, Number(str(sp, "page") ?? 1) || 1);
  const sortRaw = str(sp, "sort") as S | undefined;
  const sort = sortRaw && sortable.includes(sortRaw) ? sortRaw : defaultSort;
  const dir = str(sp, "dir") === "asc" ? "asc" : str(sp, "dir") === "desc" ? "desc" : defaultDir;
  const q = str(sp, "q");
  return { q, page, sort, dir, ascending: dir === "asc", from: (page - 1) * pageSize, to: page * pageSize - 1, pageSize };
}

/** Escape user input for PostgREST ilike/or filters. */
export function ilikeTerm(q: string) {
  return `%${q.replace(/[%_\\]/g, (m) => `\\${m}`).replace(/[,()"]/g, " ")}%`;
}
