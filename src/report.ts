// Self-contained HTML report: inline CSS + a tiny filter script, light and dark.
import type { Diag } from "./parse.ts";
import type { Model } from "./compile.ts";
import { loadPct, loadRows, monthHeaders, roleRows, treeRows } from "./views.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const r0 = (x: number) => Math.round(x).toString();

export function renderReport(model: Model, diags: Diag[], opts: { title?: string; generated?: string } = {}): string {
  const months = monthHeaders(model);
  const mh = months.map((m) => `<th class="m">${m.slice(2)}</th>`).join("");
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of diags) counts[d.level]++;

  const diagRows = diags.map((d) =>
    `<tr class="f lv-${d.level}"><td><span class="tag ${d.level}">${d.code}</span></td><td class="mono">${esc(d.loc ? `${d.loc.file}:${d.loc.line}` : "")}</td><td>${esc(d.msg)}</td></tr>`).join("");

  const heat = loadRows(model).map((r) => {
    const cells = r.cells.map((c) => {
      const p = loadPct(c);
      if (p === undefined) return `<td class="h z"></td>`;
      const band = !isFinite(p) ? "x" : p > 1.005 ? "o" : p >= 0.8 ? "f" : "u";
      const tip = `${r.person} — ${r0(c!.hours)} h of ${r0(c!.capHours)} h` +
        (c!.requested ? ` (${r0(c!.requested)} h requested)` : "") + "\n" +
        c!.parts.filter((x) => x.hours > 0).map((x) => `+${x.path}: ${r0(x.hours)} h${x.status === "requested" ? " (req.)" : ""}`).join("\n");
      return `<td class="h ${band}${c!.requested ? " rq" : ""}" title="${esc(tip)}">${isFinite(p) ? Math.round(p * 100) : "∞"}</td>`;
    }).join("");
    return `<tr class="f"><th class="pl">${esc(r.name)}<small> @${esc(r.person)} · ${esc(r.role || "no role")} · ${Math.round(r.cap * 100)}%</small></th>${cells}</tr>`;
  }).join("");

  const roles = roleRows(model).map((r) => {
    const cells = r.demand.map((d, i) => {
      const s = r.supply[i];
      if (d < 0.5 && s < 0.5) return `<td class="b z"></td>`;
      const cls = d > s + 0.5 ? "short" : "ok";
      return `<td class="b ${cls}" title="demand ${r0(d)} h / supply ${r0(s)} h"><span>${r0(d)}</span><span>${r0(s)}</span></td>`;
    }).join("");
    return `<tr class="f"><th class="pl">+${esc(r.root)}<small> ?${esc(r.role)}</small></th>${cells}</tr>`;
  }).join("");

  const tree = treeRows(model).map((t) =>
    `<tr class="f${t.declared ? "" : " undecl"}"><td class="mono" style="padding-left:${0.5 + t.depth * 1.1}rem">${esc(t.path.split(".").pop()!)}</td><td>${esc(t.title)}</td><td class="num">${t.effort ? r0(t.effort) : ""}</td><td class="num">${t.remaining && t.remaining !== t.effort ? r0(t.remaining) : ""}</td><td class="mono">${esc(t.roles)}</td><td class="mono">${esc(t.window)}</td><td>${esc(t.tags)}</td></tr>`).join("");

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
</style></head><body><main>
<h1>${esc(title)}</h1>
<p class="sub">${model.persons.size} people · ${model.roots.size} roots · ${model.bookings.length} bookings · ${months[0] ?? ""}–${months[months.length - 1] ?? ""}${opts.generated ? ` · generated ${esc(opts.generated)}` : ""}</p>
<div class="bar"><input id="q" placeholder="Filter people, projects, roles, messages…" aria-label="Filter">
<label class="pill"><input type="checkbox" id="noinfo" checked style="min-width:0"> hide info</label>
<span class="pill">${counts.error} errors</span><span class="pill">${counts.warning} warnings</span><span class="pill">${counts.info} info</span></div>

<h2>Load per person and month (% of capacity)</h2>
<div class="legend"><span><i style="background:var(--u)"></i>&lt; 80%</span><span><i style="background:var(--f)"></i>80–100%</span><span><i style="background:var(--o)"></i>&gt; 100%</span><span><i style="background:var(--x)"></i>booked at 0% capacity</span><span><i style="outline:2px dashed var(--acc);outline-offset:-2px"></i>contains requested hours</span></div>
<div class="wrap"><table><thead><tr><th class="pl">Person</th>${mh}</tr></thead><tbody>${heat}</tbody></table></div>

<h2>Demand vs supply per role (hours: demand above, supply below)</h2>
<div class="wrap"><table><thead><tr><th class="pl">Root · role</th>${mh}</tr></thead><tbody>${roles || `<tr><td>No demand or supply.</td></tr>`}</tbody></table></div>

<h2>Diagnostics</h2>
<div class="wrap"><table><thead><tr><th>Code</th><th>Where</th><th>Message</th></tr></thead><tbody id="diags">${diagRows || `<tr><td colspan=3>No findings.</td></tr>`}</tbody></table></div>

<h2>Work tree</h2>
<div class="wrap"><table><thead><tr><th>Node</th><th>Title</th><th class="num">Effort h</th><th class="num">Left h</th><th>Roles</th><th>Window</th><th>Tags</th></tr></thead><tbody>${tree}</tbody></table></div>
</main>
<script>
(function(){var q=document.getElementById("q"),ni=document.getElementById("noinfo");
function run(){var t=q.value.toLowerCase();document.querySelectorAll("tr.f").forEach(function(r){var hit=!t||r.textContent.toLowerCase().indexOf(t)>=0||(r.innerHTML.toLowerCase().indexOf(t)>=0);var info=ni.checked&&r.classList.contains("lv-info");r.classList.toggle("hide",!hit||info);});}
q.addEventListener("input",run);ni.addEventListener("change",run);run();})();
</script></body></html>`;
}
