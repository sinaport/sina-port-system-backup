import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase, fromDictionary } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type RegistryKind = "bottleneck" | "winner" | "test_input";

interface Props {
    kind: RegistryKind;
}

const TITLES: Record<RegistryKind, string> = {
    bottleneck: "Log a Bottleneck",
    winner: "Log a Winner",
    test_input: "Queue a Test Input",
};

const SUBTITLES: Record<RegistryKind, string> = {
    bottleneck: "Flag a metric that's below KPI so the team can investigate and prioritize a test.",
    winner: "Flag a metric that's above KPI so the team can amplify the pattern.",
    test_input: "Queue a test to run against a bottleneck or amplify a winner.",
};

const TABLES: Record<RegistryKind, string> = {
    bottleneck: "bottleneck",
    winner: "winners",
    test_input: "test_inputs",
};

const ID_PREFIX: Record<RegistryKind, string> = {
    bottleneck: "B-",
    winner: "W-",
    test_input: "T-",
};

const ECONOMIC_FLOWS = [
    "Content",
    "Funnel",
    "Resource",
    "Inbound",
    "Outbound",
    "Webinar",
    "Closing Call",
    "Ascension",
];

const STATUS_OPTIONS = ["Active", "Investigating", "Testing", "Resolved", "On Hold"];
const FREQUENCY_OPTIONS = ["One-off", "Recurring weekly", "Recurring monthly", "Ongoing"];

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
    );
}

const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

