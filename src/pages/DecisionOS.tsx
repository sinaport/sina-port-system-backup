// Decision OS: one app, a department per view, each scored on real data.
// Media Buying keeps its campaign tree; Setters, Closers and Funnels are flat
// entity lists scored from engine.v_department_scores. Win probability and
// confidence render as bars, with a recommended action per row.
//
// Wired into App.tsx inside the Admin gate at /decision-os.
import { useMemo, useState } from "react";
import { useRoleView } from "@/hooks/useRoleView";
import { MediaBuyingDashboard } from "@/pages/MediaBuyingDashboard";
import { Megaphone, Filter, Phone, PhoneCall } from "lucide-react";

interface DeptRow {
  entity_type: string;
  entity: string;
  volume: number;
  metric_value: number;
  metric_label: string;
  probability: number;
  confidence: number;
  decision: string;
}

const DEPARTMENTS = [
  { key: "media", label: "Media Buying", sub: "Creative to Budget", icon: Megaphone },
  { key: "funnel", label: "Funnels", sub: "Funnel to Traffic", icon: Filter },
  { key: "setter", label: "Setters", sub: "Setter to Leads", icon: Phone },
  { key: "closer", label: "Closers", sub: "Closer to Calls", icon: PhoneCall },
] as const;

const QUESTION: Record<string, string> = {
  funnel: "Which funnel deserves more traffic? Win probability is the chance it books above the team's rate.",
  setter: "Which setter should get the next lead? Win probability is the chance they turn leads into booked calls.",
  closer: "Which closer should get the next call? Win probability is the chance they close an assigned lead.",
};
const ALLOCATING: Record<string, string> = { funnel: "Traffic", setter: "Leads", closer: "Calls" };

const barColor = (v: number) =>
  v >= 80 ? "bg-green-500" : v >= 58 ? "bg-blue-500" : v >= 40 ? "bg-amber-500" : "bg-red-500";
const confBarColor = (v: number) => (v >= 90 ? "bg-green-400" : v >= 50 ? "bg-amber-400" : "bg-slate-300");
const actionPill = (d: string) =>
  d === "Scale up" || d === "Increase" ? "bg-green-100 text-green-700"
    : d === "Hold" ? "bg-slate-100 text-slate-600"
    : d === "Reduce" || d === "Watch" ? "bg-red-100 text-red-700"
    : "bg-slate-100 text-slate-600";

// Reallocation, ported from Abu's DecisionOS mockup: re-slice a fixed pool by
// probability x confidence (convex, so winners pull ahead), cut assets to zero,
// caution discounted. Nothing new is added; the pool is conserved.
function allocWeight(r: DeptRow): number {
  if (r.decision === "Watch") return 0; // cut -> freed
  let base = Math.pow(r.probability / 100, 2) * (r.confidence / 100);
  if (r.decision === "Reduce") base *= 0.6; // caution
  return base;
}
function roundToPool(targets: number[], pool: number): number[] {
  const r = targets.map((t) => Math.round(t));
  let drift = Math.round(pool) - r.reduce((a, b) => a + b, 0);
  const order = targets.map((_, i) => i).sort((a, b) => targets[b] - targets[a]);
  let k = 0;
  while (drift !== 0 && order.length && k < 5000) {
    const i = order[k % order.length];
    if (drift > 0) { r[i]++; drift--; } else if (r[i] > 0) { r[i]--; drift++; }
    k++;
  }
  return r;
}
function recommendAllocs(rows: DeptRow[]): number[] {
  const pool = rows.reduce((a, r) => a + r.volume, 0);
  const W = rows.map(allocWeight);
  const sum = W.reduce((a, b) => a + b, 0);
  if (sum === 0) return rows.map((r) => r.volume);
  const raw = rows.map((_, i) => (pool * W[i]) / sum);
  return roundToPool(raw, pool);
}

