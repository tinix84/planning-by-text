// Line parser. One line = one fact. No parser generator: the grammar is line-oriented.
import { DateError, isDateLike, parseRange, type Range } from "./dates.ts";

export type Loc = { file: string; line: number };
export type Diag = { level: "error" | "warning" | "info"; code: string; msg: string; loc?: Loc };

export type RoleDemand = { role: string; share?: number };

export type Stmt =
  | { kind: "person"; id: string; name?: string; cap: number; roles: string[]; loc?: string; tags: string[]; at: Loc }
  | { kind: "project"; path: string; title?: string; range: Range; tags: string[]; attrs: Attrs; at: Loc }
  | { kind: "calendar"; id: string; hpd: number; hpm: number; at: Loc }
  | { kind: "role"; id: string; title?: string; at: Loc }
  | { kind: "task"; path: string; title?: string; range: Range; effort?: number; roles: RoleDemand[]; tags: string[]; attrs: Attrs; at: Loc }
  | { kind: "booking"; person: string; path: string; pct: number; range: Range; status?: string; tags: string[]; at: Loc }
  | { kind: "capacity"; person: string; cap: number; range: Range; at: Loc };

export type Attrs = {
  after: string[];
  left?: number;
  done?: number;
  prio?: number;
  status?: string;
  other: Record<string, string>;
};

export const ID = /^[A-Za-z0-9_-]+$/;
export const PATH = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

/** Split a line into tokens; "quoted strings" stay one token. Strips comments. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "#" && (line[i + 1] === undefined || line[i + 1] === " " || line[i + 1] === "\t")) break; // comment
    if (c === "/" && line[i + 1] === "/") break;
    if (c === '"') {
      const j = line.indexOf('"', i + 1);
      if (j < 0) { out.push(line.slice(i)); break; }
      out.push(line.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < line.length && line[j] !== " " && line[j] !== "\t") j++;
    out.push(line.slice(i, j));
    i = j;
  }
  return out;
}

/** Effort in hours: 540h, 20d (8h), 3pm (person-months), bare number = hours. */
export function parseEffort(s: string, hpm = 164, hpd = 8): number {
  const m = s.match(/^(\d+(?:\.\d+)?)(h|d|pm)?$/);
  if (!m) throw new Error(`bad effort: ${s}`);
  const v = +m[1];
  return m[2] === "d" ? v * hpd : m[2] === "pm" ? v * hpm : v;
}

function parsePct(s: string): number {
  const m = s.match(/^(\d+(?:\.\d+)?)%$/);
  if (!m) throw new Error(`bad percentage: ${s}`);
  return +m[1] / 100;
}

export function parseFile(text: string, file: string, diags: Diag[]): Stmt[] {
  const out: Stmt[] = [];
  text.split(/\r?\n/).forEach((raw, idx) => {
    const at = { file, line: idx + 1 };
    const toks = tokenize(raw);
    if (toks.length === 0) return;
    try {
      const s = parseLine(toks, at);
      if (s) out.push(s);
    } catch (e) {
      const code = e instanceof DateError ? "E004" : "E001";
      diags.push({ level: "error", code, msg: (e as Error).message + `  ⟶  ${raw.trim()}`, loc: at });
    }
  });
  return out;
}

type Common = { title?: string; range: Range; tags: string[]; attrs: Attrs; rest: string[] };

function common(toks: string[]): Common {
  const c: Common = { range: {}, tags: [], attrs: { after: [], other: {} }, rest: [] };
  let haveRange = false;
  for (const t of toks) {
    if (t.startsWith('"')) c.title = t.replace(/^"|"$/g, "");
    else if (t.startsWith("#") && t.length > 1) c.tags.push(t.slice(1));
    else if (/^!\d$/.test(t)) c.attrs.prio = +t.slice(1);
    else if (isDateLike(t)) {
      if (haveRange) throw new Error(`two date ranges on one line: ${t}`);
      c.range = parseRange(t);
      haveRange = true;
    } else if (/^[a-z][a-z_]*:/.test(t)) {
      const k = t.slice(0, t.indexOf(":"));
      const v = t.slice(t.indexOf(":") + 1);
      if (k === "after") c.attrs.after.push(...v.split(",").filter(Boolean));
      else if (k === "left") c.attrs.left = parseEffort(v);
      else if (k === "done") c.attrs.done = parsePct(v);
      else if (k === "status") c.attrs.status = v;
      else c.attrs.other[k] = v;
    } else c.rest.push(t);
  }
  return c;
}

