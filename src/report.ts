// Self-contained HTML report: inline CSS + a tiny filter script, light and dark.
import type { Diag } from "./parse.ts";
import type { Booking, Model } from "./compile.ts";
import { fmt } from "./dates.ts";
import { loadPct, loadRows, monthHeaders, roleRows, treeRows } from "./views.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const r0 = (x: number) => Math.round(x).toString();

export function renderReport(model: Model, diags: Diag[], opts: { title?: string; generated?: string; assumptions?: string[] } = {}): string {
  const months = monthHeaders(model);
  const mh = months.map((m) => `<th class="m">${m.slice(2)}</th>`).join("");
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of diags) counts[d.level]++;
  const workRows = treeRows(model);
  const estimateCache = new Map<string, boolean>();
  const hasEstimate = (path: string): boolean => {
    if (estimateCache.has(path)) return estimateCache.get(path)!;
    const n = model.nodes.get(path)!;
    const value = n.effort !== undefined || n.children.some(hasEstimate);
    estimateCache.set(path, value);
    return value;
  };

  const byPerson = new Map<string, Booking[]>();
  for (const b of model.bookings) {
    if (!byPerson.has(b.person)) byPerson.set(b.person, []);
    byPerson.get(b.person)!.push(b);
  }
  const bookingInfo = (b: Booking): string => {
    const node = model.nodes.get(b.path);
    const pin = (byPerson.get(b.person) ?? []).some(parent => b.path.startsWith(parent.path + ".") && b.s <= parent.e && parent.s <= b.e);
    const kind = pin ? "pin" : node?.children.length ? "pool" : b.path === node?.root ? "project booking" : "booking";
    const hours = [...b.hours.values()].reduce((sum, h) => sum + h, 0);
    return `<span class="mono">+${esc(b.path)}</span> <strong class="booking-hours">${r0(hours)} h booked</strong>${node?.title ? ` — ${esc(node.title)}` : ""}<small>${Math.round(b.pct * 1000) / 10}% · ${fmt(b.s)}..${fmt(b.e)} · ${esc(b.status)} · ${kind}</small>`;
  };
  const personDetails = (id: string, name: string): string => {
    const bookings = byPerson.get(id) ?? [];
    const body = bookings.length ? `<ul>${bookings.map(b => `<li>${bookingInfo(b)}</li>`).join("")}</ul>` : "<p>No bookings recorded.</p>";
    return `<details class="drill" data-person="${esc(id)}"><summary>${esc(name)}</summary><div class="drill-body">${body}<p>Hours cover each booking's date range. Project bookings and pools do not identify individual task assignments. Pins consume their pool.</p></div></details>`;
  };
  const projectDetails = (path: string, label = `+${path}`, showWork = true): string => {
    const bookings = model.bookings.filter(b => b.path === path || b.path.startsWith(path + "."));
    const body = bookings.length ? `<ul>${bookings.map(b => `<li><strong>${esc(model.persons.get(b.person)?.name ?? b.person)}</strong> <span class="mono">@${esc(b.person)}</span><br>${bookingInfo(b)}</li>`).join("")}</ul>` : "<p class=unassigned>No bookings recorded. No people are assigned to this project.</p>";
    const descendants = showWork ? workRows.filter(t => t.path.startsWith(path + ".")) : [];
    const work = !showWork ? "" : `<h4>Work breakdown (${descendants.length} items)</h4>` + (descendants.length
      ? `<ul>${descendants.map(t => {
        const node = model.nodes.get(t.path)!;
        const effort = hasEstimate(t.path) ? `${r0(t.effort)} h effort · ${r0(t.remaining)} h remaining` : "Effort not estimated";
        return `<li data-project-work="${esc(t.path)}" style="margin-left:${Math.max(0, t.depth - path.split(".").length) * 12}px"><span class="mono">+${esc(t.path)}</span>${t.title ? `<br><strong>${esc(t.title)}</strong>` : ""}<small>${node.children.length ? "Section" : "Task"} · ${effort}<br>${esc(t.roles || "Role not specified")} · ${esc(t.window || (node.emptyWindow ? "Blocked window" : "No window"))}</small></li>`;
      }).join("")}</ul>` : "<p>No task breakdown is recorded for this project.</p>");
    return `<details class="drill" data-project="${esc(path)}"><summary>${esc(label)}</summary><div class="drill-body"><h4>Booked people</h4>${body}${work}<p>Hours cover each booking's date range. Booking percentages are shares of full time. Pins consume their pool.</p></div></details>`;
  };
  const assumptions = opts.assumptions?.length
    ? `<aside class="assumptions"><details open><summary>Scenario assumptions — unverified (${opts.assumptions.length})</summary><ul>${opts.assumptions.map(a => `<li>${esc(a)}</li>`).join("")}</ul></details></aside>` : "";

  const diagRows = diags.map((d) =>
    `<tr class="f lv-${d.level}"><td><span class="tag ${d.level}">${d.code}</span></td><td class="mono">${esc(d.loc ? `${d.loc.file}:${d.loc.line}` : "")}</td><td>${esc(d.msg)}</td></tr>`).join("");

  const heat = loadRows(model).map((r) => {
    const cells = r.cells.map((c) => {
      const p = loadPct(c);
      if (p === undefined) return `<td class="h z"></td>`;
      const band = !isFinite(p) ? "x" : p > 1.005 ? "o" : p >= 0.8 ? "f" : "u";
      const tip = `${r.person} — ${r0(c!.hours)} h of ${r0(c!.capHours)} h` +
        `\n${r0(c!.confirmed)} h confirmed · ${r0(c!.requested)} h requested · ${r0(c!.unspecified)} h unspecified\n` +
        c!.parts.filter((x) => x.hours > 0).map((x) => `+${x.path}: ${r0(x.hours)} h (${x.status})`).join("\n");
      return `<td class="h ${band}${c!.requested ? " rq" : ""}" title="${esc(tip)}">${isFinite(p) ? Math.round(p * 100) + "%" : "∞"}</td>`;
    }).join("");
    return `<tr class="f"><th class="pl">${personDetails(r.person, r.name)}<small> @${esc(r.person)} · ${esc(r.role || "no role")} · baseline capacity ${Math.round(r.cap * 100)}%</small></th>${cells}</tr>`;
  }).join("");

  const balanceCells = (demand: number[], supply: number[], roleGaps?: boolean[]): string =>
    demand.map((d, i) => {
      const s = supply[i];
      if (d < 0.5 && s < 0.5) return `<td class="b z"></td>`;
      const short = roleGaps?.[i] ?? d > s + 0.5;
      const tip = `demand ${r0(d)} h / forecast supply ${r0(s)} h${roleGaps && short ? "; role shortfall — expand Roles" : ""}`;
      return `<td class="b ${short ? "short" : "ok"}" title="${tip}"><span>${r0(d)}</span><span>${r0(s)}</span></td>`;
    }).join("");
  const projectRoles = new Map<string, ReturnType<typeof roleRows>>();
  for (const r of roleRows(model)) {
    if (!projectRoles.has(r.root)) projectRoles.set(r.root, []);
    projectRoles.get(r.root)!.push(r);
  }
  const roles = [...projectRoles].map(([root, rows]) => {
    const demand = model.months.map((_, i) => rows.reduce((sum, r) => sum + r.demand[i], 0));
    const supply = model.months.map((_, i) => rows.reduce((sum, r) => sum + r.supply[i], 0));
    const gaps = model.months.map((_, i) => rows.some(r => r.demand[i] > r.supply[i] + 0.5));
    const panel = `balance-${root}`;
    const breakdown = rows.map(r => `<tr data-balance-role="${esc(r.role)}"><th class="pl">?${esc(r.role)}</th>${balanceCells(r.demand, r.supply)}</tr>`).join("");
    return `<tr class="f balance-total" data-balance-project="${esc(root)}"><th class="pl">${projectDetails(root)}<button type="button" class="role-toggle" aria-expanded="false" aria-controls="${esc(panel)}">Roles (${rows.length})</button></th>${balanceCells(demand, supply, gaps)}</tr>` +
      `<tr class="balance-panel" id="${esc(panel)}" hidden><td colspan="${model.months.length + 1}"><table><thead><tr><th>Role</th>${mh}</tr></thead><tbody>${breakdown}</tbody></table></td></tr>`;
  }).join("");

  const tree = workRows.map(t => {
    const node = model.nodes.get(t.path)!;
    const estimated = hasEstimate(t.path);
    const controls = node.children.map(path => `tree-${path}`).join(" ");
    const search = [t.path, t.title, t.roles, t.window, t.tags, t.profile].join(" ").toLowerCase();
    const label = node.children.length
      ? `<button type="button" class="tree-toggle" aria-expanded="false" aria-controls="${esc(controls)}" aria-label="Expand ${esc(t.path)}"><span class="tree-arrow" aria-hidden="true">▸</span> ${esc(t.path)}</button>`
      : esc(t.path);
    return `<tr class="f tree-row${t.declared ? "" : " undecl"}" id="tree-${esc(t.path)}" data-tree-path="${esc(t.path)}" data-tree-parent="${esc(node.parent ?? "")}" data-tree-search="${esc(search)}"${node.parent ? " hidden" : ""}><td class="mono" style="padding-left:${0.5 + t.depth * 1.1}rem">${label}${t.depth === 0 ? projectDetails(t.path, "Resources", false) : ""}</td><td>${esc(t.title || "—")}</td><td class="num">${estimated ? r0(t.effort) : "Not estimated"}</td><td class="num">${estimated ? r0(t.remaining) : "—"}</td><td class="mono">${esc(t.roles || "—")}</td><td class="mono">${esc(t.window || (node.emptyWindow ? "Blocked window" : "No window"))}</td><td>${esc(t.tags || "—")}</td><td class="mono">${esc(t.profile || "—")}</td></tr>`;
  }).join("");

  const title = opts.title ?? "Resource plan";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--bg:#fbfaf8;--fg:#1d1d1b;--mut:#6b6a66;--line:#e4e2dc;--card:#fff;--u:#e8f1ea;--uf:#2d6a3e;--f:#fbf0d5;--ff:#7a5600;--o:#f9dcd6;--of:#a3271b;--x:#3a1d1a;--xf:#ffd9d2;--acc:#2f5f9e}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#171716;--fg:#ecebe7;--mut:#9c9a94;--line:#2e2d2a;--card:#1f1e1c;--u:#1d3324;--uf:#9fd3ad;--f:#3b3018;--ff:#f0cd7a;--o:#4a221d;--of:#ffb1a5;--x:#ffb1a5;--xf:#3a1d1a;--acc:#8fb4e8}}
