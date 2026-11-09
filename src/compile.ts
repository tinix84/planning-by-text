// The deep module: compile(files) → { model, diagnostics }. Pure: no file system, no clock.
import { isWorkday, monthKey, monthLabel, workdaysByMonth, workdaysInMonth, monthStart, monthEnd, type Range } from "./dates.ts";
import { parseEffort, parseFile, type Diag, type Loc, type RoleDemand, type Stmt } from "./parse.ts";

export type SourceFile = { path: string; text: string };

export type Person = {
  id: string; name?: string; cap: number; roles: string[]; loc?: string; at: Loc;
  caps: { s: number; e: number; cap: number; at: Loc }[];
};
export type Calendar = { id: string; hpd: number; hpm: number };
export type Node = {
  path: string; id: string; parent?: string; children: string[]; root: string;
  title?: string; own: Range; tags: string[]; effort?: number; roles: RoleDemand[]; loc?: string;
  after: string[]; left?: number; done?: number; prio?: number;
  decl?: Loc; refs: Loc[]; window?: { s: number; e: number }; emptyWindow?: boolean;
  total: number; remaining: number; // rolled up
};
export type BookingStatus = "confirmed" | "requested" | "unspecified";
export type Booking = {
  person: string; path: string; pct: number; s: number; e: number; status: BookingStatus; at: Loc;
  hours: Map<number, number>; // month → hours
};
export type Cell = { hours: number; capHours: number; confirmed: number; requested: number; unspecified: number; parts: { path: string; hours: number; status: BookingStatus }[] };

export type Model = {
  persons: Map<string, Person>;
  calendars: Map<string, Calendar>;
  roots: Set<string>;
  nodes: Map<string, Node>;
  bookings: Booking[];
  months: number[];
  load: Map<string, Map<number, Cell>>;            // person → month → cell
  demand: Map<string, Map<string, Map<number, number>>>; // root → role → month → h
  supply: Map<string, Map<string, Map<number, number>>>;
};

export type CompileOptions = { asOf?: number; defaultHpm?: number };

const EPS = 0.5; // hours tolerance

function add3(m: Map<string, Map<string, Map<number, number>>>, a: string, b: string, k: number, v: number) {
  if (!m.has(a)) m.set(a, new Map());
  const mb = m.get(a)!;
  if (!mb.has(b)) mb.set(b, new Map());
  const mk = mb.get(b)!;
  mk.set(k, (mk.get(k) ?? 0) + v);
}

