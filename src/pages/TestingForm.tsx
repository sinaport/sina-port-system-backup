import { useMemo, useState } from "react";
import { CheckCircle2, FlaskConical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// The Testing Form: each team submits what they want to test, where to apply it,
// and who's responsible. fn_submit_test auto-names the variant (LP Copy 2, etc.),
// opens a variant window so incoming leads get tagged, and queues a routing
// notification to the assignee.

type TeamKey = "marketing_funnel" | "marketing_ads" | "setter_closer" | "delivery";

interface VariableOption {
    value: string;
    label: string;
}

interface TeamPanel {
    key: TeamKey;
    label: string;
    team: string; // value passed to fn_submit_test
    variables: VariableOption[];
    applyFields: ("funnel" | "ad_account" | "ad_campaign" | "ad_set" | "editor" | "script_type")[];
    assignees: string[];
}

const PANELS: TeamPanel[] = [
    {
        key: "marketing_funnel",
        label: "Marketing — Funnel",
        team: "marketing",
        variables: [
            { value: "landing_page_copy", label: "Landing Page Copy" },
            { value: "vsl", label: "VSL" },
            { value: "opt_in_question", label: "Opt-in Question" },
            { value: "funnel_flow", label: "Funnel Flow" },
        ],
        applyFields: ["funnel"],
        assignees: ["Peter", "Marketing Manager"],
    },
    {
        key: "marketing_ads",
        label: "Marketing — Ads",
        team: "marketing",
        variables: [
            { value: "hook", label: "Hook" },
            { value: "angle", label: "Angle" },
            { value: "ad_creative_script", label: "Ad Creative Script" },
            { value: "meat", label: "Meat" },
            { value: "cta", label: "CTA" },
        ],
        applyFields: ["ad_account", "ad_campaign", "ad_set", "editor"],
        assignees: ["Media Buyer", "Editor"],
    },
    {
        key: "setter_closer",
        label: "Setters & Closers",
        team: "setter_closer",
        variables: [
            { value: "outbound_script", label: "Outbound Script" },
            { value: "inbound_script", label: "Inbound Script" },
            { value: "closing_script", label: "Closing Script" },
            { value: "setter_sop", label: "Setter SOP" },
            { value: "closer_sop", label: "Closer SOP" },
        ],
        applyFields: ["script_type"],
        assignees: ["Jenna Botha", "Hannah McAuley"],
    },
    {
        key: "delivery",
        label: "Delivery",
        team: "delivery",
        variables: [
            { value: "webinar_script", label: "Webinar Script" },
            { value: "momentum_call_script", label: "Momentum Call Script" },
            { value: "brand_audit_form", label: "Brand Audit Form" },
        ],
        applyFields: ["script_type"],
        assignees: ["Victoria Charlotte"],
    },
];

const FUNNELS = [
    { value: "gptby_quiz", label: "GPTBY Quiz" },
    { value: "gptby_free", label: "GPTBY Free" },
    { value: "fib_quiz", label: "FIB Quiz" },
    { value: "fib_27", label: "FIB $27" },
];

const inputClass =
    "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
            {children}
            {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
    );
}

