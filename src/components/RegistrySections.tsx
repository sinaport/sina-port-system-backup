import { AlertCircle, Trophy, FlaskConical } from "lucide-react";
import { useRoleView } from "@/hooks/useRoleView";
import { LoadingState, EmptyState } from "@/components/LoadingState";

// Shared Bottlenecks / Winners / Testing trio so every role dashboard (Setter, Closer,
// Success Manager) has the same backbone (Khryzl feedback #8: views structured similarly).
// Registries are org-wide, so each role sees the same live records.

interface Bottleneck { bottleneck_id: string; bottleneck_title: string; affected_metric: string; status: string | null; }
interface Winner { winner_id: string; winner_title: string; winning_metric: string; status: string | null; }
interface Test { test_id: string; test_type: string; economic_engine_flow: string; status_update: string | null; }

export function RegistrySections() {
    const bottlenecks = useRoleView<Bottleneck>("v_ea_open_bottlenecks");
    const winners = useRoleView<Winner>("v_data_winners");
    const tests = useRoleView<Test>("v_ea_active_tests");

    return (
        <>
            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3"><AlertCircle className="inline w-4 h-4 mr-1" />Bottlenecks</h2>
                {bottlenecks.loading ? <LoadingState /> : bottlenecks.data && bottlenecks.data.length > 0 ? (
                    <div className="space-y-2">
                        {bottlenecks.data.slice(0, 8).map((b) => (
                            <div key={b.bottleneck_id} className="bg-white border border-zinc-200 rounded-md p-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-zinc-900 truncate">{b.bottleneck_title}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">{b.affected_metric}</div>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700 whitespace-nowrap">{b.status ?? "open"}</span>
                            </div>
                        ))}
                    </div>
                ) : <EmptyState title="No open bottlenecks" description="Flagged metrics below KPI will appear here." />}
            </section>

            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3"><Trophy className="inline w-4 h-4 mr-1" />Winners</h2>
                {winners.loading ? <LoadingState /> : winners.data && winners.data.length > 0 ? (
                    <div className="space-y-2">
                        {winners.data.slice(0, 8).map((w) => (
                            <div key={w.winner_id} className="bg-white border border-zinc-200 rounded-md p-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-zinc-900 truncate">{w.winner_title}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">{w.winning_metric}</div>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 whitespace-nowrap">{w.status ?? "active"}</span>
                            </div>
                        ))}
                    </div>
                ) : <EmptyState title="No winners yet" description="Metrics above KPI will appear here." />}
            </section>

            <section>
                <h2 className="text-base font-semibold text-zinc-900 mb-3"><FlaskConical className="inline w-4 h-4 mr-1" />Testing</h2>
                {tests.loading ? <LoadingState /> : tests.data && tests.data.length > 0 ? (
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase text-left">
                                <tr><th className="px-4 py-2">Test</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Flow</th><th className="px-4 py-2">Status</th></tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {tests.data.slice(0, 10).map((t) => (
                                    <tr key={t.test_id}>
                                        <td className="px-4 py-2 font-mono text-xs text-zinc-700">{t.test_id}</td>
                                        <td className="px-4 py-2 text-zinc-900">{t.test_type}</td>
                                        <td className="px-4 py-2 text-zinc-600">{t.economic_engine_flow}</td>
                                        <td className="px-4 py-2"><span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">{t.status_update ?? "queued"}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <EmptyState title="No active tests" description="Submitted tests appear here while running." />}
            </section>
        </>
    );
}
