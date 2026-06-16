import { Calendar, UserPlus, ClipboardList, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState, EmptyState } from "@/components/LoadingState";
import { SetterTrackingDaily } from "@/components/SetterTrackingDaily";
import { useRoleView } from "@/hooks/useRoleView";
import type { DashboardMetric } from "@/types/schema";
import { formatDateTime } from "@/lib/utils";

interface Booking {
    calendly_event_id: string;
    event_name: string;
    host: string;
    lead_name: string;
    lead_email: string;
    status: string;
    start_time: string;
    booked_at: string;
    hours_until_call: number;
}

interface Bottleneck {
    bottleneck_id: string;
    bottleneck_title: string;
    affected_metric: string;
    priority_score: string;
    status: string | null;
    date_created: string;
}

const ICON_BY_METRIC: Record<string, React.ReactNode> = {
    today_bookings: <Calendar className="w-5 h-5" />,
    tomorrow_bookings: <Calendar className="w-5 h-5" />,
    week_bookings: <TrendingUp className="w-5 h-5" />,
    new_leads_today: <UserPlus className="w-5 h-5" />,
};

const LABEL_BY_METRIC: Record<string, string> = {
    today_bookings: "Bookings today",
    tomorrow_bookings: "Bookings tomorrow",
    week_bookings: "Bookings this week",
    new_leads_today: "New leads today",
};

export function SetterDashboard() {
    const metrics = useRoleView<DashboardMetric>("v_setter_dashboard");
    const bookings = useRoleView<Booking>("v_setter_recent_bookings");
    const bottlenecks = useRoleView<Bottleneck>("v_setter_my_bottlenecks");

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-2xl font-semibold text-zinc-900">Your day</h1>
                <p className="text-sm text-zinc-500">
                    Live numbers from your bookings and pipeline. Updated every 30 minutes.
                </p>
            </header>

            {metrics.loading ? (
                <LoadingState label="Loading metrics..." />
            ) : metrics.error ? (
                <div className="text-sm text-red-600">Couldn't load your numbers right now. Refresh the page, and if it keeps happening let us know.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(metrics.data ?? []).map((m) => (
                        <MetricCard
                            key={m.metric}
                            label={LABEL_BY_METRIC[m.metric] ?? m.metric}
                            value={m.value}
                            icon={ICON_BY_METRIC[m.metric]}
                        />
                    ))}
                </div>
            )}

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">Recent bookings</h2>
                    <div className="text-xs text-zinc-500">Last 14 days</div>
                </div>
                {bookings.loading ? (
                    <LoadingState />
                ) : bookings.data && bookings.data.length > 0 ? (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-left text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-2">Lead</th>
                                    <th className="px-4 py-2">Email</th>
                                    <th className="px-4 py-2">Host / triager</th>
                                    <th className="px-4 py-2">Event</th>
                                    <th className="px-4 py-2">When</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {bookings.data.slice(0, 12).map((b) => (
                                    <tr key={b.calendly_event_id}>
                                        <td className="px-4 py-2 font-medium text-zinc-900">{b.lead_name || "-"}</td>
                                        <td className="px-4 py-2 text-zinc-600">{b.lead_email || "-"}</td>
                                        <td className="px-4 py-2 text-zinc-600">{b.host || "-"}</td>
                                        <td className="px-4 py-2 text-zinc-600">{b.event_name ?? "-"}</td>
                                        <td className="px-4 py-2 text-zinc-600">{formatDateTime(b.start_time)}</td>
                                        <td className="px-4 py-2">
                                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                                                {b.status ?? "-"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="No bookings yet"
                        description="When leads book through your Calendly link, they'll appear here."
                    />
                )}
            </section>

            <SetterTrackingDaily />

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">
                        <ClipboardList className="inline w-4 h-4 mr-1" />
                        Your bottlenecks
                    </h2>
                </div>
                {bottlenecks.loading ? (
                    <LoadingState />
                ) : bottlenecks.data && bottlenecks.data.length > 0 ? (
                    <div className="space-y-2">
                        {bottlenecks.data.map((b) => (
                            <div key={b.bottleneck_id} className="bg-white border border-zinc-200 rounded-md p-3 flex items-start justify-between">
                                <div>
                                    <div className="text-sm font-medium text-zinc-900">{b.bottleneck_title}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">
                                        {b.affected_metric} • {b.status ?? "open"}
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700">
                                    Priority {b.priority_score ?? "-"}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No bottlenecks assigned"
                        description="Bottlenecks flagged for your role will show up here when they're created."
                    />
                )}
            </section>
        </div>
    );
}
