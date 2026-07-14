// Test Engine: the test lab Abu walked through - the funnel's stages, the AI
// suggestions per stage (with a duplicate-conflict flag), a one-click approve that
// logs the test, the status board, the Dashboard-1 KPIs and per-stage rate of
// improvement, a downloadable report, and the agentic EXECUTION panel: apply an
// approved element change through the API and watch the live page follow.
//
// Reads engine.v_test_* views; writes through engine.fn_approve_recommendation and
// engine.fn_apply_variant (both approval-logged). Admin route /test-engine.
import { useCallback, useEffect, useMemo, useState } from "react";
import { fromEngine, supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LandingPreview, type LiveElement } from "@/components/LandingPreview";
import { Beaker, Download } from "lucide-react";

const PAGE = "demo-vsl";

interface Kpis {
  tests_run: number; winning_tests: number; losing_tests: number; win_rate_pct: number | null;
  biggest_lift: number | null; revenue_created: number; avg_days_to_winner: number | null; planned_tests: number;
}
interface Suggestion {
  id: string; subject: string; funnel_stage: string; rationale: string | null; priority: number | null;
  metric: string | null; expected_impact: string | null; status: string; duplicate_conflict: boolean;
}
interface TestRow {
  id: string; hypothesis: string; funnel_stage: string; status: string; revenue_lift: number | null;
  date_to_test: string | null; submitted_by: string | null; probability: number | null; confidence: number | null;
}
interface Stage { funnel_stage: string; total_tests: number; won: number; lost: number; active: number; win_rate_pct: number | null; avg_lift: number | null; }
interface Variant { id: string; page_slug: string; element_key: string; variant_label: string; content: Record<string, unknown>; is_live: boolean; }
interface Change { id: string; element_key: string; from_label: string | null; to_label: string; approved_by: string; applied_at: string; }

const statusPill = (s: string) =>
  s === "won" ? "bg-green-100 text-green-700" : s === "lost" ? "bg-red-100 text-red-700"
    : s === "running" ? "bg-blue-100 text-blue-700" : s === "archived" ? "bg-slate-100 text-slate-500"
    : "bg-amber-100 text-amber-700"; // planned

function variantSummary(el: string, c: Record<string, unknown>): string {
  if (el === "headline") return (c.text as string) ?? "";
  if (el === "testimonial") return `"${(c.quote as string) ?? ""}" — ${(c.author as string) ?? ""}`;
  if (el === "cta") return `${(c.label as string) ?? ""} (${(c.color as string) ?? ""})`;
  return JSON.stringify(c);
}

function downloadCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "test-report.csv"; a.click();
  URL.revokeObjectURL(url);
}

