// Date handling. All dates are integer "day numbers" (days since 1970-01-01, UTC).
// Ranges are inclusive at the precision written (decision 5).

export type Range = { start?: number; end?: number };

const DAY = 86_400_000;

export function dayNum(y: number, m: number, d: number): number {
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  return Math.floor(dt.getTime() / DAY);
}
export function ymd(n: number): [number, number, number] {
  const dt = new Date(n * DAY);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}
export function fmt(n: number): string {
  const [y, m, d] = ymd(n);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export function daysInMonth(y: number, m: number): number {
  return ymd(dayNum(y, m + 1, 0))[2];
}
export function isWorkday(n: number): boolean {
  const wd = new Date(n * DAY).getUTCDay();
  return wd !== 0 && wd !== 6;
}

/** Month key = y*12 + (m-1) */
export function monthKey(n: number): number {
  const [y, m] = ymd(n);
  return y * 12 + (m - 1);
}
export function monthLabel(k: number): string {
  return `${String(Math.floor(k / 12)).padStart(4, "0")}-${String((k % 12) + 1).padStart(2, "0")}`;
}
export function monthStart(k: number): number {
  return dayNum(Math.floor(k / 12), (k % 12) + 1, 1);
}
export function monthEnd(k: number): number {
  return monthStart(k + 1) - 1;
}

export class DateError extends Error {}

/** Parse one point token at its own precision → [first day, last day]. */
export function parsePoint(tok: string): [number, number] {
  let m: RegExpMatchArray | null;
  if ((m = tok.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo))
      throw new DateError(`date does not exist: ${tok}`);
    const n = dayNum(y, mo, d);
    return [n, n];
  }
  if ((m = tok.match(/^(\d{4})-(\d{2})$/))) {
    const [y, mo] = [+m[1], +m[2]];
    if (mo < 1 || mo > 12) throw new DateError(`month does not exist: ${tok}`);
    return [dayNum(y, mo, 1), dayNum(y, mo, daysInMonth(y, mo))];
  }
  if ((m = tok.match(/^(\d{4})-Q([1-4])$/))) {
    const y = +m[1], q = +m[2];
    const m0 = (q - 1) * 3 + 1;
    return [dayNum(y, m0, 1), dayNum(y, m0 + 2, daysInMonth(y, m0 + 2))];
  }
  if ((m = tok.match(/^(\d{4})-W(\d{2})$/))) {
    const y = +m[1], w = +m[2];
    // ISO week 1 contains Jan 4th
    const jan4 = dayNum(y, 1, 4);
    const dow = (new Date(jan4 * DAY).getUTCDay() + 6) % 7; // Mon=0
    const mon = jan4 - dow + (w - 1) * 7;
    if (w < 1 || w > 53 || ymd(mon + 3)[0] !== y) throw new DateError(`week does not exist: ${tok}`);
    return [mon, mon + 6];
  }
  if ((m = tok.match(/^(\d{4})$/))) {
    const y = +m[1];
    return [dayNum(y, 1, 1), dayNum(y, 12, 31)];
  }
  throw new DateError(`not a date: ${tok}`);
}

export function isDateLike(tok: string): boolean {
  return /^(\d{4}([-.]|$)|\.\.)/.test(tok) && !tok.endsWith("%");
}

/** Add a relative offset (+3m, +6w, +10d, +1y) to a start day; returns inclusive end. */
function addRel(start: number, rel: string): number {
  const m = rel.match(/^\+(\d+)([dwmy])$/);
  if (!m) throw new DateError(`bad relative end: ${rel}`);
  const k = +m[1];
  if (!Number.isSafeInteger(k) || k <= 0) throw new DateError(`relative duration must be a positive safe integer: ${rel}`);
  if (m[2] === "d") return start + k - 1;
  if (m[2] === "w") return start + 7 * k - 1;
  const months = m[2] === "m" ? k : 12 * k;
  const [y, mo, d] = ymd(start);
  const t = y * 12 + (mo - 1) + months;
  const ny = Math.floor(t / 12), nm = (t % 12) + 1;
  return dayNum(ny, nm, Math.min(d, daysInMonth(ny, nm))) - 1;
}

/** Parse "A..B", "A..", "..B", "A..+3m" or a single point "2024-Q2". */
export function parseRange(tok: string): Range {
  if (!tok.includes("..")) {
    const [s, e] = parsePoint(tok);
    return { start: s, end: e };
  }
  const parts = tok.split("..");
  if (parts.length !== 2 || (!parts[0] && !parts[1])) throw new DateError(`bad date range: ${tok}`);
  const [a, b] = parts;
  const r: Range = {};
  if (a) r.start = parsePoint(a)[0];
  if (b) {
    if (b.startsWith("+")) {
      if (r.start === undefined) throw new DateError(`relative end needs a start: ${tok}`);
      r.end = addRel(r.start, b);
    } else r.end = parsePoint(b)[1];
  }
  if (r.end !== undefined && (!Number.isFinite(r.end) || !Number.isFinite(ymd(r.end)[0])))
    throw new DateError(`range end is outside the supported date range: ${tok}`);
  if (r.start !== undefined && r.end !== undefined && r.end < r.start)
    throw new DateError(`range ends before it starts: ${tok}`);
  return r;
}

/** Workdays per month inside [s, e]. */
export function workdaysByMonth(s: number, e: number): Map<number, number> {
  const out = new Map<number, number>();
  for (let n = s; n <= e; n++) {
    if (!isWorkday(n)) continue;
    const k = monthKey(n);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
export function workdaysInMonth(k: number): number {
  let c = 0;
  for (let n = monthStart(k); n <= monthEnd(k); n++) if (isWorkday(n)) c++;
  return c;
}
