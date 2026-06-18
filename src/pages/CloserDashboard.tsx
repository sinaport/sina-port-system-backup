import { DollarSign, PhoneCall } from "lucide-react";
import { RegistrySections } from "@/components/RegistrySections";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState, EmptyState } from "@/components/LoadingState";
import { DateRangeFilter, useDateRange } from "@/components/DateRangeFilter";
import { useRoleView, useRangeView } from "@/hooks/useRoleView";
import type { DashboardMetric } from "@/types/schema";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

interface UpcomingCall {
    event_id: string;
    event_type_name: string;
    host: string;
    lead_name: string;
    lead_email: string;
    start_time: string;
    status: string;
}

interface CloserTrack {
    closer: string;
    sets: number;
    held: number;
    upcoming: number;
}

interface Payment {
    source: string;
    amount_eur: number;
    amount_original: number;
    currency: string;
    status: string;
    customer_email: string;
    paid_at: string;
    description: string;
}

const LABEL_BY_METRIC: Record<string, string> = {
    revenue: "Revenue",
    closes: "Payments",
};

const REVENUE_SPLIT_LABELS: Record<string, string> = {
    total_revenue: "Total this month",
    hto_purchases: "HTO purchases",
    hto_recurring: "HTO recurring",
    lto_purchases: "LTO purchases",
};
const REVENUE_SPLIT_ORDER = ["total_revenue", "hto_purchases", "hto_recurring", "lto_purchases"];

// Closer KPIs (item 4): sets / live calls / show rate / cash collection
const KPI_LABELS: Record<string, string> = {
    sets: "Sets",
    live_calls: "Live calls",
    show_rate: "Show rate",
    cash_collection: "Cash collection",
};
const KPI_ORDER = ["sets", "live_calls", "show_rate", "cash_collection"];
const KPI_PCT = new Set(["show_rate", "cash_collection"]);
// Her daily targets (Dept Workflows doc): red = not met.
const KPI_TARGETS: Record<string, number> = { show_rate: 70, cash_collection: 40 };
function kpiFlag(key: string, value: string): "green" | "red" | "blue" {
    const t = KPI_TARGETS[key];
    if (t === undefined) return "blue";
    return Number(value) >= t ? "green" : "red";
}

const FLAG_BY_METRIC: Record<string, "green" | "red" | "blue" | null> = {
    revenue: "green",
    closes: "blue",
};

function formatMetricValue(metric: string, value: string): string {
    if (metric.includes("revenue")) return formatCurrency(value);
    return formatNumber(value);
}

