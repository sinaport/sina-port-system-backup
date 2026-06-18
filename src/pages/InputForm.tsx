import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { fromEngine } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// Generic "Input Forms" capture (Add new Metric / KPI / Variable / Program / Link / SOP / Script).
// All write to engine.input_forms (form_type + details jsonb).

export type InputKind = "metric" | "kpi" | "variables" | "program" | "link" | "sop" | "script";

interface FieldDef { name: string; label: string; type?: "text" | "textarea" | "select"; options?: string[]; required?: boolean; }

const CONFIG: Record<InputKind, { title: string; subtitle: string; fields: FieldDef[] }> = {
    metric: { title: "New Metric", subtitle: "Define a metric the system should track.",
        fields: [{ name: "name", label: "Metric name", required: true }, { name: "definition", label: "Definition", type: "textarea" }, { name: "unit", label: "Unit (e.g. %, count, EUR)" }, { name: "source", label: "Data source" }] },
    kpi: { title: "New KPI", subtitle: "Add a KPI with its target and condition.",
        fields: [{ name: "name", label: "KPI name", required: true }, { name: "department", label: "Department", type: "select", options: ["Marketing", "Setter", "Closer", "Delivery", "Admin"] }, { name: "target", label: "Target value" }, { name: "unit", label: "Unit", type: "select", options: ["%", "count", "EUR", "x"] }, { name: "direction", label: "Direction", type: "select", options: ["Higher is better", "Lower is better"] }, { name: "formula", label: "Formula (plain English)", type: "textarea" }] },
    variables: { title: "New Variable", subtitle: "Add a test variable type for the Submit-a-test form.",
        fields: [{ name: "name", label: "Variable name", required: true }, { name: "team", label: "Team", type: "select", options: ["Marketing", "Setter", "Closer", "Delivery"] }, { name: "applies_to", label: "Applies to (funnel / ad / script…)" }] },
    program: { title: "New Program", subtitle: "Register a program / offer.",
        fields: [{ name: "name", label: "Program name", required: true }, { name: "tier", label: "Tier", type: "select", options: ["LTO", "HTO"] }, { name: "price", label: "Price (EUR)" }, { name: "whop_product_id", label: "Whop Product ID" }] },
    link: { title: "New Link", subtitle: "Register a tracked link.",
        fields: [{ name: "name", label: "Link name", required: true }, { name: "url", label: "URL", required: true }, { name: "purpose", label: "Purpose" }] },
    sop: { title: "New SOP", subtitle: "Document a standard operating procedure.",
        fields: [{ name: "name", label: "SOP name", required: true }, { name: "department", label: "Department", type: "select", options: ["Marketing", "Setter", "Closer", "Delivery", "Admin"] }, { name: "content", label: "SOP content or link", type: "textarea" }] },
    script: { title: "New Script", subtitle: "Add a call / message script.",
        fields: [{ name: "name", label: "Script name", required: true }, { name: "type", label: "Type", type: "select", options: ["Inbound", "Outbound", "Closing", "Webinar", "Other"] }, { name: "content", label: "Script content or link", type: "textarea" }] },
};

const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

export function InputForm({ kind }: { kind: InputKind }) {
    const { person } = useAuth();
    const cfg = CONFIG[kind];
    const [form, setForm] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        const { error: dbErr } = await fromEngine("input_forms").insert({
            form_type: kind,
            title: form[cfg.fields[0].name] ?? null,
            details: form,
            submitted_by: person?.full_name ?? null,
        });
        setSubmitting(false);
        if (dbErr) {
            console.error("[InputForm] insert failed:", dbErr.message);
            setError("Couldn't save this just now. Check your entries and try again.");
            return;
        }
        setSubmitted(true);
        setForm({});
    };

    if (submitted) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="text-center max-w-md">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h2 className="text-lg font-semibold mt-3">Saved</h2>
                    <p className="text-sm text-zinc-500 mt-1">{cfg.title} captured.</p>
                    <button onClick={() => setSubmitted(false)} className="mt-4 text-sm font-medium text-zinc-700 underline hover:no-underline">Add another</button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <h1 className="text-xl font-semibold text-zinc-900">{cfg.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">{cfg.subtitle}</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {cfg.fields.map((f) => (
                    <div key={f.name}>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">
                            {f.label} {f.required && <span className="text-red-500">*</span>}
                        </label>
                        {f.type === "textarea" ? (
                            <textarea required={f.required} value={form[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} rows={3} className={inputClass} />
                        ) : f.type === "select" ? (
                            <select required={f.required} value={form[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} className={inputClass}>
                                <option value="">Select</option>
                                {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        ) : (
                            <input required={f.required} value={form[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} className={inputClass} />
                        )}
                    </div>
                ))}
                {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                <div className="flex justify-end pt-2 border-t border-zinc-200">
                    <button type="submit" disabled={submitting} className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60">
                        {submitting ? "Saving..." : "Submit"}
                    </button>
                </div>
            </form>
        </div>
    );
}
