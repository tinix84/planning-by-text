// Qualification checks do not change demand, capacity, or booking hours.
import type { Diag, Loc, Stmt } from "./parse.ts";
import type { Model } from "./compile.ts";

export type Competency = { id: string; title?: string; at: Loc };
export type Profile = Competency & { levels: Record<string, number> };
export type Assessment = { person: string; active: boolean; levels: Record<string, number>; at: Loc };
export type CompetencyCheck = { competency: string; required: number; actual?: number; status: "meets" | "below" | "unknown" };
export type ProfileMatch = { person: string; name: string; profile: string; active: boolean; coverage?: number; checks: CompetencyCheck[] };

export function matchProfile(model: Model, person: string, profile: string): ProfileMatch {
  const requirement = model.profiles.get(profile);
  const p = model.persons.get(person);
  if (!requirement || !p) throw new Error("profile matching needs a known person and profile");
  const assessment = model.assessments.get(person);
  const checks: CompetencyCheck[] = Object.entries(requirement.levels)
    .filter(([, required]) => required > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([competency, required]) => {
      const value = assessment?.levels[competency];
      const actual = value !== undefined && value > 0 ? value : undefined;
      return { competency, required, actual, status: actual === undefined ? "unknown" : actual >= required ? "meets" : "below" };
    });
  return { person, name: p.name ?? person, profile, active: assessment?.active ?? true,
    coverage: checks.length ? checks.filter((c) => c.status === "meets").length / checks.length : undefined, checks };
}

export function compileCompetencies(stmts: Stmt[], model: Model, diagnostics: Diag[]): void {
  const error = (code: string, msg: string, loc: Loc) => diagnostics.push({ level: "error", code, msg, loc });
  for (const s of stmts) {
    if (s.kind !== "competency" && s.kind !== "profile" && s.kind !== "assessment") continue;
    const key = s.kind === "assessment" ? s.person : s.id;
    const registry = s.kind === "competency" ? model.competencies : s.kind === "profile" ? model.profiles : model.assessments;
    const prev = registry.get(key);
    if (prev) { error("E005", `${s.kind} ${key} already declared at ${prev.at.file}:${prev.at.line}`, s.at); continue; }
    if (s.kind === "competency") model.competencies.set(key, s);
    else if (s.kind === "profile") model.profiles.set(key, s);
    else model.assessments.set(key, s);
  }
  for (const s of [...model.profiles.values(), ...model.assessments.values()]) {
    for (const id of Object.keys(s.levels))
      if (!model.competencies.has(id)) error("E003", `unknown competency ${id}`, s.at);
    if ("person" in s && !model.persons.has(s.person)) error("E003", `unknown person @${s.person}`, s.at);
  }
  for (const s of stmts) {
    if ((s.kind === "task" || s.kind === "project") && s.attrs.other.profile && !model.profiles.has(s.attrs.other.profile))
      error("E003", `unknown profile ${s.attrs.other.profile}`, s.at);
  }
  for (const b of model.bookings) {
    if (b.pct <= 0 || !b.hours.size) continue;
    const profile = model.nodes.get(b.path)?.profile;
    if (!profile || !model.profiles.has(profile)) continue;
    const match = matchProfile(model, b.person, profile);
    const warn = (code: string, msg: string) => diagnostics.push({ level: "warning", code, msg, loc: b.at });
    const below = match.checks.filter((c) => c.status === "below");
    const unknown = match.checks.filter((c) => c.status === "unknown");
    const prefix = `@${b.person} +${b.path} profile:${profile}`;
    if (below.length) warn("W111", `${prefix}: below minimum: ${below.map((c) => `${c.competency} ${c.actual} < ${c.required}`).join(", ")}`);
    if (unknown.length) warn("W112", `${prefix}: not assessed: ${unknown.map((c) => c.competency).join(", ")}`);
    if (!match.active) warn("W113", `${prefix}: assessment marks this person inactive`);
  }
}