export function TestEngine() {
  const { user } = useAuth();
  const approver = user?.email ?? "admin";

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [live, setLive] = useState<LiveElement[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [k, s, t, v, pv, lv, ch] = await Promise.all([
      fromEngine("v_test_kpis").select("*"),
      fromEngine("v_test_suggestions").select("*"),
      fromEngine("v_test_engine").select("*"),
      fromEngine("v_test_stage_velocity").select("*"),
      fromEngine("page_variants").select("*"),
      fromEngine("v_page_live").select("*"),
      fromEngine("variant_changes").select("*").order("applied_at", { ascending: false }).limit(8),
    ]);
    setKpis((k.data?.[0] as Kpis) ?? null);
    setSuggestions((s.data as Suggestion[]) ?? []);
    setTests((t.data as TestRow[]) ?? []);
    setStages((v.data as Stage[]) ?? []);
    setVariants((pv.data as Variant[]) ?? []);
    setLive(((lv.data as { page_slug: string; element_key: string; content: Record<string, unknown> }[]) ?? [])
      .filter((r) => r.page_slug === PAGE).map((r) => ({ element_key: r.element_key, content: r.content })));
    setChanges((ch.data as Change[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function approve(recId: string) {
    setBusy(recId);
    const { error } = await supabase.schema("engine" as never).rpc("fn_approve_recommendation", { p_rec_id: recId, p_approver: approver });
    if (error) alert("Approve failed: " + error.message);
    await load(); setBusy(null);
  }
  async function applyVariant(element: string, label: string) {
    setBusy(element + label);
    const { error } = await supabase.schema("engine" as never).rpc("fn_apply_variant", { p_page: PAGE, p_element: element, p_label: label, p_approved_by: approver });
    if (error) alert("Apply failed: " + error.message);
    await load(); setBusy(null);
  }

  const openSuggestions = useMemo(() => suggestions.filter((s) => s.status === "proposed"), [suggestions]);
  const suggestionsByStage = useMemo(() => {
    const m: Record<string, Suggestion[]> = {};
    for (const s of openSuggestions) (m[s.funnel_stage || "Unassigned"] ??= []).push(s);
    return m;
  }, [openSuggestions]);
  const variantsByElement = useMemo(() => {
    const m: Record<string, Variant[]> = {};
    for (const v of variants.filter((x) => x.page_slug === PAGE)) (m[v.element_key] ??= []).push(v);
    return m;
  }, [variants]);

  if (loading) return <div className="p-6 text-slate-500">Loading Test Engine...</div>;

  const kpiCard = (label: string, value: string | number) => (
    <div className="rounded-lg border bg-white px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Beaker className="w-5 h-5" /> Test Engine</h1>
          <p className="text-sm text-slate-500">Suggest, log, run, measure and learn - one loop per funnel stage. From 7 tests a week toward 70 and beyond.</p>
        </div>
        <button onClick={() => downloadCsv(tests as unknown as Record<string, unknown>[])}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-slate-50">
          <Download className="w-4 h-4" /> Download report
        </button>
      </div>

      {/* Dashboard-1 KPIs from real logged tests */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpiCard("Tests run", kpis?.tests_run ?? 0)}
        {kpiCard("Planned", kpis?.planned_tests ?? 0)}
        {kpiCard("Winning", kpis?.winning_tests ?? 0)}
        {kpiCard("Win rate", kpis?.win_rate_pct != null ? `${kpis.win_rate_pct}%` : "—")}
        {kpiCard("Biggest lift", kpis?.biggest_lift != null ? `${kpis.biggest_lift}` : "—")}
        {kpiCard("Revenue created", `€${Number(kpis?.revenue_created ?? 0).toLocaleString()}`)}
        {kpiCard("Days to winner", kpis?.avg_days_to_winner != null ? `${kpis.avg_days_to_winner}` : "—")}
      </div>

      {/* Suggestions per funnel stage, with dedup conflict + approve->log */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Suggested tests by funnel stage</h2>
        {Object.keys(suggestionsByStage).length === 0 && (
          <div className="text-sm text-slate-400 rounded-lg border border-dashed px-4 py-6 text-center">All suggestions have been actioned. The engine proposes a fresh batch on its weekly run.</div>
        )}
        {Object.entries(suggestionsByStage).map(([stage, items]) => (
          <div key={stage} className="rounded-lg border bg-white">
            <div className="px-4 py-2 border-b bg-slate-50 text-sm font-medium">{stage}</div>
            <div className="divide-y">
              {items.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.subject}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      moves {s.metric ?? "?"} · {s.rationale ?? ""}
                      {s.duplicate_conflict && <span className="ml-2 px-1.5 py-0.5 rounded bg-red-50 text-red-600">possible duplicate</span>}
                    </div>
                  </div>
                  <button disabled={busy === s.id} onClick={() => approve(s.id)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                    {busy === s.id ? "..." : "Approve & log"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Status board */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Tests</h2>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr><th className="p-3">Test</th><th className="p-3">Stage</th><th className="p-3">Status</th><th className="p-3 text-right">Lift</th><th className="p-3">Logged by</th></tr>
            </thead>
            <tbody>
              {tests.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No tests logged yet. Approve a suggestion above to log the first one.</td></tr>}
              {tests.map((t) => (
                <tr key={t.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 max-w-md truncate" title={t.hypothesis}>{t.hypothesis}</td>
                  <td className="p-3 text-slate-500">{t.funnel_stage}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusPill(t.status)}`}>{t.status}</span></td>
                  <td className="p-3 text-right tabular-nums">{t.revenue_lift ?? "—"}</td>
                  <td className="p-3 text-slate-400 text-xs">{t.submitted_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-stage rate of improvement */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Rate of improvement by stage</h2>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr><th className="p-3">Funnel stage</th><th className="p-3 text-right">Tests</th><th className="p-3 text-right">Won</th><th className="p-3 text-right">Lost</th><th className="p-3 text-right">Active</th><th className="p-3 text-right">Win rate</th><th className="p-3 text-right">Avg lift</th></tr>
            </thead>
            <tbody>
              {stages.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">Populates as tests complete.</td></tr>}
              {stages.map((s) => (
                <tr key={s.funnel_stage} className="border-t">
                  <td className="p-3 font-medium">{s.funnel_stage}</td>
                  <td className="p-3 text-right">{s.total_tests}</td>
                  <td className="p-3 text-right text-green-600">{s.won}</td>
                  <td className="p-3 text-right text-red-600">{s.lost}</td>
                  <td className="p-3 text-right">{s.active}</td>
                  <td className="p-3 text-right">{s.win_rate_pct != null ? `${s.win_rate_pct}%` : "—"}</td>
                  <td className="p-3 text-right">{s.avg_lift ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Agentic execution v1: apply an element change via the API; the live page follows */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Agentic execution (v1)</h2>
          <p className="text-xs text-slate-400">Apply an approved element change to the live page through the API. Every apply is logged. Runs on our own dynamic page; ClickFunnels funnels get recommendations until they move onto it.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {Object.entries(variantsByElement).map(([el, vs]) => (
              <div key={el} className="rounded-lg border bg-white">
                <div className="px-4 py-2 border-b bg-slate-50 text-sm font-medium capitalize">{el}</div>
                <div className="divide-y">
                  {vs.sort((a, b) => a.variant_label.localeCompare(b.variant_label)).map((v) => (
                    <div key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">Variant {v.variant_label}</div>
                        <div className="text-sm truncate" title={variantSummary(el, v.content)}>{variantSummary(el, v.content)}</div>
                      </div>
                      {v.is_live
                        ? <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Live</span>
                        : <button disabled={busy === el + v.variant_label} onClick={() => applyVariant(el, v.variant_label)}
                            className="shrink-0 px-3 py-1.5 rounded-lg border text-xs hover:bg-slate-50 disabled:opacity-50">
                            {busy === el + v.variant_label ? "..." : "Apply live"}
                          </button>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {changes.length > 0 && (
              <div className="text-xs text-slate-400 space-y-1">
                <div className="font-medium text-slate-500">Recent changes</div>
                {changes.map((c) => (
                  <div key={c.id}>{c.element_key}: {c.from_label ?? "—"} → {c.to_label} · by {c.approved_by}</div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Live page (follows the data)</div>
            <LandingPreview live={live} />
          </div>
        </div>
      </section>
    </div>
  );
}