export function RegistrySubmit({ kind }: Props) {
    const { person } = useAuth();
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

    // KPI names from the dictionary power the metric pickers (datalist = pick or type).
    const [kpiNames, setKpiNames] = useState<string[]>([]);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data } = await fromDictionary("kpi").select("kpi_name").order("kpi_name");
            if (cancelled || !data) return;
            const names = Array.from(new Set((data as { kpi_name: string }[]).map((r) => r.kpi_name).filter(Boolean)));
            setKpiNames(names);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const [form, setForm] = useState<Record<string, string>>(() => ({
        // Common
        economic_engine_flow: "",
        economic_engine_id: "",
        status: "Active",
        owner: "",
        // Bottleneck / Winner specific
        bottleneck_title: "",
        winner_title: "",
        affected_metric: "",
        winning_metric: "",
        pattern: "",
        pct_below_kpi: "",
        pct_above_kpi: "",
        diagnosis: "",
        hypothesis: "",
        impact_score: "",
        speed_score: "",
        frequency: "",
        // Test input specific
        test_type: "",
        test_origin: "",
        bottleneck_id: "",
        winner_id: "",
        affected_winning_metric: "",
        pct_vs_kpi_baseline: "",
        date_to_test: "",
        variables_to_test: "",
        testing_format: "",
        status_update: "Queued",
    }));

    // Default owner to current user's first name on mount
    useEffect(() => {
        if (person?.full_name && !form.owner) {
            setForm((f) => ({ ...f, owner: person.full_name.split(" ")[0] }));
        }
    }, [person, form.owner]);

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const buildPayload = (): Record<string, string | null> => {
        const idField = kind === "test_input" ? "test_id" : kind === "winner" ? "winner_id" : "bottleneck_id";
        const id = `${ID_PREFIX[kind]}${Date.now().toString().slice(-6)}`;

        const common = {
            [idField]: id,
            economic_engine_flow: form.economic_engine_flow || null,
            economic_engine_id: form.economic_engine_id || null,
            status: form.status || null,
            owner: form.owner || null,
        };

        if (kind === "bottleneck") {
            return {
                ...common,
                date_created: today,
                bottleneck_title: form.bottleneck_title || null,
                affected_metric: form.affected_metric || null,
                pattern: form.pattern || null,
                pct_below_kpi: form.pct_below_kpi || null,
                diagnosis: form.diagnosis || null,
                hypothesis: form.hypothesis || null,
                impact_score: form.impact_score || null,
                speed_score: form.speed_score || null,
                frequency: form.frequency || null,
            };
        }
        if (kind === "winner") {
            return {
                ...common,
                date_created: today,
                winner_title: form.winner_title || null,
                winning_metric: form.winning_metric || null,
                pattern: form.pattern || null,
                pct_above_kpi: form.pct_above_kpi || null,
                diagnosis: form.diagnosis || null,
                hypothesis: form.hypothesis || null,
                impact_score: form.impact_score || null,
                speed_score: form.speed_score || null,
                frequency: form.frequency || null,
            };
        }
        // test_input
        return {
            [idField]: id,
            economic_engine_flow: form.economic_engine_flow || null,
            test_type: form.test_type || null,
            test_origin: form.test_origin || null,
            bottleneck_id: form.bottleneck_id || null,
            winner_id: form.winner_id || null,
            affected_winning_metric: form.affected_winning_metric || null,
            pct_vs_kpi_baseline: form.pct_vs_kpi_baseline || null,
            date_to_test: form.date_to_test || null,
            variables_to_test: form.variables_to_test || null,
            testing_format: form.testing_format || null,
            status_update: form.status_update || "Queued",
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const payload = buildPayload();
        const { error: dbErr } = await supabase
            .schema("registry" as never)
            .from(TABLES[kind])
            .insert(payload);

        setSubmitting(false);
        if (dbErr) {
            // Keep the real error for debugging; show the user a friendly message.
            console.error("[RegistrySubmit] insert failed:", dbErr.message);
            setError("Couldn't save this just now. Check your entries and try again, and if it keeps happening let us know.");
            return;
        }
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="text-center max-w-md">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h2 className="text-lg font-semibold mt-3">Logged</h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        Slack notification fired to the team. You can submit another or head back to your dashboard.
                    </p>
                    <button
                        onClick={() => {
                            setSubmitted(false);
                            setError(null);
                        }}
                        className="mt-4 text-sm font-medium text-zinc-700 underline hover:no-underline"
                    >
                        Submit another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <h1 className="text-xl font-semibold text-zinc-900">{TITLES[kind]}</h1>
            <p className="mt-1 text-sm text-zinc-500">{SUBTITLES[kind]}</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <datalist id="kpi-list">
                    {kpiNames.map((n) => (
                        <option key={n} value={n} />
                    ))}
                </datalist>
                <p className="text-xs text-zinc-500">
                    A unique record ID is generated automatically when you submit.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Economic engine flow" required>
                        <select
                            required
                            value={form.economic_engine_flow}
                            onChange={(e) => set("economic_engine_flow", e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Select flow</option>
                            {ECONOMIC_FLOWS.map((f) => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Engine ID" hint="e.g. CON-001 / FUN-003">
                        <input
                            value={form.economic_engine_id}
                            onChange={(e) => set("economic_engine_id", e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                </div>

                {kind !== "test_input" && (
                    <>
                        <Field label={kind === "bottleneck" ? "Bottleneck title" : "Winner title"} required>
                            <input
                                required
                                value={kind === "bottleneck" ? form.bottleneck_title : form.winner_title}
                                onChange={(e) => set(kind === "bottleneck" ? "bottleneck_title" : "winner_title", e.target.value)}
                                className={inputClass}
                                placeholder={kind === "bottleneck" ? "What's blocked or below target" : "What's working above target"}
                            />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={kind === "bottleneck" ? "Affected metric" : "Winning metric"} required hint="Pick from your KPI list or type a new one">
                                <input
                                    required
                                    list="kpi-list"
                                    value={kind === "bottleneck" ? form.affected_metric : form.winning_metric}
                                    onChange={(e) => set(kind === "bottleneck" ? "affected_metric" : "winning_metric", e.target.value)}
                                    className={inputClass}
                                    placeholder="e.g. Show Rate, Close Rate, CAC"
                                />
                            </Field>
                            <Field label={kind === "bottleneck" ? "% below KPI" : "% above KPI"}>
                                <input
                                    value={kind === "bottleneck" ? form.pct_below_kpi : form.pct_above_kpi}
                                    onChange={(e) => set(kind === "bottleneck" ? "pct_below_kpi" : "pct_above_kpi", e.target.value)}
                                    className={inputClass}
                                    placeholder="e.g. 15%"
                                />
                            </Field>
                        </div>

                        <Field label="Pattern" hint="What's the recurring observation that triggered this">
                            <textarea
                                value={form.pattern}
                                onChange={(e) => set("pattern", e.target.value)}
                                rows={2}
                                className={inputClass}
                            />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Diagnosis" hint="Why is it happening (root cause hypothesis)">
                                <textarea
                                    value={form.diagnosis}
                                    onChange={(e) => set("diagnosis", e.target.value)}
                                    rows={3}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Hypothesis" hint="What you think will move the metric">
                                <textarea
                                    value={form.hypothesis}
                                    onChange={(e) => set("hypothesis", e.target.value)}
                                    rows={3}
                                    className={inputClass}
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label="Impact score" hint="1-10">
                                <input
                                    value={form.impact_score}
                                    onChange={(e) => set("impact_score", e.target.value)}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Speed score" hint="1-10">
                                <input
                                    value={form.speed_score}
                                    onChange={(e) => set("speed_score", e.target.value)}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Frequency">
                                <select
                                    value={form.frequency}
                                    onChange={(e) => set("frequency", e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">Select</option>
                                    {FREQUENCY_OPTIONS.map((f) => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                    </>
                )}

                {kind === "test_input" && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Test type" required hint="e.g. A/B, multivariate, qualitative">
                                <input
                                    required
                                    value={form.test_type}
                                    onChange={(e) => set("test_type", e.target.value)}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Test origin" hint="From bottleneck / from winner / strategic">
                                <select
                                    value={form.test_origin}
                                    onChange={(e) => set("test_origin", e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">Select origin</option>
                                    <option value="From bottleneck">From bottleneck</option>
                                    <option value="From winner">From winner</option>
                                    <option value="Strategic">Strategic</option>
                                </select>
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Linked bottleneck ID" hint="If origin = from bottleneck">
                                <input
                                    value={form.bottleneck_id}
                                    onChange={(e) => set("bottleneck_id", e.target.value)}
                                    className={inputClass}
                                    placeholder="B-XXXXXX"
                                />
                            </Field>
                            <Field label="Linked winner ID" hint="If origin = from winner">
                                <input
                                    value={form.winner_id}
                                    onChange={(e) => set("winner_id", e.target.value)}
                                    className={inputClass}
                                    placeholder="W-XXXXXX"
                                />
                            </Field>
                        </div>

                        <Field label="Affected winning metric" required hint="Pick from your KPI list or type a new one">
                            <input
                                required
                                list="kpi-list"
                                value={form.affected_winning_metric}
                                onChange={(e) => set("affected_winning_metric", e.target.value)}
                                className={inputClass}
                            />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="% vs KPI baseline">
                                <input
                                    value={form.pct_vs_kpi_baseline}
                                    onChange={(e) => set("pct_vs_kpi_baseline", e.target.value)}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Date to test" required>
                                <input
                                    required
                                    type="date"
                                    value={form.date_to_test}
                                    onChange={(e) => set("date_to_test", e.target.value)}
                                    className={inputClass}
                                />
                            </Field>
                        </div>

                        <Field label="Variables to test" required hint="What you're changing">
                            <textarea
                                required
                                value={form.variables_to_test}
                                onChange={(e) => set("variables_to_test", e.target.value)}
                                rows={3}
                                className={inputClass}
                            />
                        </Field>

                        <Field label="Testing format" hint="e.g. paid ads, landing page, email sequence">
                            <input
                                value={form.testing_format}
                                onChange={(e) => set("testing_format", e.target.value)}
                                className={inputClass}
                            />
                        </Field>
                    </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Owner">
                        <input
                            value={form.owner}
                            onChange={(e) => set("owner", e.target.value)}
                            className={inputClass}
                            placeholder="Defaulted from your account"
                        />
                    </Field>
                    <Field label="Status">
                        <select
                            value={kind === "test_input" ? form.status_update : form.status}
                            onChange={(e) => set(kind === "test_input" ? "status_update" : "status", e.target.value)}
                            className={inputClass}
                        >
                            {(kind === "test_input"
                                ? ["Queued", "Running", "Paused", "Done", "Inconclusive"]
                                : STATUS_OPTIONS
                            ).map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </Field>
                </div>

                {error && (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-200">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
                    >
                        {submitting ? "Logging..." : "Submit"}
                    </button>
                </div>
            </form>
        </div>
    );
}