export function CloserDashboard() {
    const [range, setRange] = useDateRange();
    const metrics = useRangeView<DashboardMetric>("fn_closer_dashboard", range);
    const upcoming = useRoleView<UpcomingCall>("v_closer_upcoming_calls");
    const payments = useRoleView<Payment>("v_closer_recent_payments");
    const revenueSplit = useRangeView<DashboardMetric>("fn_closer_revenue_split", range);
    const tracking = useRoleView<CloserTrack>("v_closer_tracking");
    const kpis = useRangeView<DashboardMetric>("fn_closer_kpis", range);

    const splitByMetric = Object.fromEntries((revenueSplit.data ?? []).map((m) => [m.metric, m.value]));
    const kpiByMetric = Object.fromEntries((kpis.data ?? []).map((m) => [m.metric, m.value]));

    return (
        <div className="space-y-8">
            <header className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-zinc-900">Your closes</h1>
                    <p className="text-sm text-zinc-500">Revenue split + KPIs for the selected range; calls and payments are live.</p>
                </div>
                <DateRangeFilter value={range} onChange={setRange} />
            </header>

            {metrics.loading ? (
                <LoadingState label="Loading metrics..." />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(metrics.data ?? []).map((m) => (
                        <MetricCard
                            key={m.metric}
                            label={LABEL_BY_METRIC[m.metric] ?? m.metric}
                            value={formatMetricValue(m.metric, m.value)}
                            flag={FLAG_BY_METRIC[m.metric] ?? null}
                            icon={<DollarSign className="w-5 h-5" />}
                        />
                    ))}
                </div>
            )}

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">Revenue split</h2>
                    <div className="text-xs text-zinc-500">This month</div>
                </div>
                {revenueSplit.loading ? (
                    <LoadingState />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {REVENUE_SPLIT_ORDER.map((key) => (
                                <MetricCard
                                    key={key}
                                    label={REVENUE_SPLIT_LABELS[key]}
                                    value={formatCurrency(splitByMetric[key] ?? "0")}
                                    flag={key === "total_revenue" ? "green" : null}
                                    icon={<DollarSign className="w-5 h-5" />}
                                />
                            ))}
                        </div>
                    </>
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">Closer KPIs</h2>
                    <div className="text-xs text-zinc-500">This month · targets: show rate &ge; 70%, cash collection &ge; 40% (red = not met)</div>
                </div>
                {kpis.loading ? (
                    <LoadingState />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {KPI_ORDER.map((key) => (
                                <MetricCard
                                    key={key}
                                    label={KPI_LABELS[key]}
                                    value={`${formatNumber(kpiByMetric[key] ?? "0")}${KPI_PCT.has(key) ? "%" : ""}`}
                                    flag={kpiFlag(key, kpiByMetric[key] ?? "0")}
                                    icon={<PhoneCall className="w-5 h-5" />}
                                />
                            ))}
                        </div>
                        <p className="text-xs text-zinc-400 mt-2">
                            Show rate counts a call as shown when a Fathom recording exists, so it undercounts calls that weren't recorded. Cash collection is based on the Collection Status in Airtable. Both get exact once attendance and payment status are captured at the source.
                        </p>
                    </>
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">Closer performance</h2>
                    <div className="text-xs text-zinc-500">Strategy calls this month</div>
                </div>
                {tracking.loading ? (
                    <LoadingState />
                ) : tracking.data && tracking.data.length > 0 ? (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-left text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-2">Closer</th>
                                    <th className="px-4 py-2">Sets</th>
                                    <th className="px-4 py-2">Held</th>
                                    <th className="px-4 py-2">Upcoming</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {tracking.data.map((t) => (
                                    <tr key={t.closer}>
                                        <td className="px-4 py-2 font-medium text-zinc-900">{t.closer}</td>
                                        <td className="px-4 py-2 text-zinc-700">{t.sets}</td>
                                        <td className="px-4 py-2 text-zinc-700">{t.held}</td>
                                        <td className="px-4 py-2 text-zinc-600">{t.upcoming}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title="No strategy calls this month" description="Booked strategy and closing calls will appear here per closer." />
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">
                        <PhoneCall className="inline w-4 h-4 mr-1" />
                        Upcoming closing calls
                    </h2>
                    <div className="text-xs text-zinc-500">Next 7 days</div>
                </div>
                {upcoming.loading ? (
                    <LoadingState />
                ) : upcoming.data && upcoming.data.length > 0 ? (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase text-left">
                                <tr>
                                    <th className="px-4 py-2">Lead</th>
                                    <th className="px-4 py-2">Email</th>
                                    <th className="px-4 py-2">Closer / host</th>
                                    <th className="px-4 py-2">Event</th>
                                    <th className="px-4 py-2">Status</th>
                                    <th className="px-4 py-2">When</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {upcoming.data.slice(0, 15).map((c) => (
                                    <tr key={c.event_id}>
                                        <td className="px-4 py-2 font-medium text-zinc-900">{c.lead_name || "-"}</td>
                                        <td className="px-4 py-2 text-zinc-600">{c.lead_email || "-"}</td>
                                        <td className="px-4 py-2 text-zinc-600">{c.host || "-"}</td>
                                        <td className="px-4 py-2 text-zinc-600">{c.event_type_name}</td>
                                        <td className="px-4 py-2">
                                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">{c.status ?? "-"}</span>
                                        </td>
                                        <td className="px-4 py-2 text-zinc-600">{formatDateTime(c.start_time)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="No upcoming calls"
                        description="Closing calls booked through Calendly will appear here."
                    />
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">Recent payments</h2>
                    <div className="text-xs text-zinc-500">Last 30 days</div>
                </div>
                {payments.loading ? (
                    <LoadingState />
                ) : payments.data && payments.data.length > 0 ? (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase text-left">
                                <tr>
                                    <th className="px-4 py-2">Customer</th>
                                    <th className="px-4 py-2">Amount</th>
                                    <th className="px-4 py-2">Source</th>
                                    <th className="px-4 py-2">Paid</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {payments.data.slice(0, 15).map((p, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-2 text-zinc-900">{p.customer_email}</td>
                                        <td className="px-4 py-2 font-medium text-emerald-700">
                                            {formatCurrency(p.amount_eur)}
                                            {p.currency && p.currency.toUpperCase() !== "EUR" && (
                                                <span className="ml-1 text-xs font-normal text-zinc-400">
                                                    ({formatNumber(p.amount_original)} {p.currency.toUpperCase()})
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-zinc-600 capitalize">{p.source}</td>
                                        <td className="px-4 py-2 text-zinc-600">{formatDateTime(p.paid_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="No payments in the last 30 days"
                        description="Payments from Stripe, PayPal, and Whop will show up here as they come in."
                    />
                )}
            </section>

            <RegistrySections />
        </div>
    );
}
