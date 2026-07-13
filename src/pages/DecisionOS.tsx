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

  return (
    <div className="flex-1 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{noun}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Allocating: {ALLOCATING[dept]}</span>
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