:root[data-theme=dark]{--bg:#171716;--fg:#ecebe7;--mut:#9c9a94;--line:#2e2d2a;--card:#1f1e1c;--u:#1d3324;--uf:#9fd3ad;--f:#3b3018;--ff:#f0cd7a;--o:#4a221d;--of:#ffb1a5;--x:#ffb1a5;--xf:#3a1d1a;--acc:#8fb4e8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1400px;margin:0 auto;padding:24px 16px 64px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 8px}
.sub{color:var(--mut);margin:0 0 16px}.bar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}
input{font:inherit;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);min-width:260px}
.pill{padding:3px 10px;border-radius:999px;background:var(--card);border:1px solid var(--line)}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--card)}
table{border-collapse:collapse;width:100%}th,td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th.m{font-weight:500;color:var(--mut);font-size:11px;text-align:center;min-width:38px}
th.pl{position:sticky;left:0;background:var(--card);white-space:nowrap;font-weight:600;min-width:220px;z-index:1}th.pl small{font-weight:400;color:var(--mut);display:block;font-size:11px}
td.h{text-align:center;font-variant-numeric:tabular-nums;font-size:12px}td.z{background:transparent}
td.u{background:var(--u);color:var(--uf)}td.f{background:var(--f);color:var(--ff)}td.o{background:var(--o);color:var(--of);font-weight:600}td.x{background:var(--x);color:var(--xf);font-weight:700}
td.rq{outline:2px dashed var(--acc);outline-offset:-3px}
td.b{font-size:11px;text-align:center;font-variant-numeric:tabular-nums}td.b span{display:block}td.b span+span{color:var(--mut)}td.short{background:var(--o);color:var(--of)}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}.num{text-align:right;font-variant-numeric:tabular-nums}
.tag{font:600 11px ui-monospace,monospace;padding:1px 6px;border-radius:4px}.tag.error{background:var(--o);color:var(--of)}.tag.warning{background:var(--f);color:var(--ff)}.tag.info{background:var(--u);color:var(--uf)}
tr.undecl td{color:var(--mut);font-style:italic}.legend{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--mut);margin:6px 0}
.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:4px}
.hide{display:none}
.drill summary{cursor:pointer;color:var(--acc);white-space:normal}.drill summary:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
.drill[open]{min-width:290px;max-width:430px}.drill-body{white-space:normal;font-weight:400;font-size:12px;max-height:320px;overflow:auto;padding:6px 2px}
.drill-body ul{padding-left:18px;margin:4px 0}.drill-body li{margin:0 0 10px;overflow-wrap:anywhere}.drill-body p{color:var(--mut);font-size:11px;margin:8px 0}
.drill-body small{display:block;color:var(--mut);font-weight:400}.assumptions{border:1px solid var(--ff);background:var(--f);padding:12px 16px;border-radius:8px;margin:12px 0}
.assumptions summary{cursor:pointer;font-weight:600}.assumptions li{margin-top:6px}
.role-toggle{display:block;margin-top:6px;padding:3px 8px;border:1px solid var(--line);border-radius:5px;background:var(--card);color:var(--acc);font:inherit;font-size:12px;cursor:pointer}
.role-toggle:focus-visible{outline:2px solid var(--acc);outline-offset:2px}.balance-panel>td{padding:8px 12px;background:var(--bg)}
.balance-panel table{background:var(--card)}tr[hidden]{display:none}
.tree-toggle{border:0;background:transparent;color:var(--acc);font:inherit;padding:0;cursor:pointer;text-align:left}
.tree-toggle:focus-visible{outline:2px solid var(--acc);outline-offset:3px}.tree-arrow{display:inline-block;width:12px}
.tree-row .drill{margin-top:4px;font-size:11px}.tree-row .drill[open]{min-width:290px}
.tree-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}.tree-tools button{padding:5px 10px;border:1px solid var(--line);border-radius:5px;background:var(--card);color:var(--acc);font:inherit;cursor:pointer}
.tree-tools button:focus-visible{outline:2px solid var(--acc);outline-offset:2px}.tree-tools span{color:var(--mut);font-size:12px}.drill-body h4{font-size:12px;margin:8px 0}
</style></head><body><main>
<h1>${esc(title)}</h1>
${assumptions}
<p class="sub">${model.persons.size} people · ${model.roots.size} roots · ${model.bookings.length} bookings · ${months[0] ?? ""}–${months[months.length - 1] ?? ""}${opts.generated ? ` · generated ${esc(opts.generated)}` : ""}</p>
<div class="bar"><input id="q" placeholder="Filter people, projects, roles, messages…" aria-label="Filter">
<label class="pill"><input type="checkbox" id="noinfo" checked style="min-width:0"> hide info</label>
<span class="pill">${counts.error} errors</span><span class="pill">${counts.warning} warnings</span><span class="pill">${counts.info} info</span></div>

