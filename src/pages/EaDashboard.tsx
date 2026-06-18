import { useEffect, useState } from "react";
import { Activity, AlertTriangle, FlaskConical, Trophy, Users, Zap } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState, EmptyState } from "@/components/LoadingState";
import { DateRangeFilter, useDateRange } from "@/components/DateRangeFilter";
import { supabase } from "@/lib/supabase";
import { useRoleView } from "@/hooks/useRoleView";
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
};

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
    const totals = useRoleView<DashboardMetric>("v_ops_totals");
    const reps = useRoleView<RepPerf>("v_setter_tracking");

    // All-department metrics are date-filterable (feedback #1): fetched via RPC per range.
    const [range, setRange] = useDateRange();
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
                        />
                    ))}
                </div>
            )}

            {/* Data-source totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TOTALS_ORDER.map((key) => (
                    <MetricCard key={key} label={TOTALS_LABEL[key]} value={formatNumber(totalBy[key] ?? "0")} flag="blue" icon={<Activity className="w-5 h-5" />} />
                ))}
            </div>

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
                                        sublabel={m.target ? `Target ${m.target}${OPS_PCT.has(m.metric) ? "%" : m.metric === "roas" ? "x" : ""}` : (m.value === null ? "Not connected" : undefined)}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })
            )}

            {/* Rep performance (answered vs not answered) */}
            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Rep performance</h2>
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
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Answer rate</h2>
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
                                    const stale = i.minutes_stale > 90;
                                    return (
                                        <tr key={i.source}>
                                            <td className="px-4 py-2 text-zinc-700">{SOURCE_LABELS[i.source] ?? i.source}</td>
                                            <td className="px-4 py-2 text-zinc-900">{formatNumber(i.total_rows)}</td>
                                            <td className="px-4 py-2 text-zinc-600">{formatDateTime(i.last_ingest_at)}</td>
                                            <td className="px-4 py-2">
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded ${
                                                        stale
                                                            ? "bg-red-50 text-red-700"
                                                            : "bg-emerald-50 text-emerald-700"
                                                    }`}
                                                >
                                                    {stale ? "Stale" : "Fresh"}
                                                </span>
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