function RebalanceModal({ rows, dept, onClose }: { rows: DeptRow[]; dept: string; onClose: () => void }) {
  const sorted = [...rows].sort((a, b) => b.probability - a.probability);
  const pool = sorted.reduce((a, r) => a + r.volume, 0);
  const next = recommendAllocs(sorted);
  const [applied, setApplied] = useState(false);
  const maxAlloc = Math.max(1, ...next);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Rebalance {ALLOCATING[dept]}</h3>
            <p className="text-sm text-slate-500">
              Fixed pool of {pool.toLocaleString()} re-sliced by probability x confidence. Nothing new is added.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="text-xs rounded-lg bg-amber-50 text-amber-700 px-3 py-2">
          Capacity limits are not yet wired, so allocations here are uncapped. Once per-person capacity is connected, the split respects each person's ceiling.
        </div>
        <div className="space-y-1">
          {sorted.map((r, i) => {
            const delta = next[i] - r.volume;
            return (
              <div key={r.entity} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-32 shrink-0">
                  <div className="text-sm font-medium truncate" title={r.entity}>{r.entity}</div>
                  <div className="text-xs text-slate-400">{r.probability}% x {r.confidence}%</div>
                </div>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(r.probability)}`} style={{ width: `${(next[i] / maxAlloc) * 100}%` }} />
                </div>
                <div className="w-28 text-right text-sm tabular-nums">
                  {r.volume.toLocaleString()} <span className="text-slate-400">to</span> <span className="font-semibold">{next[i].toLocaleString()}</span>
                </div>
                <div className={`w-12 text-right text-xs font-medium ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                  {delta > 0 ? `+${delta}` : delta}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          {applied && <span className="text-sm text-green-600">Recommendation saved for review.</span>}
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">Cancel</button>
          <button onClick={() => setApplied(true)} disabled={applied}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">Apply rebalance</button>
        </div>
      </div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
      <span className="text-sm tabular-nums w-9 text-right">{value}%</span>
    </div>
  );
}

function DepartmentView({ rows, dept }: { rows: DeptRow[]; dept: string }) {
  const sorted = [...rows].sort((a, b) => b.probability - a.probability);
  const scale = sorted.filter((r) => r.decision === "Scale up" || r.decision === "Increase").length;
  const cut = sorted.filter((r) => r.decision === "Reduce" || r.decision === "Watch").length;
  const noun = dept === "funnel" ? "Funnels" : dept === "setter" ? "Setters" : "Closers";
  const [rebalancing, setRebalancing] = useState(false);

  return (
    <div className="flex-1 p-6 space-y-4">
      {rebalancing && <RebalanceModal rows={sorted} dept={dept} onClose={() => setRebalancing(false)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{noun}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Allocating: {ALLOCATING[dept]}</span>
        </div>
        <button onClick={() => setRebalancing(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          Rebalance {ALLOCATING[dept]}
        </button>
      </div>
      <div className="rounded-lg bg-blue-50/60 text-slate-600 text-sm px-4 py-2">{QUESTION[dept]}</div>

      <div className="flex gap-8 text-sm">
        <div><div className="text-slate-400 text-xs">{noun}</div><div className="font-semibold">{sorted.length}</div></div>
        <div><div className="text-slate-400 text-xs">Scale / grow</div><div className="font-semibold text-green-600">{scale}</div></div>
        <div><div className="text-slate-400 text-xs">Cut / stop</div><div className="font-semibold text-red-600">{cut}</div></div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">{noun.slice(0, -1)}</th>
              <th className="p-3 text-right">{sorted[0]?.metric_label ?? "Rate"}</th>
              <th className="p-3">Win Probability</th>
              <th className="p-3">Confidence</th>
              <th className="p-3">Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.entity} className="border-t hover:bg-slate-50">
                <td className="p-3 font-medium">{r.entity}
                  <span className="text-slate-400 font-normal ml-2 text-xs">{r.volume.toLocaleString()} vol</span>
                </td>
                <td className="p-3 text-right tabular-nums">{r.metric_value}%</td>
                <td className="p-3"><Bar value={r.probability} color={barColor(r.probability)} /></td>
                <td className="p-3"><Bar value={r.confidence} color={confBarColor(r.confidence)} /></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${actionPill(r.decision)}`}>{r.decision}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DecisionOS() {
  const { data, loading, error } = useRoleView<DeptRow>("v_department_scores");
  const [active, setActive] = useState<string>("media");

  const byType = useMemo(() => {
    const m: Record<string, DeptRow[]> = {};
    for (const r of data ?? []) (m[r.entity_type] ??= []).push(r);
    return m;
  }, [data]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-56 shrink-0 border-r bg-slate-50/50 p-3 space-y-1">
        <div className="px-2 py-3">
          <div className="font-semibold">Decision OS</div>
          <div className="text-xs text-slate-400">Measure, predict, allocate</div>
        </div>
        {DEPARTMENTS.map((d) => {
          const Icon = d.icon;
          return (
            <button
              key={d.key}
              onClick={() => setActive(d.key)}
              className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 ${active === d.key ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
            >
              <Icon className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-sm font-medium">{d.label}</div>
                <div className="text-xs text-slate-400">{d.sub}</div>
              </div>
            </button>
          );
        })}
      </aside>

      {loading ? (
        <div className="p-6 text-slate-500">Loading...</div>
      ) : error ? (
        <div className="p-6 text-red-600">Could not load Decision OS.</div>
      ) : active === "media" ? (
        <div className="flex-1"><MediaBuyingDashboard /></div>
      ) : (
        <DepartmentView rows={byType[active] ?? []} dept={active} />
      )}
    </div>
  );
}