export function TestingForm() {
    const { person } = useAuth();
    const [activePanel, setActivePanel] = useState<TeamKey>("marketing_funnel");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ variant_name: string; assigned_to: string | null } | null>(null);

    const panel = useMemo(() => PANELS.find((p) => p.key === activePanel)!, [activePanel]);

    const [form, setForm] = useState<Record<string, string>>({
        variable_type: "",
        apply_funnel: "",
        apply_ad_account: "",
        apply_ad_campaign: "",
        apply_ad_set: "",
        apply_editor: "",
        apply_script_type: "",
        date_to_test: new Date().toISOString().slice(0, 10),
        ends_at: "",
        assigned_to: "",
        hypothesis: "",
        notes: "",
    });

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const switchPanel = (k: TeamKey) => {
        setActivePanel(k);
        setResult(null);
        setError(null);
        setForm((f) => ({
            ...f,
            variable_type: "",
            apply_funnel: "",
            apply_ad_account: "",
            apply_ad_campaign: "",
            apply_ad_set: "",
            apply_editor: "",
            apply_script_type: "",
            assigned_to: "",
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const { data, error: rpcErr } = await supabase.rpc("fn_submit_test", {
            p_team: panel.team,
            p_variable_type: form.variable_type,
            p_date_to_test: form.date_to_test,
            p_apply_funnel: form.apply_funnel || null,
            p_apply_ad_account: form.apply_ad_account || null,
            p_apply_ad_campaign: form.apply_ad_campaign || null,
            p_apply_ad_set: form.apply_ad_set || null,
            p_apply_editor: form.apply_editor || null,
            p_apply_script_type: form.apply_script_type || null,
            p_ends_at: form.ends_at || null,
            p_assigned_to: form.assigned_to || null,
            p_hypothesis: form.hypothesis || null,
            p_notes: form.notes || null,
            p_submitted_by: person?.full_name ?? null,
        });

        setSubmitting(false);
        if (rpcErr) {
            setError(rpcErr.message);
            return;
        }
        const r = data as { variant_name: string; assigned_to: string | null };
        setResult({ variant_name: r.variant_name, assigned_to: r.assigned_to });
    };

    if (result) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="text-center max-w-md">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h2 className="text-lg font-semibold mt-3">Test queued: {result.variant_name}</h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        {result.assigned_to
                            ? `Routed to ${result.assigned_to} — they'll be notified to action it. Leads landing during the test window get tagged with this variant automatically.`
                            : "Leads landing during the test window get tagged with this variant automatically."}
                    </p>
                    <button
                        onClick={() => setResult(null)}
                        className="mt-4 text-sm font-medium text-zinc-700 underline hover:no-underline"
                    >
                        Submit another test
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <h1 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5" /> Submit a Test
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
                Pick your team, what you're testing, and where it applies. The system names the variant, opens a test
                window so leads get tagged, and routes it to the responsible person.
            </p>

            {/* Team panel tabs */}
            <div className="mt-4 flex flex-wrap gap-2">
                {PANELS.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => switchPanel(p.key)}
                        className={`px-3 py-1.5 rounded text-sm font-medium border ${
                            activePanel === p.key
                                ? "bg-zinc-900 text-white border-zinc-900"
                                : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <Field label="What are you testing?" hint="The variable you want to change and measure">
                    <select required value={form.variable_type} onChange={(e) => set("variable_type", e.target.value)} className={inputClass}>
                        <option value="">Select a variable</option>
                        {panel.variables.map((v) => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                    </select>
                </Field>

                {/* Apply-to fields per panel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {panel.applyFields.includes("funnel") && (
                        <Field label="Which funnel?">
                            <select value={form.apply_funnel} onChange={(e) => set("apply_funnel", e.target.value)} className={inputClass}>
                                <option value="">Select funnel</option>
                                {FUNNELS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </Field>
                    )}
                    {panel.applyFields.includes("ad_account") && (
                        <Field label="Ad account"><input value={form.apply_ad_account} onChange={(e) => set("apply_ad_account", e.target.value)} className={inputClass} placeholder="Account name/id" /></Field>
                    )}
                    {panel.applyFields.includes("ad_campaign") && (
                        <Field label="Campaign"><input value={form.apply_ad_campaign} onChange={(e) => set("apply_ad_campaign", e.target.value)} className={inputClass} /></Field>
                    )}
                    {panel.applyFields.includes("ad_set") && (
                        <Field label="Ad set"><input value={form.apply_ad_set} onChange={(e) => set("apply_ad_set", e.target.value)} className={inputClass} /></Field>
                    )}
                    {panel.applyFields.includes("editor") && (
                        <Field label="Editor"><input value={form.apply_editor} onChange={(e) => set("apply_editor", e.target.value)} className={inputClass} /></Field>
                    )}
                    {panel.applyFields.includes("script_type") && (
                        <Field label="Where it applies" hint="e.g. which script/SOP"><input value={form.apply_script_type} onChange={(e) => set("apply_script_type", e.target.value)} className={inputClass} /></Field>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Start date"><input required type="date" value={form.date_to_test} onChange={(e) => set("date_to_test", e.target.value)} className={inputClass} /></Field>
                    <Field label="End date" hint="Optional — leave blank for open-ended"><input type="date" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} className={inputClass} /></Field>
                </div>

                <Field label="Assign to" hint="Who's responsible for running this test">
                    <input
                        list={`assignees-${panel.key}`}
                        value={form.assigned_to}
                        onChange={(e) => set("assigned_to", e.target.value)}
                        className={inputClass}
                        placeholder="Responsible person"
                    />
                    <datalist id={`assignees-${panel.key}`}>
                        {panel.assignees.map((a) => <option key={a} value={a} />)}
                    </datalist>
                </Field>

                <Field label="Hypothesis" hint="What you expect to happen and why">
                    <textarea value={form.hypothesis} onChange={(e) => set("hypothesis", e.target.value)} rows={2} className={inputClass} />
                </Field>

                <Field label="Notes" hint="Optional context">
                    <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={inputClass} />
                </Field>

                {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

                <div className="flex justify-end pt-2 border-t border-zinc-200">
                    <button type="submit" disabled={submitting} className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60">
                        {submitting ? "Submitting..." : "Submit test"}
                    </button>
                </div>
            </form>
        </div>
    );
}
