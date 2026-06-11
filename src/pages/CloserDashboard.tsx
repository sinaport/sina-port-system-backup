import { DollarSign, PhoneCall, Trophy } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState, EmptyState } from "@/components/LoadingState";
import { useRoleView } from "@/hooks/useRoleView";
import type { DashboardMetric } from "@/types/schema";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils";

interface UpcomingCall {
    event_id: string;
    event_type_name: string;
    lead_name: string;
    start_time: string;
    status: string;
}

interface Payment {
    source: string;
    amount: number;
    currency: string;
    status: string;
    customer_email: string;
    paid_at: string;
    description: string;
}

interface Winner {
    winner_id: string;
    winner_title: string;
    winning_metric: string;
    priority_score: string;
    status: string;
}

const LABEL_BY_METRIC: Record<string, string> = {
    closes_today: "Closes scheduled today",
    week_revenue: "Revenue this week",
    month_revenue: "Revenue this month",
    payments_today: "Payments today",
};

const FLAG_BY_METRIC: Record<string, "green" | "red" | "blue" | null> = {
    closes_today: "blue",
    week_revenue: "green",
    month_revenue: "green",
    payments_today: "green",
};

function formatMetricValue(metric: string, value: string): string {
    if (metric.includes("revenue")) return formatCurrency(value);
    return formatNumber(value);
}

export function CloserDashboard() {
    const metrics = useRoleView<DashboardMetric>("v_closer_dashboard");
    const upcoming = useRoleView<UpcomingCall>("v_closer_upcoming_calls");
    const payments = useRoleView<Payment>("v_closer_recent_payments");
    const winners = useRoleView<Winner>("v_closer_my_winners");

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-2xl font-semibold text-zinc-900">Your closes</h1>
                <p className="text-sm text-zinc-500">Scheduled calls, recent revenue, and the wins you own.</p>
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
                    <h2 className="text-base font-semibold text-zinc-900">
                        <PhoneCall className="inline w-4 h-4 mr-1" />
                        Upcoming closing calls
                    </h2>
                    <div className="text-xs text-zinc-500">Next 7 days</div>
                </div>
                {upcoming.loading ? (
                    <LoadingState />
                ) : upcoming.data && upcoming.data.length > 0 ? (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase text-left">
                                <tr>
                                    <th className="px-4 py-2">Lead</th>
                                    <th className="px-4 py-2">Event</th>
                                    <th className="px-4 py-2">When</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {upcoming.data.slice(0, 10).map((c) => (
                                    <tr key={c.event_id}>
                                        <td className="px-4 py-2 font-medium text-zinc-900">{c.lead_name ?? "—"}</td>
                                        <td className="px-4 py-2 text-zinc-600">{c.event_type_name}</td>
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
                                        <td className="px-4 py-2 font-medium text-emerald-700">{formatCurrency(p.amount)}</td>
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

            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3">
                    <Trophy className="inline w-4 h-4 mr-1" />
                    Your winners
                </h2>
                {winners.loading ? (
                    <LoadingState />
                ) : winners.data && winners.data.length > 0 ? (
                    <div className="space-y-2">
                        {winners.data.map((w) => (
                            <div key={w.winner_id} className="bg-white border border-zinc-200 rounded-md p-3 flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-medium text-zinc-900">{w.winner_title}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">
                                        {w.winning_metric} • {w.status ?? "open"}
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                    Priority {w.priority_score ?? "—"}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No winners assigned yet"
                        description="Winning patterns flagged for your role will appear here."
                    />
                )}
            </section>
        </div>
    );
}
