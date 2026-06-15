import { Activity, AlertTriangle, FlaskConical, Trophy, Users, Zap } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState, EmptyState } from "@/components/LoadingState";
import { useRoleView } from "@/hooks/useRoleView";
import type { DashboardMetric } from "@/types/schema";
import { formatDateTime, formatNumber } from "@/lib/utils";

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

export function EaDashboard() {
    const metrics = useRoleView<DashboardMetric>("v_ea_dashboard");
    const ingestion = useRoleView<IngestionHealth>("v_ea_ingestion_health");
    const bottlenecks = useRoleView<OpenBottleneck>("v_ea_open_bottlenecks");
    const tests = useRoleView<ActiveTest>("v_ea_active_tests");
    const alerts = useRoleView<Alert>("v_ea_alerts");
    const runningTests = useRoleView<RunningTest>("v_ea_running_tests");

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-2xl font-semibold text-zinc-900">Operations overview</h1>
                <p className="text-sm text-zinc-500">Cross-team health and active priority work.</p>
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
