// Media Buying: campaigns to ad sets to creatives, with the columns Facebook
// cannot give you: win probability, confidence and the recommended action.
// Reads engine.v_media_buying (live scores joined to spend/CAC).
//
// Wired into App.tsx inside the Admin gate at /media-buying.
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

const probColor = (p: number | null) =>
  p == null ? "text-slate-400"
    : p >= 85 ? "text-green-600" : p >= 58 ? "text-blue-600" : p >= 40 ? "text-amber-600" : "text-red-600";
const confPill = (c: number | null) =>
  c == null ? "bg-slate-100 text-slate-400"
    : c >= 90 ? "bg-green-100 text-green-700" : c >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
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
// how many creatives in the group have an actionable recommendation
function groupFlagged(rows: Row[]): number {
  return rows.filter(
    (r) => r.decision && (r.decision.startsWith("Increase") || r.decision.startsWith("Reduce") ||
      r.decision === "Graduate" || r.decision === "Replace" || r.decision === "Exit")
  ).length;
}

export function MediaBuyingDashboard() {
  const { data, loading, error } = useRoleView<Row>("v_media_buying");
  const [open, setOpen] = useState<Record<string, boolean>>({});
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

  if (loading) return <div className="p-6 text-slate-500">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Could not load media buying data.</div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Media Buying</h1>
        <p className="text-sm text-slate-500">
          Campaigns, ad sets and creatives with win probability, confidence and the recommended action.
        </p>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Campaign / Ad set / Creative</th>
              <th className="p-3 text-right">Spend</th>
              <th className="p-3 text-right">Buyers</th>
              <th className="p-3 text-right">CAC</th>
              <th className="p-3 text-right">Win %</th>
              <th className="p-3 text-center">Confidence</th>
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
                    <td className={`p-3 text-right font-semibold ${probColor(groupProb(rows))}`}>{groupProb(rows) ?? "-"}</td>
                    <td className="p-3 text-center">
                      {groupConf(rows) != null && (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${confPill(groupConf(rows))}`}>{groupConf(rows)}</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 text-xs">{groupFlagged(rows) > 0 ? `${groupFlagged(rows)} to act on` : ""}</td>
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
                            <td className={`p-3 text-right ${probColor(groupProb(setRows))}`}>{groupProb(setRows) ?? "-"}</td>
                            <td className="p-3 text-center">
                              {groupConf(setRows) != null && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${confPill(groupConf(setRows))}`}>{groupConf(setRows)}</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500 text-xs">{groupFlagged(setRows) > 0 ? `${groupFlagged(setRows)} to act on` : ""}</td>
                          </tr>
                          {open[ak] &&
                            setRows.map((r) => (
                              <tr key={r.ad_id ?? r.creative} className="border-t hover:bg-slate-50">
                                <td className="p-3 pl-14 max-w-md truncate text-slate-600" title={r.creative}>{r.creative}</td>
                                <td className="p-3 text-right">{eur(r.spend_eur)}</td>
                                <td className="p-3 text-right">{r.hto_buyers ?? 0}</td>
                                <td className="p-3 text-right">{eur(r.cac_eur)}</td>
                                <td className={`p-3 text-right font-semibold ${probColor(r.probability)}`}>{r.probability ?? "-"}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${confPill(r.confidence)}`}>{r.confidence ?? "-"}</span>
                                </td>
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
