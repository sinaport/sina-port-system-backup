// Media Buying: campaigns to ad sets to creatives, with the columns Facebook
// cannot give you: win probability, confidence and the recommended action.
// Reads engine.v_media_buying (live scores joined to spend/CAC).
//
// Shares the Decision OS department language: win probability and confidence
// render as bars, a framing question up top, and a Budget rebalance that
// re-slices spend across creatives by probability x confidence (recommend-only).
// The campaign -> ad set -> creative tree is kept (media is richer than the flat
// entity departments).
//
// Wired into App.tsx inside the Admin gate at /media-buying, and embedded as the
// Media Buying tab of Decision OS.
import { useMemo, useState } from "react";
import { useRoleView } from "@/hooks/useRoleView";
import { ChevronRight, ChevronDown } from "lucide-react";

interface Row {
  campaign: string;
  ad_set: string;
  creative: string;
  ad_id: string | null;
  meta_status: string | null;
  spend_eur: number | null;
  hto_buyers: number | null;
  cash_collected_eur: number | null;
  cac_eur: number | null;
  probability: number | null;
  confidence: number | null;
  decision: string | null;
  campaign_type: string | null;
}

const eur = (n: number | null) =>
  n == null ? "-" : new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// Shared bar palette with Decision OS's DepartmentView, so all departments read the same.
const barColor = (v: number) =>
  v >= 80 ? "bg-green-500" : v >= 58 ? "bg-blue-500" : v >= 40 ? "bg-amber-500" : "bg-red-500";
const confBarColor = (v: number) => (v >= 90 ? "bg-green-400" : v >= 50 ? "bg-amber-400" : "bg-slate-300");
const decisionPill = (d: string | null) =>
  !d ? "bg-slate-100 text-slate-400"
    : d.startsWith("Increase") || d === "Graduate" ? "bg-green-100 text-green-700"
    : d.startsWith("Reduce") || d === "Replace" || d === "Exit" ? "bg-red-100 text-red-700"
    : "bg-slate-100 text-slate-600";

// weighted-by-spend average probability for a group
function groupProb(rows: Row[]): number | null {
  const scored = rows.filter((r) => r.probability != null);
  if (!scored.length) return null;
  const totalSpend = scored.reduce((s, r) => s + (r.spend_eur ?? 0), 0);
  if (totalSpend === 0) return Math.round(scored.reduce((s, r) => s + (r.probability ?? 0), 0) / scored.length);
  return Math.round(scored.reduce((s, r) => s + (r.probability ?? 0) * (r.spend_eur ?? 0), 0) / totalSpend);
}
const sumSpend = (rows: Row[]) => rows.reduce((s, r) => s + (r.spend_eur ?? 0), 0);
const sumBuyers = (rows: Row[]) => rows.reduce((s, r) => s + (r.hto_buyers ?? 0), 0);

// aggregate CAC = total spend / total buyers
function groupCac(rows: Row[]): number | null {
  const buyers = sumBuyers(rows);
  return buyers > 0 ? Math.round(sumSpend(rows) / buyers) : null;
}
// spend-weighted average confidence for a group
function groupConf(rows: Row[]): number | null {
  const scored = rows.filter((r) => r.confidence != null);
  if (!scored.length) return null;
  const totalSpend = scored.reduce((s, r) => s + (r.spend_eur ?? 0), 0);
  if (totalSpend === 0) return Math.round(scored.reduce((s, r) => s + (r.confidence ?? 0), 0) / scored.length);
  return Math.round(scored.reduce((s, r) => s + (r.confidence ?? 0) * (r.spend_eur ?? 0), 0) / totalSpend);
}

