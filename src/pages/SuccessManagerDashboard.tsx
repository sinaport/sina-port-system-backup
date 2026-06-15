import { Video, Clock, Users, GraduationCap, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { LoadingState, EmptyState } from "@/components/LoadingState";
import { useRoleView } from "@/hooks/useRoleView";
import type { DashboardMetric } from "@/types/schema";
import { formatDateTime, formatNumber } from "@/lib/utils";

interface Meeting {
    id: string;
    title: string;
    started_at: string;
    duration_minutes: number;
    host_email: string;
    summary: string | null;
    recording_url: string | null;
}

interface Mentee {
    row_id: number;
    id_lead: string | null;
    status: string | null;
    date_opted_in: string | null;
    date_closed: string | null;
    opt_in_to_close_gap: string | null;
    lead_grade: string | null;
    call_grade: string | null;
    success_manager_assigned: string | null;
    ascended: string | null;
    objection: string | null;
    complaints: string | null;
    complaints_type: string | null;
}

function ascensionBadge(ascended: string | null) {
    const v = (ascended ?? "").toLowerCase().trim();
    if (v === "yes") {
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">Ascended</span>;
    }
    if (v === "no") {
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700">Not yet</span>;
    }
    return <span className="text-xs text-zinc-400">-</span>;
}

const LABEL_BY_METRIC: Record<string, string> = {
    meetings_this_week: "Meetings this week",
    meetings_today: "Meetings today",
    avg_meeting_minutes: "Avg meeting length",
};

const SUFFIX_BY_METRIC: Record<string, string> = {
    avg_meeting_minutes: " min",
};

export function SuccessManagerDashboard() {
    const metrics = useRoleView<DashboardMetric>("v_sm_dashboard");
    const meetings = useRoleView<Meeting>("v_sm_recent_meetings");
    const mentees = useRoleView<Mentee>("v_sm_mentee_tracking");

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-2xl font-semibold text-zinc-900">Your mentees</h1>
                <p className="text-sm text-zinc-500">Recent check-ins and meeting activity.</p>
            </header>

            {metrics.loading ? (
                <LoadingState label="Loading metrics..." />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(metrics.data ?? []).map((m) => (
                        <MetricCard
                            key={m.metric}
                            label={LABEL_BY_METRIC[m.metric] ?? m.metric}
                            value={`${formatNumber(m.value)}${SUFFIX_BY_METRIC[m.metric] ?? ""}`}
                            flag="blue"
                            icon={
                                m.metric === "avg_meeting_minutes" ? (
                                    <Clock className="w-5 h-5" />
                                ) : (
                                    <Video className="w-5 h-5" />
                                )
                            }
                        />
                    ))}
                </div>
            )}

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">
                        <GraduationCap className="inline w-4 h-4 mr-1" />
                        Mentee tracking
                    </h2>
                    <div className="text-xs text-zinc-500">{mentees.data?.length ?? 0} total</div>
                </div>
                {mentees.loading ? (
                    <LoadingState />
                ) : mentees.data && mentees.data.length > 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide">
                                <tr>
                                    <th className="px-3 py-2 text-left">Lead</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Opted in</th>
                                    <th className="px-3 py-2 text-left">Closed</th>
                                    <th className="px-3 py-2 text-left">Ascended</th>
                                    <th className="px-3 py-2 text-left">SM assigned</th>
                                    <th className="px-3 py-2 text-left">Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mentees.data.map((m) => {
                                    const hasComplaint = (m.complaints ?? "").trim() && (m.complaints ?? "").toLowerCase() !== "null";
                                    const hasObjection = (m.objection ?? "").trim() && (m.objection ?? "").toLowerCase() !== "no" && (m.objection ?? "").toLowerCase() !== "null";
                                    const risk = hasComplaint || hasObjection;
                                    return (
                                        <tr key={m.row_id} className="border-t border-zinc-100 hover:bg-zinc-50">
                                            <td className="px-3 py-2 font-medium text-zinc-900">{m.id_lead ?? "-"}</td>
                                            <td className="px-3 py-2 text-zinc-700">{m.status ?? "-"}</td>
                                            <td className="px-3 py-2 text-zinc-600 text-xs">{m.date_opted_in ? formatDateTime(m.date_opted_in).split(" ")[0] : "-"}</td>
                                            <td className="px-3 py-2 text-zinc-600 text-xs">{m.date_closed ? formatDateTime(m.date_closed).split(" ")[0] : "-"}</td>
                                            <td className="px-3 py-2">{ascensionBadge(m.ascended)}</td>
                                            <td className="px-3 py-2 text-zinc-700">{m.success_manager_assigned ?? "-"}</td>
                                            <td className="px-3 py-2">
                                                {risk ? (
                                                    <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {hasComplaint ? "Complaint" : "Objection"}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-zinc-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="No mentees assigned yet"
                        description="Mentees from your closed leads will appear here once they're tracked in the system."
                    />
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-zinc-900">
                        <Users className="inline w-4 h-4 mr-1" />
                        Recent meetings
                    </h2>
                    <div className="text-xs text-zinc-500">Last 30 days</div>
                </div>
                {meetings.loading ? (
                    <LoadingState />
                ) : meetings.data && meetings.data.length > 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide">
                                <tr>
                                    <th className="px-3 py-2 text-left">Meeting</th>
                                    <th className="px-3 py-2 text-left">Date</th>
                                    <th className="px-3 py-2 text-left">Length</th>
                                    <th className="px-3 py-2 text-left">Host</th>
                                    <th className="px-3 py-2 text-left">Recording</th>
                                </tr>
                            </thead>
                            <tbody>
                                {meetings.data.slice(0, 20).map((m) => (
                                    <tr key={m.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                                        <td className="px-3 py-2 font-medium text-zinc-900 max-w-xs truncate">{m.title}</td>
                                        <td className="px-3 py-2 text-zinc-600 text-xs whitespace-nowrap">{formatDateTime(m.started_at)}</td>
                                        <td className="px-3 py-2 text-zinc-600">{m.duration_minutes} min</td>
                                        <td className="px-3 py-2 text-zinc-600 text-xs">{m.host_email}</td>
                                        <td className="px-3 py-2">
                                            {m.recording_url ? (
                                                <a href={m.recording_url} target="_blank" rel="noopener noreferrer"
                                                   className="text-xs px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700">
                                                    View
                                                </a>
                                            ) : <span className="text-xs text-zinc-400">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="No recent meetings"
                        description="Fathom meetings will appear here as they're recorded."
                    />
                )}
            </section>
        </div>
    );
}
