import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LoadingState, EmptyState } from "@/components/LoadingState";

// Per-day setter tracking, matching the team-sina-hub "Daily Setter Tracking"
// reference. Reads engine.fn_setter_tracking(p_date). Columns shown are the ones
// we can compute directly from Close; Sets / Closed / Show-Rate columns are
// pending client definitions + the Calendly cancellation feed.

interface Row {
    setter: string;
    dials: number;
    unique_leads: number;
    answered: number;
    answer_rate_pct: number;
    conversations_1min: number;
    talk_time_sec: number;
    inbound_taken: number;
    outbound_taken: number;
    total_taken: number;
    avg_speed_to_lead_min: number | null;
}

// Daily KPI targets from the reference (pending Khryzl's confirmation). Red = not met.
const TARGET_DIALS_UNIQUE = 200;
const TARGET_ANSWER_RATE = 45;

function isoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function shiftDay(iso: string, delta: number): string {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + delta);
    return isoDay(d);
}

function talk(sec: number): string {
    if (!sec) return "-";
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function speed(min: number | null): string {
    if (min === null || min === undefined) return "-";
    if (min < 60) return `${Math.round(min)}m`;
    return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

export function SetterTrackingDaily() {
    const [day, setDay] = useState<string>(() => isoDay(new Date()));
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void supabase
            .schema("engine" as never)
            .rpc("fn_setter_tracking", { p_date: day })
            .then(({ data }) => {
                if (cancelled) return;
                setRows((data as Row[]) ?? []);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [day]);

    const isToday = day === isoDay(new Date());

    return (
        <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-base font-semibold text-zinc-900">
                    <Phone className="inline w-4 h-4 mr-1" />
                    Daily setter tracking
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setDay((d) => shiftDay(d, -1))}
                        className="p-1.5 rounded border border-zinc-300 hover:bg-zinc-50"
                        aria-label="Previous day"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <input
                        type="date"
                        value={day}
                        max={isoDay(new Date())}
                        onChange={(e) => setDay(e.target.value)}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-900 focus:outline-none"
                    />
                    <button
                        onClick={() => setDay((d) => shiftDay(d, 1))}
                        disabled={isToday}
                        className="p-1.5 rounded border border-zinc-300 hover:bg-zinc-50 disabled:opacity-40"
                        aria-label="Next day"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="text-xs text-zinc-500 mb-2">
                Targets: dials &ge; {TARGET_DIALS_UNIQUE} unique, answer rate &ge; {TARGET_ANSWER_RATE}%. Red = not met. (Sets and show-rate columns coming once defined.)
            </div>

            {loading ? (
                <LoadingState />
            ) : rows.length > 0 ? (
                <div className="bg-white rounded-lg border border-zinc-200 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-zinc-600 text-left text-xs uppercase">
                            <tr>
                                <th className="px-3 py-2">Setter</th>
                                <th className="px-3 py-2">Dials</th>
                                <th className="px-3 py-2">Speed to lead</th>
                                <th className="px-3 py-2">Conversations (1m+)</th>
                                <th className="px-3 py-2">Talk time</th>
                                <th className="px-3 py-2">Inbound taken</th>
                                <th className="px-3 py-2">Outbound taken</th>
                                <th className="px-3 py-2">Total taken</th>
                                <th className="px-3 py-2">Answer rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {rows.map((r) => {
                                const dialsLow = r.unique_leads < TARGET_DIALS_UNIQUE;
                                const rateLow = Number(r.answer_rate_pct) < TARGET_ANSWER_RATE;
                                return (
                                    <tr key={r.setter}>
                                        <td className="px-3 py-2 font-medium text-zinc-900">{r.setter}</td>
                                        <td className={`px-3 py-2 ${dialsLow ? "text-red-600" : "text-zinc-700"}`}>
                                            {r.dials.toLocaleString()} <span className="text-zinc-400">({r.unique_leads})</span>
                                        </td>
                                        <td className="px-3 py-2 text-zinc-600">{speed(r.avg_speed_to_lead_min)}</td>
                                        <td className="px-3 py-2 text-zinc-600">{r.conversations_1min}</td>
                                        <td className="px-3 py-2 text-zinc-600">{talk(r.talk_time_sec)}</td>
                                        <td className="px-3 py-2 text-zinc-600">{r.inbound_taken}</td>
                                        <td className="px-3 py-2 text-zinc-600">{r.outbound_taken}</td>
                                        <td className="px-3 py-2 text-zinc-700">{r.total_taken}</td>
                                        <td className={`px-3 py-2 font-medium ${rateLow ? "text-red-600" : "text-emerald-600"}`}>{r.answer_rate_pct}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState title="No call activity for this day" description="Pick another date, or check back as calls come in." />
            )}
        </section>
    );
}
