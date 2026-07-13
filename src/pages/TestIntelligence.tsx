// Test Intelligence: win probability and confidence per ad creative, from the
// live scoring pipeline (engine.v_creative_scores_latest, computed by
// engine.fn_score_creatives on the daily cron). Reuses the app's role-view hook.
//
// Wired into App.tsx inside the Admin gate at /intelligence.
import { useMemo, useState } from "react";
import { useRoleView } from "@/hooks/useRoleView";
import { TrendingUp, ShieldCheck } from "lucide-react";

interface ScoreRow {
  creative: string;
  ad_id: string | null;
  probability: number;
  confidence: number;
  decision: string;
  campaign_type: string;
}

const probColor = (p: number) =>
  p >= 85 ? "text-green-600" : p >= 58 ? "text-blue-600" : p >= 40 ? "text-amber-600" : "text-red-600";
const confColor = (c: number) =>
  c >= 90 ? "bg-green-100 text-green-700" : c >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
const decisionColor = (d: string) =>
  d.startsWith("Increase") || d === "Graduate"
    ? "bg-green-100 text-green-700"
    : d.startsWith("Reduce") || d === "Replace" || d === "Exit"
    ? "bg-red-100 text-red-700"
    : "bg-slate-100 text-slate-600";

export function TestIntelligence() {
  const { data, loading, error } = useRoleView<ScoreRow>("v_creative_scores_latest");
  const [sort, setSort] = useState<"probability" | "confidence">("probability");

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    list.sort((a, b) => b[sort] - a[sort]);
    return list;
  }, [data, sort]);

  if (loading) return <div className="p-6 text-slate-500">Loading scores...</div>;
  if (error) return <div className="p-6 text-red-600">Could not load scores.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Test Intelligence</h1>
          <p className="text-sm text-slate-500">
            Win probability and confidence per creative. {rows.length} scored.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setSort("probability")}
            className={`px-3 py-1 rounded ${sort === "probability" ? "bg-slate-800 text-white" : "bg-slate-100"}`}
          >
            <TrendingUp className="inline w-4 h-4 mr-1" /> Probability
          </button>
          <button
            onClick={() => setSort("confidence")}
            className={`px-3 py-1 rounded ${sort === "confidence" ? "bg-slate-800 text-white" : "bg-slate-100"}`}
          >
            <ShieldCheck className="inline w-4 h-4 mr-1" /> Confidence
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Creative</th>
              <th className="p-3">Type</th>
              <th className="p-3 text-right">Win Probability</th>
              <th className="p-3 text-center">Confidence</th>
              <th className="p-3">Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.creative} className="border-t hover:bg-slate-50">
                <td className="p-3 max-w-md truncate" title={r.creative}>{r.creative}</td>
                <td className="p-3 text-slate-500">{r.campaign_type}</td>
                <td className={`p-3 text-right font-semibold ${probColor(r.probability)}`}>{r.probability}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${confColor(r.confidence)}`}>{r.confidence}</span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${decisionColor(r.decision)}`}>{r.decision}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