function parseLine(toks: string[], at: Loc): Stmt | null {
  const head = toks[0];

  if (head === "person") {
    const id = toks[1];
    if (!id?.startsWith("@") || !ID.test(id.slice(1))) throw new Error(`person needs an @id: ${id ?? ""}`);
    const c = common(toks.slice(2));
    if (c.rest.length) throw new Error(`unexpected: ${c.rest.join(" ")}`);
    const cap = c.attrs.other.cap !== undefined ? parsePct(c.attrs.other.cap) : 1;
    const roles = c.attrs.other.role ? c.attrs.other.role.split(",").filter(Boolean) : [];
    return { kind: "person", id: id.slice(1), name: c.title, cap, roles, loc: c.attrs.other.loc, tags: c.tags, at };
  }

  if (head === "project") {
    const p = toks[1];
    if (!p?.startsWith("+") || !ID.test(p.slice(1))) throw new Error(`project needs a +ROOT id without dots or spaces: ${p ?? ""}`);
    const c = common(toks.slice(2));
    if (c.rest.length) throw new Error(`unexpected: ${c.rest.join(" ")}`);
    return { kind: "project", path: p.slice(1), title: c.title, range: c.range, tags: c.tags, attrs: c.attrs, at };
  }

  if (head === "calendar") {
    const id = toks[1];
    const hpd = toks.find((t) => /h\/d$/.test(t));
    const hpm = toks.find((t) => /h\/m$/.test(t));
    if (!id || !hpm) throw new Error(`calendar needs: calendar <ID> <n>h/d <n>h/m`);
    return { kind: "calendar", id, hpd: hpd ? parseFloat(hpd) : 8, hpm: parseFloat(hpm), at };
  }

  if (head === "role") {
    const c = common(toks.slice(2));
    return { kind: "role", id: toks[1], title: c.title, at };
  }

  if (head.startsWith("@")) {
    const person = head.slice(1);
    if (!ID.test(person)) throw new Error(`bad person id: ${head}`);
    const pathTok = toks.find((t) => t.startsWith("+"));
    const c = common(toks.slice(1).filter((t) => t !== pathTok));
    if (!pathTok) {
      // capacity change over time: @falk cap:50% 2024-07..2024-12
      if (c.attrs.other.cap === undefined) throw new Error(`booking needs a +path (or cap: for a capacity change)`);
      return { kind: "capacity", person, cap: parsePct(c.attrs.other.cap), range: c.range, at };
    }
    const path = pathTok.slice(1);
    if (!PATH.test(path)) throw new Error(`bad path: ${pathTok}`);
    const pctTok = c.rest.find((t) => t.endsWith("%"));
    if (!pctTok) throw new Error(`booking needs a load, e.g. 50%`);
    const extra = c.rest.filter((t) => t !== pctTok);
    if (extra.length) throw new Error(`unexpected: ${extra.join(" ")}`);
    return { kind: "booking", person, path, pct: parsePct(pctTok), range: c.range, status: c.attrs.status, tags: c.tags, at };
  }

  if (head.startsWith("+")) {
    const path = head.slice(1);
    if (!PATH.test(path)) throw new Error(`bad path (ids are [A-Za-z0-9_-], no spaces): ${head}`);
    const c = common(toks.slice(1));
    let effort: number | undefined;
    const roles: RoleDemand[] = [];
    for (const t of c.rest) {
      if (t.startsWith("~")) effort = parseEffort(t.slice(1));
      else if (t.startsWith("?")) {
        const [r, sh] = t.slice(1).split(":");
        roles.push({ role: r, share: sh ? parsePct(sh) : undefined });
      } else throw new Error(`unexpected: ${t}`);
    }
    return { kind: "task", path, title: c.title, range: c.range, effort, roles, tags: c.tags, attrs: c.attrs, at };
  }

  throw new Error(`cannot tell what this line is (start with person/project/calendar/role, @person or +path)`);
}