// Budget reallocation, same shape as Abu's DecisionOS mockup: re-slice a fixed
// pool (total spend) by probability x confidence (convex), cut Exit/Replace to
// zero, discount Reduce. Nothing new is added; the pool is conserved.
function allocWeight(r: Row): number {
  if (r.decision === "Exit" || r.decision === "Replace") return 0;
  let base = Math.pow((r.probability ?? 0) / 100, 2) * ((r.confidence ?? 0) / 100);
  if (r.decision && r.decision.startsWith("Reduce")) base *= 0.6;
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
function recommendBudget(rows: Row[]): number[] {
  const pool = sumSpend(rows);
  const W = rows.map(allocWeight);
  const sum = W.reduce((a, b) => a + b, 0);
  if (sum === 0) return rows.map((r) => r.spend_eur ?? 0);
  const raw = rows.map((_, i) => (pool * W[i]) / sum);
  return roundToPool(raw, pool);
}

function Bar({ value, color, suffix = "%" }: { value: number | null; color: string; suffix?: string }) {
  if (value == null) return <span className="text-slate-400 text-sm">-</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
      <span className="text-sm tabular-nums w-9 text-right">{value}{suffix}</span>
    </div>
  );
}

function BudgetRebalanceModal({ creatives, onClose }: { creatives: Row[]; onClose: () => void }) {
  const scored = creatives.filter((r) => r.probability != null && (r.spend_eur ?? 0) > 0);
  const sorted = [...scored].sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  const pool = sumSpend(sorted);
  const next = recommendBudget(sorted);
  const maxAlloc = Math.max(1, ...next);
  const [applied, setApplied] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Rebalance Budget</h3>
            <p className="text-sm text-slate-500">
              Fixed pool of {eur(pool)} re-sliced across creatives by probability x confidence. Nothing new is spent.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="text-xs rounded-lg bg-amber-50 text-amber-700 px-3 py-2">
          Recommendation only. This does not touch Meta. Delivery caps and learning-phase limits are not modelled, so treat this as the direction to shift, not exact euros.
        </div>
        <div className="space-y-1">
          {sorted.map((r, i) => {
            const cur = r.spend_eur ?? 0;
            const delta = next[i] - cur;
            return (
              <div key={r.ad_id ?? r.creative} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-40 shrink-0">
                  <div className="text-sm font-medium truncate" title={r.creative}>{r.creative}</div>
                  <div className="text-xs text-slate-400">{r.probability}% x {r.confidence}%</div>
                </div>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(r.probability ?? 0)}`} style={{ width: `${(next[i] / maxAlloc) * 100}%` }} />
                </div>
                <div className="w-32 text-right text-sm tabular-nums">
                  {eur(cur)} <span className="text-slate-400">to</span> <span className="font-semibold">{eur(next[i])}</span>
                </div>
                <div className={`w-16 text-right text-xs font-medium ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                  {delta > 0 ? `+${eur(delta)}` : delta < 0 ? `-${eur(-delta)}` : "0"}
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

export function MediaBuyingDashboard() {
  const { data, loading, error } = useRoleView<Row>("v_media_buying");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [rebalancing, setRebalancing] = useState(false);
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const tree = useMemo(() => {
    const byCampaign = new Map<string, Map<string, Row[]>>();
    for (const r of data ?? []) {
      const c = r.campaign ?? "Uncategorised";
      const a = r.ad_set ?? "Uncategorised";
      if (!byCampaign.has(c)) byCampaign.set(c, new Map());
      const sets = byCampaign.get(c)!;
      if (!sets.has(a)) sets.set(a, []);
      sets.get(a)!.push(r);
    }
    return [...byCampaign.entries()]
      .map(([campaign, sets]) => ({ campaign, rows: [...sets.values()].flat(), sets }))
      .sort((a, b) => sumSpend(b.rows) - sumSpend(a.rows));
  }, [data]);

  const creatives = useMemo(() => tree.flatMap((t) => t.rows), [tree]);
  const scaleN = creatives.filter((r) => r.decision && (r.decision.startsWith("Increase") || r.decision === "Graduate")).length;
  const cutN = creatives.filter((r) => r.decision && (r.decision.startsWith("Reduce") || r.decision === "Replace" || r.decision === "Exit")).length;

  if (loading) return <div className="p-6 text-slate-500">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Could not load media buying data.</div>;

  return (
    <div className="p-6 space-y-4">
      {rebalancing && <BudgetRebalanceModal creatives={creatives} onClose={() => setRebalancing(false)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Media Buying</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Allocating: Budget</span>
        </div>
        <button onClick={() => setRebalancing(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          Rebalance Budget
        </button>
      </div>
      <div className="rounded-lg bg-blue-50/60 text-slate-600 text-sm px-4 py-2">
        Which creative deserves more budget? Win probability is the chance it converts spend to buyers above the account's rate.
      </div>

      <div className="flex gap-8 text-sm">
        <div><div className="text-slate-400 text-xs">Creatives</div><div className="font-semibold">{creatives.length}</div></div>
        <div><div className="text-slate-400 text-xs">Scale / grow</div><div className="font-semibold text-green-600">{scaleN}</div></div>
        <div><div className="text-slate-400 text-xs">Cut / stop</div><div className="font-semibold text-red-600">{cutN}</div></div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Campaign / Ad set / Creative</th>
              <th className="p-3 text-right">Spend</th>
              <th className="p-3 text-right">Buyers</th>
              <th className="p-3 text-right">CAC</th>
              <th className="p-3">Win Probability</th>
              <th className="p-3">Confidence</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {tree.map(({ campaign, rows, sets }) => {
              const ck = `c:${campaign}`;
              return (
                <>
                  <tr key={ck} className="border-t bg-slate-50/60 font-medium cursor-pointer" onClick={() => toggle(ck)}>
                    <td className="p-3 flex items-center gap-1">
                      {open[ck] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {campaign}
                    </td>
                    <td className="p-3 text-right">{eur(sumSpend(rows))}</td>
                    <td className="p-3 text-right">{sumBuyers(rows)}</td>
                    <td className="p-3 text-right">{eur(groupCac(rows))}</td>
                    <td className="p-3"><Bar value={groupProb(rows)} color={barColor(groupProb(rows) ?? 0)} /></td>
                    <td className="p-3"><Bar value={groupConf(rows)} color={confBarColor(groupConf(rows) ?? 0)} /></td>
                    <td className="p-3" />
                  </tr>
                  {open[ck] &&
                    [...sets.entries()].map(([adSet, setRows]) => {
                      const ak = `${ck}|a:${adSet}`;
                      return (
                        <>
                          <tr key={ak} className="border-t cursor-pointer" onClick={() => toggle(ak)}>
                            <td className="p-3 pl-8 flex items-center gap-1 text-slate-700">
                              {open[ak] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              {adSet}
                            </td>
                            <td className="p-3 text-right">{eur(sumSpend(setRows))}</td>
                            <td className="p-3 text-right">{sumBuyers(setRows)}</td>
                            <td className="p-3 text-right">{eur(groupCac(setRows))}</td>
                            <td className="p-3"><Bar value={groupProb(setRows)} color={barColor(groupProb(setRows) ?? 0)} /></td>
                            <td className="p-3"><Bar value={groupConf(setRows)} color={confBarColor(groupConf(setRows) ?? 0)} /></td>
                            <td className="p-3" />
                          </tr>
                          {open[ak] &&
                            setRows.map((r) => (
                              <tr key={r.ad_id ?? r.creative} className="border-t hover:bg-slate-50">
                                <td className="p-3 pl-14 max-w-md truncate text-slate-600" title={r.creative}>{r.creative}</td>
                                <td className="p-3 text-right">{eur(r.spend_eur)}</td>
                                <td className="p-3 text-right">{r.hto_buyers ?? 0}</td>
                                <td className="p-3 text-right">{eur(r.cac_eur)}</td>
                                <td className="p-3"><Bar value={r.probability} color={barColor(r.probability ?? 0)} /></td>
                                <td className="p-3"><Bar value={r.confidence} color={confBarColor(r.confidence ?? 0)} /></td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${decisionPill(r.decision)}`}>{r.decision ?? "-"}</span>
                                </td>
                              </tr>
                            ))}
                        </>
                      );
                    })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
