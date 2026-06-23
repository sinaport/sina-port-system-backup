import { useEffect, useState } from "react";
import { Activity, AlertTriangle, FlaskConical, Trophy, Users, Zap } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState, EmptyState } from "@/components/LoadingState";
import { DateRangeFilter, useDateRange } from "@/components/DateRangeFilter";
import { supabase } from "@/lib/supabase";
import { useRoleView, useRangeView } from "@/hooks/useRoleView";
import type { DashboardMetric } from "@/types/schema";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

interface IngestionHealth {
    source: string;
    total_rows: number;
    last_ingest_at: string;
    minutes_stale: number;
}

interface OpenBottleneck {
    bottleneck_id: string;
    bottleneck_title: string;
    owner: string;
    affected_metric: string;
    priority_score: string;
    status: string | null;
    date_created: string;
}

interface ActiveTest {
    test_id: string;
    test_type: string;
    economic_engine_flow: string;
    date_to_test: string;
    status_update: string | null;
    variables_to_test: string;
}

interface Alert {
    id: string;
    alert_type: string;
    severity: string;
    metric_name: string;
    delta_pct: number | null;
    message: string;
    created_at: string;
}

interface RunningTest {
    id: string;
    team: string;
    variant_name: string;
    variable_type: string;
    assigned_to: string | null;
    routing_status: string | null;
    date_to_test: string;
    ends_at: string | null;
    hypothesis: string | null;
}

const LABEL_BY_METRIC: Record<string, string> = {
    open_bottlenecks: "Open bottlenecks",
    active_tests: "Active tests",
    total_winners: "Total winners",
    active_team: "Active team",
    ingestion_sources_stale: "Stale sources",
};

// Friendly display names for the raw ingestion table names in the freshness panel.
// Falls back to the raw source if an unmapped one ever appears, so nothing breaks.
const SOURCE_LABELS: Record<string, string> = {
    live_close_leads: "Close - leads",
    live_close_calls: "Close - calls",
    live_calendly_events: "Calendly",
    live_payments: "Payments (Stripe / PayPal / Whop)",
    live_fathom_meetings: "Fathom",
    live_hyros_leads: "Hyros",
    live_meta_ad_insights: "Meta Ads",
    airtable_leads: "Airtable Leads (Clickfunnels opt-ins)",
};

// Backfill sources are refreshed on a slower cadence (not the 30-min live cron), so they show a
// neutral "Backfill" status rather than a misleading red "Stale".
const BACKFILL_SOURCES = new Set(["live_meta_ad_insights", "airtable_leads"]);

const ICON_BY_METRIC: Record<string, React.ReactNode> = {
    open_bottlenecks: <AlertTriangle className="w-5 h-5" />,
    active_tests: <FlaskConical className="w-5 h-5" />,
    total_winners: <Trophy className="w-5 h-5" />,
    active_team: <Users className="w-5 h-5" />,
    ingestion_sources_stale: <Zap className="w-5 h-5" />,
};

const FLAG_BY_METRIC = (metric: string, value: string): "green" | "red" | "blue" | "orange" | null => {
    const n = parseInt(value);
    if (metric === "ingestion_sources_stale") return n === 0 ? "green" : "red";
    if (metric === "open_bottlenecks") return n > 50 ? "orange" : "blue";
    return "blue";
};

interface RepPerf {
    setter: string;
    dials: number;
    answered: number;
    answer_rate_pct: number;
}

// Closer rep performance (per closer): closing calls set / held / upcoming.
interface CloserRep {
    closer: string;
    sets: number;
    held: number;
    upcoming: number;
}

// Delivery rep performance (per Success Manager): mentees managed.
interface SmRep {
    success_manager: string;
    mentees: number;
    onboarding: number;
    offboarded: number;
}

// CAC per ad creative (HTO buyers only). Attribution = payment-HTO buyer -> Hyros first-click ad.
interface CacCreative {
    creative: string;
    ad_id: string | null;
    spend_eur: number | null;
    hto_buyers: number;
    cac_eur: number | null;
}

const TOTALS_LABEL: Record<string, string> = {
    dials: "Dials",
    calendly_events: "Calendly events",
    fathom_calls: "Fathom calls",
};
const TOTALS_ORDER = ["dials", "calendly_events", "fathom_calls"];
const ANSWER_RATE_TARGET = 45;