function lev(a: string, b: string): number {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function suggest(name: string, pool: Iterable<string>): string {
  let best = "", bd = Infinity;
  for (const p of pool) {
    const n = name.toLowerCase(), q = p.toLowerCase();
    const d = n.includes(q) || q.includes(n) ? 1 : lev(name, p);
    if (d < bd) { bd = d; best = p; }
  }
  return best && bd <= Math.max(3, Math.floor(name.length / 3)) ? ` — did you mean +${best}?` : "";
}

export function statusFromFile(file: string): BookingStatus {
  const f = file.replace(/\\/g, "/");
  if (/(^|\/)teams\//.test(f)) return "confirmed";
  if (/(^|\/)projects\//.test(f)) return "requested";
  return "unspecified";
}

export function compile(files: SourceFile[], opts: CompileOptions = {}): { model: Model; diagnostics: Diag[] } {
  const diags: Diag[] = [];
  const D = (level: Diag["level"], code: string, msg: string, loc?: Loc) => diags.push({ level, code, msg, loc });
  const stmts: Stmt[] = [];
  for (const f of files) stmts.push(...parseFile(f.text, f.path, diags));

  const model: Model = {
    persons: new Map(), calendars: new Map(), roots: new Set(), nodes: new Map(), bookings: [],
    months: [], load: new Map(), demand: new Map(), supply: new Map(),
  };
  const defHpm = opts.defaultHpm ?? 164;

  // 1. declarations
  const roleDeclarations = new Map<string, Loc>();
  for (const s of stmts) {
    if (s.kind === "role") {
      const previous = roleDeclarations.get(s.id);
      if (previous) D("error", "E005", `role ${s.id} already declared at ${previous.file}:${previous.line}`, s.at);
      else roleDeclarations.set(s.id, s.at);
    } else if (s.kind === "calendar") {
      if (model.calendars.has(s.id)) D("error", "E005", `calendar ${s.id} declared twice`, s.at);
      model.calendars.set(s.id, { id: s.id, hpd: s.hpd, hpm: s.hpm });
    }
  }
  for (const s of stmts) {
    const refs = s.kind === "person" ? s.roles : s.kind === "project" || s.kind === "task"
      ? [...(s.attrs.other.role?.split(",") ?? []), ...(s.kind === "task" ? s.roles.map((r) => r.role) : [])] : [];
    for (const role of new Set(refs))
      if (!roleDeclarations.has(role)) D("error", "E003", `unknown role ${role}`, s.at);
  }
  for (const s of stmts) {
    if (s.kind === "person") {
      const prev = model.persons.get(s.id);
      if (prev) { D("error", "E005", `person @${s.id} already declared at ${prev.at.file}:${prev.at.line}`, s.at); continue; }
      if (s.loc && !model.calendars.has(s.loc)) D("error", "E003", `unknown calendar loc:${s.loc} for @${s.id}`, s.at);
      model.persons.set(s.id, { id: s.id, name: s.name, cap: s.cap, roles: s.roles, loc: s.loc, at: s.at, caps: [] });
    }
  }
  const rootDecl = new Map<string, Loc>();
  // Keep effort units until inherited calendars are known.
  const effortText = new Map<string, string>(), leftText = new Map<string, string>();
  const defaultRoles = (value?: string): RoleDemand[] => value ? value.split(",").filter(Boolean).map((role) => ({ role })) : [];
  const setCalendar = (n: Node, loc: string | undefined, at: Loc) => {
    if (loc === undefined) return;
    if (!model.calendars.has(loc)) D("error", "E003", `unknown calendar loc:${loc} for +${n.path}`, at);
    n.loc = loc;
  };
  const ensureNode = (path: string): Node => {
    let n = model.nodes.get(path);
    if (n) return n;
    const segs = path.split(".");
    const parent = segs.length > 1 ? segs.slice(0, -1).join(".") : undefined;
    n = { path, id: segs[segs.length - 1], parent, children: [], root: segs[0], own: {}, tags: [], roles: [], after: [], refs: [], total: 0, remaining: 0 };
    model.nodes.set(path, n);
    if (parent) { const p = ensureNode(parent); p.children.push(path); }
    return n;
  };
  for (const s of stmts) {
    if (s.kind !== "project") continue;
    if (rootDecl.has(s.path)) { const p = rootDecl.get(s.path)!; D("error", "E005", `project +${s.path} already declared at ${p.file}:${p.line}`, s.at); continue; }
    rootDecl.set(s.path, s.at);
    model.roots.add(s.path);
    const n = ensureNode(s.path);
    Object.assign(n, { title: s.title, own: s.range, tags: s.tags, roles: defaultRoles(s.attrs.other.role),
      after: s.attrs.after, done: s.attrs.done, prio: s.attrs.prio, decl: s.at });
    setCalendar(n, s.attrs.other.loc, s.at);
    if (s.effort !== undefined) effortText.set(s.path, s.effort);
    if (s.attrs.left !== undefined) leftText.set(s.path, s.attrs.left);
  }
  const rootOk = (path: string, at: Loc): boolean => {
    const r = path.split(".")[0];
    if (model.roots.has(r)) return true;
    D("error", "E002", `unknown root +${r}${suggest(r, model.roots)}`, at);
    return false;
  };

  // 2. tasks
  for (const s of stmts) {
    if (s.kind !== "task") continue;
    if (!rootOk(s.path, s.at)) continue;
    const n = ensureNode(s.path);
    if (n.decl && s.path.includes(".")) { D("error", "E005", `+${s.path} already declared at ${n.decl.file}:${n.decl.line}`, s.at); continue; }
    if (s.effort !== undefined && effortText.has(s.path)) { D("error", "E005", `+${s.path} has more than one effort budget`, s.at); continue; }
    if (!n.decl) n.decl = s.at;
    if (s.title) n.title = s.title;
    if (s.range.start !== undefined || s.range.end !== undefined) n.own = s.range;
    n.tags.push(...s.tags);
    if (s.effort !== undefined) effortText.set(s.path, s.effort);
    if (s.roles.length) n.roles = s.roles;
    else if (s.attrs.other.role) n.roles = defaultRoles(s.attrs.other.role);
    n.after.push(...s.attrs.after);
    if (s.attrs.left !== undefined) leftText.set(s.path, s.attrs.left);
    setCalendar(n, s.attrs.other.loc, s.at);
    n.done = s.attrs.done ?? n.done; n.prio = s.attrs.prio ?? n.prio;
  }

  // 3. capacity changes and bookings (references)
  type RawB = { s: Extract<Stmt, { kind: "booking" }> };
  const rawBookings: RawB[] = [];
  for (const s of stmts) {
    if (s.kind === "capacity") {
      const p = model.persons.get(s.person);
      if (!p) { D("error", "E003", `unknown person @${s.person}`, s.at); continue; }
      if (s.range.start === undefined || s.range.end === undefined) { D("error", "E004", `capacity change needs a full date range`, s.at); continue; }
      p.caps.push({ s: s.range.start, e: s.range.end, cap: s.cap, at: s.at });
    } else if (s.kind === "booking") {
      let ok = true;
      if (!model.persons.has(s.person)) { D("error", "E003", `unknown person @${s.person}`, s.at); ok = false; }
      rootOk(s.path, s.at); // unknown root is an error, but the hours still count in the person's load
      if (!ok) continue;
      ensureNode(s.path).refs.push(s.at);
      rawBookings.push({ s });
    }
  }

  for (const p of model.persons.values()) {
    p.caps.sort((a, b) => a.s - b.s || a.e - b.e || a.at.file.localeCompare(b.at.file) || a.at.line - b.at.line);
    for (let i = 0; i < p.caps.length; i++) {
      const c = p.caps[i];
      for (const prev of p.caps.slice(0, i)) {
        if (prev.e >= c.s)
          D("error", "E008", `@${p.id}: capacity changes overlap with ${prev.at.file}:${prev.at.line}`, c.at);
      }
    }
  }
  const capacityAt = (p: Person, day: number): number => {
    const active = p.caps.filter((c) => c.s <= day && day <= c.e);
    return active.length ? Math.min(...active.map((c) => c.cap)) : p.cap;
  };

  const inherit = (path: string, parent?: Node): void => {
    const n = model.nodes.get(path)!;
    n.tags = [...new Set([...(parent?.tags ?? []), ...n.tags])];
    if (!n.roles.length && parent) n.roles = parent.roles.map((r) => ({ ...r }));
    n.loc ??= parent?.loc;
    const calendar = n.loc ? model.calendars.get(n.loc) : undefined;
    try {
      if (effortText.has(path)) n.effort = parseEffort(effortText.get(path)!, calendar?.hpm ?? defHpm, calendar?.hpd ?? 8);
      if (leftText.has(path)) n.left = parseEffort(leftText.get(path)!, calendar?.hpm ?? defHpm, calendar?.hpd ?? 8);
    } catch (e) {
      D("error", "E001", (e as Error).message, n.decl);
    }
    for (const child of n.children) inherit(child, n);
  };
  for (const root of model.roots) inherit(root);

  // 4. windows (inheritance + after:)
  const resolveRef = (from: string, ref: string): string => {
    const r = ref.replace(/^\+/, "");
    if (r.startsWith("..")) { const segs = from.split("."); return [...segs.slice(0, -2), r.slice(2)].join("."); }
    if (r.startsWith(".")) { const segs = from.split("."); return [...segs.slice(0, -1), r.slice(1)].join("."); }
    return r;
  };
  const state = new Map<string, "busy" | "done">();
  const bounds = new Map<string, { s?: number; e?: number }>();
  const computeWindow = (path: string): void => {
    if (state.get(path) === "done") return;
    const n = model.nodes.get(path)!;
    if (state.get(path) === "busy") { D("error", "E007", `dependency cycle through +${path}`, n.decl); n.window = undefined; n.emptyWindow = true; return; }
    state.set(path, "busy");
    let pw: { s?: number; e?: number } = {};
    if (n.parent) {
      computeWindow(n.parent);
      const p = model.nodes.get(n.parent)!;
      if (p.emptyWindow) {
        n.emptyWindow = true;
        D("warning", "W106", `+${path} inherits an empty parent window`, n.decl);
        state.set(path, "done");
        return;
      }
      pw = bounds.get(n.parent) ?? {};
    }
    let s = n.own.start ?? pw.s, e = n.own.end ?? pw.e;
    if ((pw.s !== undefined && n.own.start !== undefined && n.own.start < pw.s) ||
        (pw.e !== undefined && n.own.end !== undefined && n.own.end > pw.e))
      D("warning", "W106", `+${path} window exceeds its parent window`, n.decl);
    if (pw.s !== undefined) s = Math.max(s ?? pw.s, pw.s);
    if (pw.e !== undefined) e = Math.min(e ?? pw.e, pw.e);
    for (const a of n.after) {
      const target = resolveRef(path, a);
      const t = model.nodes.get(target);
      if (!t) { D("error", "E006", `after:${a} → +${target} not found`, n.decl); continue; }
      computeWindow(target);
      if (t.emptyWindow) {
        n.emptyWindow = true;
        D("warning", "W106", `+${path} cannot follow +${target} with an empty window`, n.decl);
        state.set(path, "done");
        return;
      }
      const end = bounds.get(target)?.e;
      if (end === undefined) {
        n.emptyWindow = true;
        D("warning", "W106", `+${path} cannot follow +${target} without an end date`, n.decl);
        state.set(path, "done");
        return;
      }
      s = Math.max(s ?? -Infinity, end + 1);
    }
    n.window = s !== undefined && e !== undefined && isFinite(s) ? { s, e } : undefined;
    if (n.window && n.window.e < n.window.s) {
      D("warning", "W106", `+${path} has no dates within its parent and predecessor constraints`, n.decl);
      n.window = undefined; n.emptyWindow = true;
    }
    if (!n.emptyWindow) bounds.set(path, { s, e });
    state.set(path, "done");
  };
  for (const p of model.nodes.keys()) computeWindow(p);

  // 5. phantom paths (referenced but never declared, no declared descendants)
  const hasDeclBelow = (n: Node): boolean => !!n.decl || n.children.some((c) => hasDeclBelow(model.nodes.get(c)!));
  for (const n of model.nodes.values())
    if (n.parent && !hasDeclBelow(n) && n.refs.length)
      D("warning", "W103", `+${n.path} is used but never declared as a task${suggest(n.id, [...(model.nodes.get(n.parent)?.children ?? [])].filter((c) => c !== n.path).map((c) => c.split(".").pop()!)).replace("+", ".")}`, n.refs[0]);

  // 6. roll-up and demand
  const asOf = opts.asOf;
  const months = new Set<number>();
  const spread = (h: number, s: number, e: number): Map<number, number> => {
    const wd = workdaysByMonth(s, e);
    let tot = 0; for (const v of wd.values()) tot += v;
    const out = new Map<number, number>();
    if (tot === 0) return out;
    for (const [k, v] of wd) out.set(k, (h * v) / tot);
    return out;
  };
  const roll = (path: string): [number, number] => {
    const n = model.nodes.get(path)!;
    let tot = 0, rem = 0;
    for (const c of n.children) { const [t, r] = roll(c); tot += t; rem += r; }
    const leafEffort = n.children.length === 0 || tot === 0;
    if (n.effort !== undefined) {
      if (!leafEffort) {
        if (tot > n.effort + EPS) D("warning", "W109", `+${path}: children need ${Math.round(tot)} h, more than its budget ~${n.effort}h`, n.decl);
      } else {
        const left = n.left ?? (n.done !== undefined ? n.effort * (1 - n.done) : n.effort);
        tot = n.effort; rem = left;
        if (!n.window) {
          if (n.emptyWindow) { n.total = tot; n.remaining = rem; return [tot, rem]; }
          const w = noWindow.get(n.root) ?? { count: 0, hours: 0, at: n.decl };
          w.count++; w.hours += n.effort; noWindow.set(n.root, w);
        } else {
          let s = n.window.s;
          if (n.left !== undefined || n.done !== undefined) if (asOf !== undefined) s = Math.max(s, asOf);
          if (left > 0 && workdaysByMonth(s, n.window.e).size === 0) {
            D("warning", "W110", `+${path}: ${left} h has no working days within its remaining window`, n.decl);
          } else if (s <= n.window.e) {
            const roles = n.roles.length ? n.roles : [{ role: "(no role)" }];
            const explicit = roles.reduce((a, r) => a + (r.share ?? 0), 0);
            const unshared = roles.filter((r) => r.share === undefined).length;
            for (const r of roles) {
              const share = r.share ?? (unshared ? Math.max(0, 1 - explicit) / unshared : 0);
              for (const [k, v] of spread(left * share, s, n.window.e)) { add3(model.demand, n.root, r.role, k, v); months.add(k); }
            }
          }
        }
      }
    }
    n.total = tot; n.remaining = rem;
    return [tot, rem];
  };
  const noWindow = new Map<string, { count: number; hours: number; at?: Loc }>();
  for (const r of model.roots) roll(r);
  for (const [r, w] of noWindow)
    D("warning", "W108", `+${r}: ${w.count} task(s) with ${Math.round(w.hours)} h of effort have no window, so they create no demand (add dates to +${r} or to its nodes)`, w.at);

  // 7. bookings → hours per month
  const hpmOf = (p: Person) => (p.loc ? model.calendars.get(p.loc)?.hpm : undefined) ?? defHpm;
  for (const { s } of rawBookings) {
    const n = model.nodes.get(s.path)!;
    const st = s.range.start ?? n.window?.s, en = s.range.end ?? n.window?.e;
    if (st === undefined || en === undefined) { D("error", "E004", `booking @${s.person} +${s.path} has no dates and none to inherit`, s.at); continue; }
    const p = model.persons.get(s.person)!;
    const status: BookingStatus = (s.status as BookingStatus) ?? statusFromFile(s.at.file);
    const hours = new Map<number, number>();
    for (const [k, wd] of workdaysByMonth(st, en)) { hours.set(k, s.pct * hpmOf(p) * wd / workdaysInMonth(k)); months.add(k); }
    model.bookings.push({ person: s.person, path: s.path, pct: s.pct, s: st, e: en, status, at: s.at, hours });
  }
  const bookingKey = (b: Booking) => JSON.stringify([b.person, b.path, b.pct, b.s, b.e]);
  const byLocation = (a: Booking, b: Booking) => a.at.file.localeCompare(b.at.file) || a.at.line - b.at.line;
  const confirmations = new Map<string, Booking[]>();
  for (const b of [...model.bookings].sort(byLocation)) {
    if (b.status !== "confirmed") continue;
    const key = bookingKey(b);
    if (!confirmations.has(key)) confirmations.set(key, []);
    confirmations.get(key)!.push(b);
  }
  const replaced = new Set<Booking>();
  for (const b of [...model.bookings].sort(byLocation)) {
    if (b.status !== "requested") continue;
    const confirmation = confirmations.get(bookingKey(b))?.shift();
    if (!confirmation) continue;
    replaced.add(b);
    D("info", "I202", `request confirmed at ${confirmation.at.file}:${confirmation.at.line}`, b.at);
  }
  model.bookings = model.bookings.filter((b) => !replaced.has(b));
  for (const b of model.bookings) {
    const p = model.persons.get(b.person)!;
    if (b.pct > 0) {
      for (let day = b.s; day <= b.e; day++) {
        if (isWorkday(day) && capacityAt(p, day) === 0) {
          D("warning", "W102", `@${b.person} has zero capacity during its booking on +${b.path}`, b.at);
          break;
        }
      }
    }
    if (b.status === "requested") D("info", "I201", `requested booking: @${b.person} +${b.path} ${Math.round(b.pct * 100)}%`, b.at);
  }

  // 8. load with pools and pins
  model.months = [...months].sort((a, b) => a - b);
  const byPerson = new Map<string, Booking[]>();
  for (const b of model.bookings) { if (!byPerson.has(b.person)) byPerson.set(b.person, []); byPerson.get(b.person)!.push(b); }
  for (const p of model.persons.values()) {
    const row = new Map<number, Cell>();
    model.load.set(p.id, row);
    const bs = byPerson.get(p.id) ?? [];
    const over: string[] = []; let peak = 0;
    const pinWarned = new Set<string>();
    for (const k of model.months) {
      const wdm = workdaysInMonth(k);
      let capH = 0;
      for (let day = monthStart(k); day <= monthEnd(k); day++)
        if (isWorkday(day)) capH += capacityAt(p, day);
      capH = capH / wdm * hpmOf(p);
      const active = bs.filter((b) => (b.hours.get(k) ?? 0) > 0);
      const cell: Cell = { hours: 0, capHours: capH, confirmed: 0, requested: 0, unspecified: 0, parts: [] };
      const groups = new Map<string, Booking[]>();
      for (const b of active) {
        if (!groups.has(b.path)) groups.set(b.path, []);
        groups.get(b.path)!.push(b);
      }
      const children = new Map<string, string[]>(), tops: string[] = [];
      for (const path of groups.keys()) {
        let parent = path;
        do { parent = parent.includes(".") ? parent.slice(0, parent.lastIndexOf(".")) : ""; }
        while (parent && !groups.has(parent));
        if (parent) {
          if (!children.has(parent)) children.set(parent, []);
          children.get(parent)!.push(path);
        } else tops.push(path);
      }
      const ownHours = (path: string) => groups.get(path)!.reduce((sum, b) => sum + b.hours.get(k)!, 0);
      const effectiveParts = (path: string): Cell["parts"] => {
        const own = ownHours(path);
        const pins = children.get(path) ?? [];
        const parts = pins.flatMap(effectiveParts);
        const pinSum = parts.reduce((sum, part) => sum + part.hours, 0);
        if (pinSum > own + EPS && !pinWarned.has(path)) {
          pinWarned.add(path);
          D("warning", "W105", `@${p.id}: bookings under +${path} need ${Math.round(pinSum)} h in ${monthLabel(k)}, more than the pool's ${Math.round(own)} h`, groups.get(pins[0])![0].at);
        }
        const residual = Math.max(0, own - pinSum);
        for (const b of groups.get(path)!)
          parts.push({ path, hours: residual * b.hours.get(k)! / own, status: b.status });
        return parts;
      };
      for (const path of tops) {
        const parts = effectiveParts(path);
        const eff = parts.reduce((sum, part) => sum + part.hours, 0);
        cell.hours += eff;
        for (const part of parts) {
          if (part.status === "requested") cell.requested += part.hours;
          else if (part.status === "confirmed") cell.confirmed += part.hours;
          else cell.unspecified += part.hours;
        }
        cell.parts.push(...parts);
        const role = p.roles[0] ?? "(no role)";
        add3(model.supply, path.split(".")[0], role, k, eff);
      }
      row.set(k, cell);
      if (cell.hours > capH + EPS) {
        over.push(monthLabel(k));
        peak = Math.max(peak, capH > 0 ? cell.hours / capH : Infinity);
      }
    }
    if (over.length)
      D("warning", "W101", `@${p.id} overloaded in ${over.length} month(s) (${compactMonths(over)}), peak ${isFinite(peak) ? Math.round(peak * 100) + "%" : "∞"} of capacity`, p.at);
  }

  // 9. role balance
  for (const [root, roles] of model.demand) {
    for (const [role, dm] of roles) {
      const sm = model.supply.get(root)?.get(role);
      const short: string[] = []; let gap = 0;
      for (const [k, d] of dm) { const s = sm?.get(k) ?? 0; if (d > s + EPS) { short.push(monthLabel(k)); gap += d - s; } }
      if (short.length)
        D("warning", "W104", `+${root} ?${role}: demand exceeds supply in ${short.length} month(s) (${compactMonths(short)}), short ${Math.round(gap)} h in total`, model.nodes.get(root)?.decl);
    }
  }

  diags.sort((a, b) => (a.loc?.file ?? "").localeCompare(b.loc?.file ?? "") || (a.loc?.line ?? 0) - (b.loc?.line ?? 0));
  return { model, diagnostics: diags };
}

/** ["2024-01","2024-02","2024-03","2024-06"] → "2024-01..2024-03, 2024-06" */
export function compactMonths(ms: string[]): string {
  const ks = ms.map((m) => +m.slice(0, 4) * 12 + +m.slice(5) - 1).sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < ks.length; ) {
    let j = i; while (j + 1 < ks.length && ks[j + 1] === ks[j] + 1) j++;
    out.push(i === j ? monthLabel(ks[i]) : `${monthLabel(ks[i])}..${monthLabel(ks[j])}`);
    i = j + 1;
  }
  return out.join(", ");
}

export { monthKey };
