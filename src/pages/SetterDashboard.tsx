import { Calendar, UserPlus, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState, EmptyState } from "@/components/LoadingState";
import { SetterTrackingDaily } from "@/components/SetterTrackingDaily";
import { RegistrySections } from "@/components/RegistrySections";
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

const ICON_BY_METRIC: Record<string, React.ReactNode> = {
    bookings_today: <Calendar className="w-5 h-5" />,
    bookings_week: <TrendingUp className="w-5 h-5" />,
    bookings_month: <TrendingUp className="w-5 h-5" />,
    new_leads_today: <UserPlus className="w-5 h-5" />,
};

const LABEL_BY_METRIC: Record<string, string> = {
    bookings_today: "Bookings today",
    bookings_week: "Bookings this week",
    bookings_month: "Bookings this month",
    new_leads_today: "New leads today",
};

export function SetterDashboard() {
    const metrics = useRoleView<DashboardMetric>("v_setter_dashboard");
    const bookings = useRoleView<Booking>("v_setter_recent_bookings");

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
                    <h2 className="text-base font-semibold text-zinc-900">Inbound bookings (Calendly)</h2>
                    <div className="text-xs text-zinc-500">From Calendly / Google Calendar · last 14 days</div>
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

            <RegistrySections />
        </div>
    );
}
