// Pure views of the model, shared by the HTML report and the spreadsheet export.
import { fmt, monthLabel } from "./dates.ts";
import type { Cell, Model } from "./compile.ts";

export type LoadRow = { person: string; name: string; role: string; cap: number; cells: (Cell | undefined)[] };
export type RoleRow = { root: string; role: string; demand: number[]; supply: number[] };
export type TreeRow = {
  path: string; depth: number; title: string; effort: number; remaining: number;
  roles: string; window: string; declared: boolean; tags: string;
};

export const monthHeaders = (m: Model) => m.months.map(monthLabel);

export function loadRows(m: Model): LoadRow[] {
  return [...m.persons.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({
      person: p.id, name: p.name ?? p.id, role: p.roles[0] ?? "", cap: p.cap,
      cells: m.months.map((k) => m.load.get(p.id)?.get(k)),
    }));
}

export function roleRows(m: Model): RoleRow[] {
  const out: RoleRow[] = [];
  for (const root of [...m.roots].sort()) {
    const roles = new Set([...(m.demand.get(root)?.keys() ?? []), ...(m.supply.get(root)?.keys() ?? [])]);
    for (const role of [...roles].sort()) {
      const d = m.demand.get(root)?.get(role), s = m.supply.get(root)?.get(role);
      out.push({ root, role, demand: m.months.map((k) => d?.get(k) ?? 0), supply: m.months.map((k) => s?.get(k) ?? 0) });
    }
  }
  return out;
}

export function treeRows(m: Model): TreeRow[] {
  const out: TreeRow[] = [];
  const visit = (path: string, depth: number) => {
    const n = m.nodes.get(path)!;
    out.push({
      path, depth, title: n.title ?? "", effort: n.total, remaining: n.remaining,
      roles: n.roles.map((r) => r.role + (r.share !== undefined ? `:${Math.round(r.share * 100)}%` : "")).join(" "),
      window: n.window ? `${fmt(n.window.s)}..${fmt(n.window.e)}` : "",
      declared: !!n.decl, tags: n.tags.join(" "),
    });
    for (const c of [...n.children].sort()) visit(c, depth + 1);
  };
  for (const r of [...m.roots].sort()) visit(r, 0);
  return out;
}

export const loadPct = (c?: Cell): number | undefined =>
  !c || c.hours === 0 ? undefined : c.capHours > 0 ? c.hours / c.capHours : Infinity;