// All-department metrics (Operations Overview, per her feedback). Pulled from v_ops_metrics,
// definitions + targets from her KPI_BENCHMARK. Money in EUR.
interface OpsMetric {
    category: string;
    metric: string;
    value: string | null;
    target: string | null;
    higher_is_better: boolean;
}
const OPS_LABELS: Record<string, string> = {
    leads: "Leads", leads_to_hto_pct: "Leads → HTO %", leads_to_lto_pct: "Leads → LTO %",
    lto_to_hto_pct: "LTO → HTO %", roas: "ROAS", liquidation_rate: "Liquidation Rate %",
    cac_blended: "CAC (blended)", ad_spend: "Ad spend",
    discovery_calls: "Discovery calls", closing_calls: "Closing calls", coaching_calls: "Coaching calls",
    sets_booked: "Sets booked", live_calls: "Live calls",
    closed_deals: "Closed deals", cash_collected: "Cash collected", revenue: "Revenue",
    cash_collection_rate: "Cash Collection Rate %", ascension_rate: "Ascension Rate %",
};
const OPS_CATEGORY_ORDER = ["Leads", "Calendly", "Sales"];
const OPS_PCT = new Set(["leads_to_hto_pct", "leads_to_lto_pct", "lto_to_hto_pct", "liquidation_rate", "cash_collection_rate", "ascension_rate"]);
const OPS_MONEY = new Set(["cac_blended", "ad_spend", "cash_collected", "revenue"]);

// Plain-language formula behind each metric, shown on hover (her feedback: "add a formula in each metric when I hover").
const OPS_FORMULAS: Record<string, string> = {
    leads: "New leads created in Close CRM within the selected range.",
    leads_to_hto_pct: "HTO buyers ÷ leads in range × 100.",
    leads_to_lto_pct: "LTO buyers ÷ leads in range × 100.",
    lto_to_hto_pct: "Leads who bought both an LTO and an HTO ÷ LTO buyers × 100.",
    roas: "Cash collected ÷ Meta ad spend in range.",
    liquidation_rate: "LTO revenue ÷ ad spend × 100.",
    cac_blended: "Meta ad spend ÷ HTO buyers in range.",
    ad_spend: "Total Meta ad spend (EUR) in range.",
    discovery_calls: "Calendly discovery/intro events (active) in range.",
    closing_calls: "Calendly strategy/closing/sales events (active) in range.",
    coaching_calls: "Calendly check-in/kick-off/coaching events (active) in range.",
    sets_booked: "Closing-type Calendly events booked in range.",
    live_calls: "Sets whose start time has already passed (held).",
    closed_deals: "Distinct leads with an HTO purchase in range.",
    cash_collected: "Actual payments received against contracts (Airtable), EUR, for deals in range.",
    revenue: "Program price from each lead's contract (Airtable), EUR, for deals in range by first payment date.",
    cash_collection_rate: "Payments received ÷ contracted total × 100.",
    ascension_rate: "Leads who bought both LTO and HTO ÷ LTO buyers × 100.",
};
const LIVE_FORMULAS: Record<string, string> = {
    open_bottlenecks: "Bottleneck registry rows not yet resolved (current state).",
    active_tests: "Test registry rows currently queued or running (current state).",
    total_winners: "Total winner registry rows logged (current state).",
    active_team: "People marked Active in the team roster.",
    ingestion_sources_stale: "Data sources with no fresh ingest in the last 90+ minutes.",
};
const TOTALS_FORMULAS: Record<string, string> = {
    dials: "All calls logged in Close CRM (inbound + outbound) in range.",
    calendly_events: "All Calendly events (every type) in range.",
    fathom_calls: "All Fathom-recorded meetings in range.",
};

function opsDisplay(m: OpsMetric): string {
    if (m.value === null || m.value === undefined) return "—";
    if (OPS_MONEY.has(m.metric)) return formatCurrency(m.value);
    if (OPS_PCT.has(m.metric)) return `${m.value}%`;
    if (m.metric === "roas") return `${m.value}x`;
    return formatNumber(m.value);
}
function opsFlag(m: OpsMetric): "green" | "red" | null {
    if (m.value === null || m.target === null) return null;
    const v = parseFloat(m.value), t = parseFloat(m.target);
    if (isNaN(v) || isNaN(t)) return null;
    return (m.higher_is_better ? v >= t : v <= t) ? "green" : "red";
}

