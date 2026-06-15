import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, X, Save } from "lucide-react";
import { fromDictionary } from "@/lib/supabase";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import type { KpiRow } from "@/types/schema";

const EDITABLE_FIELDS: Array<keyof KpiRow> = [
    "target_value",
    "target_unit",
    "direction",
    "winner_condition",
    "losing_condition",
    "observation_condition",
    "owner_role",
    "frequency",
    "formula_plain_english",
];

const FIELD_LABELS: Record<string, string> = {
    target_value: "Target value",
    target_unit: "Unit",
    direction: "Direction",
    winner_condition: "Winner if",
    losing_condition: "Losing if",
    observation_condition: "Watch if",
    owner_role: "Owner role",
    frequency: "Frequency",
    formula_plain_english: "Formula (plain English)",
};

export function KpiDictionary() {
    const { person } = useAuth();
    const isAdmin = person?.department === "Admin";
    const [rows, setRows] = useState<KpiRow[] | null>(null);
    const [filter, setFilter] = useState("");
    const [editing, setEditing] = useState<KpiRow | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        const { data, error } = await fromDictionary("kpi").select("*").order("kpi_id");
        if (error) setError(error.message);
        else setRows((data ?? []) as KpiRow[]);
    };

    useEffect(() => {
        void load();
    }, []);

    const filtered = rows?.filter(
        (r) =>
            !filter ||
            r.kpi_id?.toLowerCase().includes(filter.toLowerCase()) ||
            r.kpi_name?.toLowerCase().includes(filter.toLowerCase()) ||
            r.department?.toLowerCase().includes(filter.toLowerCase())
    );

    const handleSave = async () => {
        if (!editing) return;
        setSaving(true);
        setError(null);
        const patch: Partial<KpiRow> = {};
        for (const f of EDITABLE_FIELDS) {
            patch[f] = editing[f] as never;
        }
        const { error } = await fromDictionary("kpi").update(patch).eq("kpi_id", editing.kpi_id);
        setSaving(false);
        if (error) {
            setError(error.message);
        } else {
            setEditing(null);
            void load();
        }
    };

    if (rows === null) return <LoadingState label="Loading KPI Dictionary..." />;

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-zinc-900">KPI Dictionary</h1>
                    <p className="text-sm text-zinc-500">
                        {rows.length} KPIs. {isAdmin ? "Click a row to edit." : "Read-only for your role."}
                    </p>
                </div>
                <input
                    placeholder="Search KPI ID, name, department..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-3 py-2 border border-zinc-300 rounded-md text-sm w-64"
                />
            </header>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                    {error}
                </div>
            )}

            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase text-left">
                        <tr>
                            <th className="px-4 py-2">KPI ID</th>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">Flow</th>
                            <th className="px-4 py-2">Department</th>
                            <th className="px-4 py-2">Target</th>
                            <th className="px-4 py-2">Direction</th>
                            <th className="px-4 py-2">Owner role</th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {(filtered ?? []).map((r) => (
                            <tr key={r.kpi_id} className="hover:bg-zinc-50">
                                <td className="px-4 py-2 font-mono text-xs text-zinc-700">{r.kpi_id}</td>
                                <td className="px-4 py-2 font-medium text-zinc-900">{r.kpi_name}</td>
                                <td className="px-4 py-2 text-zinc-600">{r.economic_engine_flow ?? "-"}</td>
                                <td className="px-4 py-2 text-zinc-600">{r.department ?? "-"}</td>
                                <td className="px-4 py-2 text-zinc-900">
                                    {r.target_value ?? "-"}
                                    {r.target_unit ? ` ${r.target_unit}` : ""}
                                </td>
                                <td className="px-4 py-2 text-zinc-600">{r.direction ?? "-"}</td>
                                <td className="px-4 py-2 text-zinc-600">{r.owner_role ?? "-"}</td>
                                <td className="px-4 py-2 text-right">
                                    {isAdmin && (
                                        <button
                                            onClick={() => setEditing(r)}
                                            className="p-1 hover:bg-zinc-100 rounded"
                                            aria-label="Edit"
                                        >
                                            <Pencil className="w-4 h-4 text-zinc-500" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editing && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between p-5 border-b border-zinc-200">
                            <div>
                                <div className="text-xs font-mono text-zinc-500">{editing.kpi_id}</div>
                                <h2 className="text-lg font-semibold text-zinc-900">{editing.kpi_name}</h2>
                            </div>
                            <button onClick={() => setEditing(null)} className="p-1 hover:bg-zinc-100 rounded">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {EDITABLE_FIELDS.map((f) => (
                                <div key={f}>
                                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                                        {FIELD_LABELS[f] ?? f}
                                        {f === "formula_plain_english" && (
                                            <span className="ml-2 text-amber-700 font-normal text-[10px]">
                                                Editing this updates documentation only. Changing calculation logic needs a code change.
                                            </span>
                                        )}
                                    </label>
                                    {f === "formula_plain_english" ? (
                                        <textarea
                                            value={(editing[f] as string) ?? ""}
                                            onChange={(e) => setEditing({ ...editing, [f]: e.target.value } as KpiRow)}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm font-mono"
                                        />
                                    ) : (
                                        <input
                                            value={(editing[f] as string) ?? ""}
                                            onChange={(e) => setEditing({ ...editing, [f]: e.target.value } as KpiRow)}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4 bg-zinc-50 border-t border-zinc-200">
                            <button
                                onClick={() => setEditing(null)}
                                className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => void handleSave()}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? "Saving..." : "Save changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
