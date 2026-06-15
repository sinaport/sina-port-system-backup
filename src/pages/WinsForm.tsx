import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function WinsForm() {
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        full_name: "",
        email: "",
        program: "",
        win_type: "",
        win_description: "",
        revenue_amount: "",
        timeframe: "",
        proof_url: "",
        can_we_share: false,
        notes: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const payload = {
            ...form,
            revenue_amount: form.revenue_amount ? parseFloat(form.revenue_amount) : null,
            user_agent: navigator.userAgent,
            referer: document.referrer || null,
        };

        const { error } = await supabase.schema("forms" as never).from("wins_submissions").insert(payload);
        setSubmitting(false);
        if (error) {
            setError(error.message);
        } else {
            setSubmitted(true);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
                <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8 max-w-md text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h1 className="text-xl font-semibold mt-4">Win received!</h1>
                    <p className="text-sm text-zinc-500 mt-2">
                        Your team will see this in their dashboard shortly. Thank you for sharing.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 py-10 px-4">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
                <h1 className="text-2xl font-semibold text-zinc-900">Share your win</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Tell us what's working. Your team uses this to spot patterns and double down.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Your name" required>
                            <input
                                required
                                value={form.full_name}
                                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                className="form-input"
                            />
                        </Field>
                        <Field label="Email" required>
                            <input
                                required
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="form-input"
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Program">
                            <select
                                value={form.program}
                                onChange={(e) => setForm({ ...form, program: e.target.value })}
                                className="form-input"
                            >
                                <option value="">- Select -</option>
                                <option>Brand with Sina</option>
                                <option>GPTBY Sprint</option>
                                <option>Brand Audit GM3.0</option>
                                <option>Other</option>
                            </select>
                        </Field>
                        <Field label="Win type">
                            <select
                                value={form.win_type}
                                onChange={(e) => setForm({ ...form, win_type: e.target.value })}
                                className="form-input"
                            >
                                <option value="">- Select -</option>
                                <option>Revenue</option>
                                <option>New clients</option>
                                <option>Process improvement</option>
                                <option>Mindset</option>
                                <option>Other</option>
                            </select>
                        </Field>
                    </div>

                    <Field label="What's the win?" required hint="A sentence or two is enough.">
                        <textarea
                            required
                            rows={3}
                            value={form.win_description}
                            onChange={(e) => setForm({ ...form, win_description: e.target.value })}
                            className="form-input"
                        />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Revenue amount" hint="If applicable">
                            <input
                                type="number"
                                step="0.01"
                                value={form.revenue_amount}
                                onChange={(e) => setForm({ ...form, revenue_amount: e.target.value })}
                                className="form-input"
                            />
                        </Field>
                        <Field label="Timeframe">
                            <select
                                value={form.timeframe}
                                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                                className="form-input"
                            >
                                <option value="">- Select -</option>
                                <option>Today</option>
                                <option>This week</option>
                                <option>Last 30 days</option>
                                <option>This quarter</option>
                            </select>
                        </Field>
                    </div>

                    <Field label="Proof URL" hint="Screenshot, receipt, or link if you have one">
                        <input
                            type="url"
                            value={form.proof_url}
                            onChange={(e) => setForm({ ...form, proof_url: e.target.value })}
                            className="form-input"
                            placeholder="https://..."
                        />
                    </Field>

                    <Field label="Anything else?">
                        <textarea
                            rows={2}
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            className="form-input"
                        />
                    </Field>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.can_we_share}
                            onChange={(e) => setForm({ ...form, can_we_share: e.target.checked })}
                            className="mt-1"
                        />
                        <span className="text-sm text-zinc-700">
                            You can share my win as a testimonial (anonymized if I ask)
                        </span>
                    </label>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-zinc-900 text-white text-sm font-medium py-3 rounded-md hover:bg-zinc-800 disabled:opacity-50"
                    >
                        {submitting ? "Sending..." : "Submit win"}
                    </button>
                </form>
            </div>

            <style>{`.form-input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d4d4d8; border-radius: 0.375rem; font-size: 0.875rem; background: white; }`}</style>
        </div>
    );
}

function Field({
    label,
    required,
    hint,
    children,
}: {
    label: string;
    required?: boolean;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-zinc-700">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
            <div className="mt-1">{children}</div>
        </div>
    );
}