export function EaDashboard() {
    const metrics = useRoleView<DashboardMetric>("v_ea_dashboard");
    const ingestion = useRoleView<IngestionHealth>("v_ea_ingestion_health");
    const bottlenecks = useRoleView<OpenBottleneck>("v_ea_open_bottlenecks");
    const tests = useRoleView<ActiveTest>("v_ea_active_tests");
    const alerts = useRoleView<Alert>("v_ea_alerts");
    const runningTests = useRoleView<RunningTest>("v_ea_running_tests");
    const cac = useRoleView<CacCreative>("v_cac_per_creative");

    // All-department metrics + activity totals + rep performance are date-filterable (feedback #1).
    const [range, setRange] = useDateRange();
    const reps = useRangeView<RepPerf>("fn_setter_rep", range);
    const closerReps = useRangeView<CloserRep>("fn_closer_tracking", range);
    const smReps = useRangeView<SmRep>("fn_sm_rep", range);
    const totals = useRangeView<DashboardMetric>("fn_ops_totals", range);
    const [opsData, setOpsData] = useState<OpsMetric[] | null>(null);
    const [opsLoading, setOpsLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        setOpsLoading(true);
        void supabase
            .schema("engine" as never)
            .rpc("fn_ops_metrics", { p_from: range.from, p_to: range.to })
            .then(({ data }) => {
                if (cancelled) return;
                setOpsData((data as OpsMetric[]) ?? []);
                setOpsLoading(false);
            });
        return () => { cancelled = true; };
    }, [range.from, range.to]);

    const totalBy = Object.fromEntries((totals.data ?? []).map((m) => [m.metric, m.value]));
    const repRows = (reps.data ?? []).map((r) => ({
        rep: r.setter,
        answered: Number(r.answered),
        notAnswered: Math.max(0, Number(r.dials) - Number(r.answered)),
        total: Number(r.dials),
        rate: Number(r.answer_rate_pct),
    })).sort((a, b) => b.total - a.total);
    const maxBar = Math.max(1, ...repRows.map((r) => r.total));

    // Closer rep bars: held (green) vs not held / no-show (red), total = sets.
    const closerRows = [...(closerReps.data ?? [])]
        .map((c) => ({ rep: c.closer, held: Number(c.held), notHeld: Math.max(0, Number(c.sets) - Number(c.held)), total: Number(c.sets) }))
        .sort((a, b) => b.total - a.total);
    const maxCloserBar = Math.max(1, ...closerRows.map((c) => c.total));
    // Delivery rep bars: onboarding (green) vs offboarded (slate), total = mentees.
    const smRows = [...(smReps.data ?? [])]
        .map((s) => ({ rep: s.success_manager, onboarding: Number(s.onboarding), offboarded: Number(s.offboarded), total: Number(s.mentees) }))
        .sort((a, b) => b.total - a.total);
    const maxSmBar = Math.max(1, ...smRows.map((s) => s.total));

    const cacRows = [...(cac.data ?? [])].sort((a, b) => (Number(a.cac_eur ?? Infinity)) - (Number(b.cac_eur ?? Infinity)));
    const cacWithVal = cacRows.filter((c) => c.cac_eur != null);
    const cacUnder = cacWithVal.filter((c) => Number(c.cac_eur) < 1000).length;
    const cacOver = cacWithVal.filter((c) => Number(c.cac_eur) >= 1000).length;
    const cacBuyers = cacRows.reduce((s, c) => s + Number(c.hto_buyers || 0), 0);

    return (
        <div className="space-y-8">
            <header className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-zinc-900">Operations overview</h1>
                    <p className="text-sm text-zinc-500">Cross-team health and active priority work.</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Department metrics range</span>
                    <DateRangeFilter value={range} onChange={setRange} />
                </div>
            </header>

            {/* Anomaly alerts - surfaced prominently when present */}
            {alerts.data && alerts.data.length > 0 && (
                <section>
                    <h2 className="text-base font-semibold text-zinc-900 mb-3">Active alerts</h2>
                    <div className="space-y-2">
                        {alerts.data.map((a) => (
                            <div
                                key={a.id}
                                className={`rounded-md border p-3 ${
                                    a.severity === "critical"
                                        ? "border-red-200 bg-red-50"
                                        : "border-amber-200 bg-amber-50"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`text-xs font-semibold uppercase ${
                                            a.severity === "critical" ? "text-red-700" : "text-amber-700"
                                        }`}
                                    >
                                        {a.severity}
                                    </span>
                                    <span className="text-sm text-zinc-900">{a.message}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <h2 className="text-base font-semibold text-zinc-900">
                Live status <span className="text-xs font-normal text-zinc-400">· current snapshot (not date-filtered)</span>
            </h2>
            {metrics.loading ? (
                <LoadingState label="Loading metrics..." />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {(metrics.data ?? []).map((m) => (
                        <MetricCard
                            key={m.metric}
                            label={LABEL_BY_METRIC[m.metric] ?? m.metric}
                            value={formatNumber(m.value)}
                            flag={FLAG_BY_METRIC(m.metric, m.value)}
                            icon={ICON_BY_METRIC[m.metric]}
                            formula={LIVE_FORMULAS[m.metric]}
                        />
                    ))}
                </div>
            )}

            {/* Activity totals - date-filtered */}
            <h2 className="text-base font-semibold text-zinc-900">
                Activity <span className="text-xs font-normal text-zinc-400">· {range.label}</span>
            </h2>
            {totals.loading ? (
                <LoadingState />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {TOTALS_ORDER.map((key) => (
                        <MetricCard key={key} label={TOTALS_LABEL[key]} value={formatNumber(totalBy[key] ?? "0")} flag="blue" icon={<Activity className="w-5 h-5" />} formula={TOTALS_FORMULAS[key]} />
                    ))}
                </div>
            )}

            {/* All-department metrics, grouped (Leads / Calendly / Sales). Range = filter in header. */}
            <h2 className="text-base font-semibold text-zinc-900">
                Department metrics <span className="text-xs font-normal text-zinc-400">· {range.label}</span>
            </h2>
            {opsLoading ? (
                <LoadingState label="Loading department metrics..." />
            ) : (
                OPS_CATEGORY_ORDER.map((cat) => {
                    const rows = (opsData ?? []).filter((m) => m.category === cat);
                    if (rows.length === 0) return null;
                    return (
                        <section key={cat}>
                            <h2 className="text-base font-semibold text-zinc-900 mb-3">{cat}</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                {rows.map((m) => (
                                    <MetricCard
                                        key={m.metric}
                                        label={OPS_LABELS[m.metric] ?? m.metric}
                                        value={opsDisplay(m)}
                                        flag={opsFlag(m)}
                                        formula={OPS_FORMULAS[m.metric]}
                                        sublabel={m.target ? `Target ${m.target}${OPS_PCT.has(m.metric) ? "%" : m.metric === "roas" ? "x" : ""}` : (m.value === null ? "Not connected" : undefined)}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })
            )}

            {/* CAC per ad creative (HTO buyers only) - her Q4 answer */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">CAC by ad creative <span className="text-xs font-normal text-zinc-400">· HTO buyers only</span></h2>
                    <div className="text-xs text-zinc-500">{cacWithVal.length} creatives · {cacBuyers} attributed buyers</div>
                </div>
                {cac.loading ? (
                    <LoadingState />
                ) : cacRows.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-3">
                            <MetricCard label="Creatives, CAC < €1k" value={formatNumber(String(cacUnder))} flag="green" formula="Ad creatives whose spend ÷ HTO buyers from that creative is under €1,000." />
                            <MetricCard label="Creatives, CAC ≥ €1k" value={formatNumber(String(cacOver))} flag="red" formula="Ad creatives whose spend ÷ HTO buyers from that creative is €1,000 or more." />
                        </div>
                        <p className="text-xs text-zinc-400 mb-2">
                            CAC = ad creative spend ÷ new closed deals from that creative, from your CAC reporting (Raw Sales + Raw Spend, matched by Ad ID). {cacBuyers} closed deals across {cacWithVal.length} creatives.
                        </p>
                        <div className="bg-white border border-zinc-200 rounded-md overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase text-left">
                                    <tr>
                                        <th className="px-4 py-2">Ad creative</th>
                                        <th className="px-4 py-2">Spend</th>
                                        <th className="px-4 py-2">HTO buyers</th>
                                        <th className="px-4 py-2">CAC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {cacRows.slice(0, 20).map((c, i) => (
                                        <tr key={c.ad_id ?? i}>
                                            <td className="px-4 py-2 text-zinc-800 max-w-md truncate">{c.creative}</td>
                                            <td className="px-4 py-2 text-zinc-600">{c.spend_eur != null ? formatCurrency(String(c.spend_eur)) : "—"}</td>
                                            <td className="px-4 py-2 text-zinc-700">{c.hto_buyers}</td>
                                            <td className={`px-4 py-2 font-medium ${c.cac_eur == null ? "text-zinc-400" : Number(c.cac_eur) < 1000 ? "text-emerald-600" : "text-red-600"}`}>
                                                {c.cac_eur != null ? formatCurrency(String(c.cac_eur)) : "no spend match"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <EmptyState title="No attributed creatives yet" description="HTO buyers traceable to an ad creative will appear here as Hyros attribution and ad spend line up." />
                )}
            </section>

            {/* Rep performance (answered vs not answered) - setters only */}
            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Setter rep performance <span className="text-xs font-normal text-zinc-400">· Setter dept calls (Close CRM)</span></h2>
                {reps.loading ? (
                    <LoadingState />
                ) : repRows.length > 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
                        {repRows.slice(0, 15).map((r) => (
                            <div key={r.rep} className="flex items-center gap-3 text-xs">
                                <div className="w-32 truncate text-zinc-700">{r.rep}</div>
                                <div className="flex-1 flex h-4 rounded overflow-hidden bg-zinc-100">
                                    <div className="bg-emerald-500" style={{ width: `${(r.answered / maxBar) * 100}%` }} title={`Answered ${r.answered}`} />
                                    <div className="bg-red-400" style={{ width: `${(r.notAnswered / maxBar) * 100}%` }} title={`Not answered ${r.notAnswered}`} />
                                </div>
                                <div className="w-10 text-right text-zinc-500">{r.total}</div>
                            </div>
                        ))}
                        <div className="flex gap-4 text-xs text-zinc-500 pt-1">
                            <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Answered</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Not answered</span>
                        </div>
                    </div>
                ) : (
                    <EmptyState title="No call data yet" description="Rep call activity will appear here." />
                )}
            </section>

            {/* Answer rate table */}
            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Setter answer rate</h2>
                {reps.loading ? (
                    <LoadingState />
                ) : repRows.length > 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left">Rep</th>
                                    <th className="px-4 py-2 text-left">Answered</th>
                                    <th className="px-4 py-2 text-left">Not answered</th>
                                    <th className="px-4 py-2 text-left">Total</th>
                                    <th className="px-4 py-2 text-left">Answer rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {repRows.map((r) => (
                                    <tr key={r.rep}>
                                        <td className="px-4 py-2 font-medium text-zinc-900">{r.rep}</td>
                                        <td className="px-4 py-2 text-emerald-700">{r.answered}</td>
                                        <td className="px-4 py-2 text-red-600">{r.notAnswered}</td>
                                        <td className="px-4 py-2 text-zinc-700">{r.total}</td>
                                        <td className={`px-4 py-2 font-medium ${r.rate < ANSWER_RATE_TARGET ? "text-red-600" : "text-emerald-600"}`}>{r.rate}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="No call data yet" description="Answer rates will appear here." />
                )}
            </section>

            {/* Closer rep performance - bar chart matching Setter (R5 #5) */}
            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Closer rep performance <span className="text-xs font-normal text-zinc-400">· Closing calls (Calendly)</span></h2>
                {closerReps.loading ? (
                    <LoadingState />
                ) : closerRows.length > 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
                        {closerRows.slice(0, 15).map((r) => (
                            <div key={r.rep} className="flex items-center gap-3 text-xs">
                                <div className="w-32 truncate text-zinc-700">{r.rep}</div>
                                <div className="flex-1 flex h-4 rounded overflow-hidden bg-zinc-100">
                                    <div className="bg-emerald-500" style={{ width: `${(r.held / maxCloserBar) * 100}%` }} title={`Held ${r.held}`} />
                                    <div className="bg-red-400" style={{ width: `${(r.notHeld / maxCloserBar) * 100}%` }} title={`Not held ${r.notHeld}`} />
                                </div>
                                <div className="w-10 text-right text-zinc-500">{r.total}</div>
                            </div>
                        ))}
                        <div className="flex gap-4 text-xs text-zinc-500 pt-1">
                            <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Held</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Not held</span>
                        </div>
                    </div>
                ) : (
                    <EmptyState title="No closing-call data yet" description="Closer activity will appear here." />
                )}
            </section>

            {/* Closer tracking table (matches Setter answer-rate table) */}
            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Closer tracking</h2>
                {closerReps.loading ? (
                    <LoadingState />
                ) : closerRows.length > 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left">Closer</th>
                                    <th className="px-4 py-2 text-left">Sets</th>
                                    <th className="px-4 py-2 text-left">Held</th>
                                    <th className="px-4 py-2 text-left">Not held</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {closerRows.map((c) => (
                                    <tr key={c.rep}>
                                        <td className="px-4 py-2 font-medium text-zinc-900">{c.rep}</td>
                                        <td className="px-4 py-2 text-zinc-700">{c.total}</td>
                                        <td className="px-4 py-2 text-emerald-700">{c.held}</td>
                                        <td className="px-4 py-2 text-red-600">{c.notHeld}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="No closing-call data yet" description="Closer tracking will appear here." />
                )}
            </section>

            {/* Delivery (Success Manager) rep performance - bar chart matching Setter (R5 #5) */}
            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Delivery rep performance <span className="text-xs font-normal text-zinc-400">· Mentees per Success Manager</span></h2>
                {smReps.loading ? (
                    <LoadingState />
                ) : smRows.length > 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
                        {smRows.slice(0, 15).map((r) => (
                            <div key={r.rep} className="flex items-center gap-3 text-xs">
                                <div className="w-32 truncate text-zinc-700">{r.rep}</div>
                                <div className="flex-1 flex h-4 rounded overflow-hidden bg-zinc-100">
                                    <div className="bg-emerald-500" style={{ width: `${(r.onboarding / maxSmBar) * 100}%` }} title={`Onboarding ${r.onboarding}`} />
                                    <div className="bg-slate-400" style={{ width: `${(r.offboarded / maxSmBar) * 100}%` }} title={`Offboarded ${r.offboarded}`} />
                                </div>
                                <div className="w-10 text-right text-zinc-500">{r.total}</div>
                            </div>
                        ))}
                        <div className="flex gap-4 text-xs text-zinc-500 pt-1">
                            <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Onboarding</span>
                            <span><span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1" />Offboarded</span>
                        </div>
                    </div>
                ) : (
                    <EmptyState title="No delivery data yet" description="Success Manager mentee load will appear here." />
                )}
            </section>

            {/* Delivery tracking table (matches Setter answer-rate table) */}
            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Delivery tracking</h2>
                {smReps.loading ? (
                    <LoadingState />
                ) : smRows.length > 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left">Success Manager</th>
                                    <th className="px-4 py-2 text-left">Mentees</th>
                                    <th className="px-4 py-2 text-left">Onboarding</th>
                                    <th className="px-4 py-2 text-left">Offboarded</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {smRows.map((s) => (
                                    <tr key={s.rep}>
                                        <td className="px-4 py-2 font-medium text-zinc-900">{s.rep}</td>
                                        <td className="px-4 py-2 text-zinc-700">{s.total}</td>
                                        <td className="px-4 py-2 text-emerald-700">{s.onboarding}</td>
                                        <td className="px-4 py-2 text-zinc-500">{s.offboarded}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="No delivery data yet" description="Success Manager tracking will appear here." />
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">
                        <Activity className="inline w-4 h-4 mr-1" />
                        Data freshness
                    </h2>
                    <div className="text-xs text-zinc-500">Per source ingestion latency</div>
                </div>
                {ingestion.loading ? (
                    <LoadingState />
                ) : (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase text-left">
                                <tr>
                                    <th className="px-4 py-2">Source</th>
                                    <th className="px-4 py-2">Rows</th>
                                    <th className="px-4 py-2">Last ingest</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {(ingestion.data ?? []).map((i) => {
                                    const backfill = BACKFILL_SOURCES.has(i.source);
                                    const stale = i.minutes_stale > 90;
                                    const status = backfill ? "Backfill" : stale ? "Stale" : "Fresh";
                                    const statusClass = backfill
                                        ? "bg-zinc-100 text-zinc-600"
                                        : stale
                                          ? "bg-red-50 text-red-700"
                                          : "bg-emerald-50 text-emerald-700";
                                    return (
                                        <tr key={i.source}>
                                            <td className="px-4 py-2 text-zinc-700">{SOURCE_LABELS[i.source] ?? i.source}</td>
                                            <td className="px-4 py-2 text-zinc-900">{formatNumber(i.total_rows)}</td>
                                            <td className="px-4 py-2 text-zinc-600">{formatDateTime(i.last_ingest_at)}</td>
                                            <td className="px-4 py-2">
                                                <span className={`text-xs px-2 py-0.5 rounded ${statusClass}`}>{status}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Top open bottlenecks</h2>
                {bottlenecks.loading ? (
                    <LoadingState />
                ) : bottlenecks.data && bottlenecks.data.length > 0 ? (
                    <div className="space-y-2">
                        {bottlenecks.data.slice(0, 10).map((b) => (
                            <div
                                key={b.bottleneck_id}
                                className="bg-white border border-zinc-200 rounded-md p-3 flex items-start justify-between gap-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-zinc-900 truncate">{b.bottleneck_title}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">
                                        Owner: {b.owner ?? "Unassigned"} • {b.affected_metric}
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700 whitespace-nowrap">
                                    P{b.priority_score ?? "-"}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No open bottlenecks"
                        description="Everything's clear."
                    />
                )}
            </section>

            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Active tests</h2>
                {tests.loading ? (
                    <LoadingState />
                ) : tests.data && tests.data.length > 0 ? (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase text-left">
                                <tr>
                                    <th className="px-4 py-2">Test ID</th>
                                    <th className="px-4 py-2">Type</th>
                                    <th className="px-4 py-2">Flow</th>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {tests.data.slice(0, 15).map((t) => (
                                    <tr key={t.test_id}>
                                        <td className="px-4 py-2 font-mono text-xs text-zinc-700">{t.test_id}</td>
                                        <td className="px-4 py-2 text-zinc-900">{t.test_type}</td>
                                        <td className="px-4 py-2 text-zinc-600">{t.economic_engine_flow}</td>
                                        <td className="px-4 py-2 text-zinc-600">{t.date_to_test ?? "-"}</td>
                                        <td className="px-4 py-2">
                                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                                                {t.status_update ?? "queued"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="No active tests"
                        description="Submitted test inputs will queue here."
                    />
                )}
            </section>

            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Running variant tests</h2>
                {runningTests.loading ? (
                    <LoadingState />
                ) : runningTests.data && runningTests.data.length > 0 ? (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase text-left">
                                <tr>
                                    <th className="px-4 py-2">Variant</th>
                                    <th className="px-4 py-2">Team</th>
                                    <th className="px-4 py-2">Assigned to</th>
                                    <th className="px-4 py-2">Window</th>
                                    <th className="px-4 py-2">Routing</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {runningTests.data.slice(0, 15).map((t) => (
                                    <tr key={t.id}>
                                        <td className="px-4 py-2 font-medium text-zinc-900">{t.variant_name}</td>
                                        <td className="px-4 py-2 text-zinc-600">{t.team}</td>
                                        <td className="px-4 py-2 text-zinc-700">{t.assigned_to ?? "-"}</td>
                                        <td className="px-4 py-2 text-zinc-600 text-xs">
                                            {t.date_to_test}{t.ends_at ? ` → ${t.ends_at}` : " → open"}
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                                {t.routing_status ?? "pending"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="No running tests"
                        description="Tests submitted via the Testing Form appear here while their window is active."
                    />
                )}
            </section>
        </div>
    );
}