<h2>Load per person and month (% of capacity)</h2>
<div class="legend"><span><i style="background:var(--u)"></i>&lt; 80%</span><span><i style="background:var(--f)"></i>80–100%</span><span><i style="background:var(--o)"></i>&gt; 100%</span><span><i style="background:var(--x)"></i>booked at 0% capacity</span><span><i style="outline:2px dashed var(--acc);outline-offset:-2px"></i>contains requested hours</span></div>
<div class="wrap"><table><thead><tr><th class="pl">Person</th>${mh}</tr></thead><tbody>${heat}</tbody></table></div>

<h2>Demand vs forecast supply per project (hours: demand above, supply below)</h2>
<p class="sub">One total per project. Expand Roles for the breakdown. Red cells include shortages in individual roles.</p>
<div class="wrap"><table><thead><tr><th class="pl">Project</th>${mh}</tr></thead><tbody>${roles || `<tr><td>No demand or supply.</td></tr>`}</tbody></table></div>

<h2>Diagnostics</h2>
<div class="wrap"><table><thead><tr><th>Code</th><th>Where</th><th>Message</th></tr></thead><tbody id="diags">${diagRows || `<tr><td colspan=3>No findings.</td></tr>`}</tbody></table></div>

<h2>Work tree</h2>
<p class="sub">Expand a root or section to show its children. Resources opens the project's bookings. Bulk controls respect the current filter.</p>
<div class="tree-tools"><button type="button" id="tree-expand-all" aria-controls="work-tree">Expand all</button><button type="button" id="tree-collapse-all" aria-controls="work-tree">Collapse all</button><span id="tree-count" aria-live="polite">${workRows.filter(t => t.depth === 0).length} of ${workRows.length} work items shown</span></div>
<div class="wrap"><table><thead><tr><th>Node</th><th>Title</th><th class="num">Effort h</th><th class="num">Left h</th><th>Roles</th><th>Window</th><th>Tags</th><th>Profile</th></tr></thead><tbody id="work-tree">${tree}</tbody></table></div>
</main>
<script>
(function(){var q=document.getElementById("q"),ni=document.getElementById("noinfo");
function hit(r,t){return !t||r.textContent.toLowerCase().indexOf(t)>=0||r.innerHTML.toLowerCase().indexOf(t)>=0;}
var treeList=Array.from(document.querySelectorAll("#work-tree [data-tree-path]")),treeIndex=new Map(treeList.map(function(r){return [r.dataset.treePath,r];})),treeExpanded=new Set(),treeSearchClosed=new Set(),treeQuery="";
function parents(path){var out=[],r=treeIndex.get(path),p=r&&r.dataset.treeParent;while(p){out.push(p);r=treeIndex.get(p);p=r&&r.dataset.treeParent;}return out;}
function runTree(t){if(t!==treeQuery){treeSearchClosed.clear();treeQuery=t;}var context=new Set(),forced=new Set();
if(t){var matches=new Set(treeList.filter(function(r){return r.dataset.treeSearch.indexOf(t)>=0;}).map(function(r){return r.dataset.treePath;}));var tops=new Set(Array.from(matches).filter(function(path){return !parents(path).some(function(p){return matches.has(p);});}));tops.forEach(function(path){context.add(path);parents(path).forEach(function(p){context.add(p);forced.add(p);});});treeList.forEach(function(r){if(parents(r.dataset.treePath).some(function(p){return tops.has(p);}))context.add(r.dataset.treePath);});}
function opened(path){return (treeExpanded.has(path)||forced.has(path))&&!treeSearchClosed.has(path);}
treeList.forEach(function(r){var path=r.dataset.treePath;r.hidden=!!t&&!context.has(path)||!parents(path).every(opened);var b=r.querySelector(".tree-toggle");if(b){var open=opened(path);b.setAttribute("aria-expanded",String(open));b.setAttribute("aria-label",(open?"Collapse ":"Expand ")+path);b.querySelector(".tree-arrow").textContent=open?"▾":"▸";}});document.getElementById("tree-count").textContent=treeList.filter(function(r){return !r.hidden;}).length+" of "+treeList.length+" work items shown";}
function run(){var t=q.value.toLowerCase();document.querySelectorAll("tr.f:not(.balance-total):not(.tree-row)").forEach(function(r){var info=ni.checked&&r.classList.contains("lv-info");r.classList.toggle("hide",!hit(r,t)||info);});
document.querySelectorAll("tr.balance-total").forEach(function(r){var b=r.querySelector(".role-toggle"),panel=document.getElementById(b.getAttribute("aria-controls")),rows=Array.from(panel.querySelectorAll("[data-balance-role]")),projectHit=!t||r.dataset.balanceProject.toLowerCase().indexOf(t)>=0,roleHit=rows.some(function(row){return hit(row,t);}),show=hit(r,t)||roleHit;r.classList.toggle("hide",!show);panel.hidden=!show||b.getAttribute("aria-expanded")!=="true";rows.forEach(function(row){row.hidden=!projectHit&&roleHit&&!hit(row,t);});});runTree(t);}
document.querySelectorAll(".role-toggle").forEach(function(b){b.addEventListener("click",function(){b.setAttribute("aria-expanded",b.getAttribute("aria-expanded")==="true"?"false":"true");run();});});
document.querySelectorAll(".tree-toggle").forEach(function(b){b.addEventListener("click",function(){var path=b.closest("[data-tree-path]").dataset.treePath;if(b.getAttribute("aria-expanded")==="true"){treeExpanded.delete(path);treeSearchClosed.add(path);}else{treeExpanded.add(path);treeSearchClosed.delete(path);}runTree(q.value.toLowerCase());});});
function treeAll(expand){treeQuery=q.value.toLowerCase();treeExpanded.clear();treeSearchClosed.clear();treeList.forEach(function(r){if(r.querySelector(".tree-toggle")){(expand?treeExpanded:treeSearchClosed).add(r.dataset.treePath);}});runTree(treeQuery);}
document.getElementById("tree-expand-all").addEventListener("click",function(){treeAll(true);});document.getElementById("tree-collapse-all").addEventListener("click",function(){treeAll(false);});
q.addEventListener("input",run);ni.addEventListener("change",run);run();})();
</script></body></html>`;
}
