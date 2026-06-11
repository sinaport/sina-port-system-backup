import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
    variant: "gm3" | "gptby";
}

const TITLE: Record<Props["variant"], string> = {
    gm3: "Brand Audit - GM 3.0",
    gptby: "Brand Audit - GPTBY Sprint",
};

const TABLE: Record<Props["variant"], string> = {
    gm3: "brand_audit_gm3_submissions",
    gptby: "brand_audit_gptby_submissions",
};

const REVENUE_RANGES = [
    "Pre-revenue",
    "$0-$1k/mo",
    "$1k-$5k/mo",
    "$5k-$10k/mo",
    "$10k-$25k/mo",
    "$25k-$50k/mo",
    "$50k-$100k/mo",
    "$100k+/mo",
];

const BLOCKS = [
    "Audience growth / visibility",
    "Lead generation",
    "Sales conversion",
    "Pricing / offer clarity",
    "Content / messaging",
    "Operations / delivery",
    "Team / hiring",
    "Mindset / confidence",
];

const MINDFULNESS_OPTIONS = [
    "Daily meditation",
    "Weekly journaling",
    "Breathwork practice",
    "No structured practice",
    "Other",
];

const SOCIAL_STRUGGLES = [
    "Don't post enough",
    "Don't know what to post",
    "Engagement is low",
    "Burnout from posting",
    "Comparison anxiety",
    "No struggles",
];

export function BrandAuditForm({ variant }: Props) {
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<Record<string, string | number | boolean | null>>({
        full_name: "",
        email: "",
        instagram_handle: "",
        business_name: "",
        business_website: "",
        phone: "",
        business_stage: "",
        monthly_revenue_range: "",
        business_niche: "",
        target_audience: "",
        primary_offer: "",
        offer_price: "",
        primary_marketing_channel: "",
        monthly_marketing_spend: "",
        past_clients_source: "",
        biggest_block: "",
        what_didnt_work: "",
        sixty_day_goal: "",
        one_year_vision: "",
        why_now: "",
        mindfulness_practice: "",
        social_media_struggles: "",
        timezone: "",
        weekly_hours_available: "",
        investment_readiness: "",
        decision_maker: false,
        how_did_you_hear: "",
    });

    const set = (key: string, value: string | number | boolean | null) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const payload = {
            ...form,
            offer_price: form.offer_price ? parseFloat(form.offer_price as string) : null,
            monthly_marketing_spend: form.monthly_marketing_spend
                ? parseFloat(form.monthly_marketing_spend as string)
                : null,
            weekly_hours_available: form.weekly_hours_available
                ? parseInt(form.weekly_hours_available as string)
                : null,
            user_agent: navigator.userAgent,
            referer: document.referrer || null,
        };

        const { error } = await supabase.schema("forms" as never).from(TABLE[variant]).insert(payload);
        setSubmitting(false);
        if (error) setError(error.message);
        else setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
                <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8 max-w-md text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h1 className="text-xl font-semibold mt-4">Got it!</h1>
                    <p className="text-sm text-zinc-500 mt-2">
                        Your audit form is in. We'll review and follow up about the next step within 24-48 hours.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 py-10 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
                <h1 className="text-2xl font-semibold text-zinc-900">{TITLE[variant]}</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Quick context so we can show up prepared on our call. Takes about 8-10 minutes.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-8">
                    <Section title="Who you are">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Full name" required>
                                <input required value={form.full_name as string} onChange={(e) => set("full_name", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="Email" required>
                                <input required type="email" value={form.email as string} onChange={(e) => set("email", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="Instagram handle">
                                <input value={form.instagram_handle as string} onChange={(e) => set("instagram_handle", e.target.value)} className="form-input" placeholder="@yourhandle" />
                            </Field>
                            <Field label="Phone (optional)">
                                <input type="tel" value={form.phone as string} onChange={(e) => set("phone", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="Business name">
                                <input value={form.business_name as string} onChange={(e) => set("business_name", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="Website">
                                <input type="url" value={form.business_website as string} onChange={(e) => set("business_website", e.target.value)} className="form-input" placeholder="https://..." />
                            </Field>
                        </div>
                    </Section>

                    <Section title="Your business today">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Business stage">
                                <select value={form.business_stage as string} onChange={(e) => set("business_stage", e.target.value)} className="form-input">
                                    <option value="">— Select —</option>
                                    <option>Idea stage</option>
                                    <option>Validating</option>
                                    <option>Scaling</option>
                                    <option>Established</option>
                                </select>
                            </Field>
                            <Field label="Monthly revenue range">
                                <select value={form.monthly_revenue_range as string} onChange={(e) => set("monthly_revenue_range", e.target.value)} className="form-input">
                                    <option value="">— Select —</option>
                                    {REVENUE_RANGES.map((r) => <option key={r}>{r}</option>)}
                                </select>
                            </Field>
                            <Field label="Niche / industry">
                                <input value={form.business_niche as string} onChange={(e) => set("business_niche", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="Target audience">
                                <input value={form.target_audience as string} onChange={(e) => set("target_audience", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="Primary offer">
                                <input value={form.primary_offer as string} onChange={(e) => set("primary_offer", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="Offer price (USD)">
                                <input type="number" step="0.01" value={form.offer_price as string} onChange={(e) => set("offer_price", e.target.value)} className="form-input" />
                            </Field>
                        </div>
                    </Section>

                    <Section title="Marketing">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Primary marketing channel">
                                <input value={form.primary_marketing_channel as string} onChange={(e) => set("primary_marketing_channel", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="Monthly marketing spend (USD)">
                                <input type="number" step="0.01" value={form.monthly_marketing_spend as string} onChange={(e) => set("monthly_marketing_spend", e.target.value)} className="form-input" />
                            </Field>
                            <Field label="How are past clients finding you?" className="sm:col-span-2">
                                <input value={form.past_clients_source as string} onChange={(e) => set("past_clients_source", e.target.value)} className="form-input" placeholder="Referrals, IG content, paid ads..." />
                            </Field>
                        </div>
                    </Section>

                    <Section title="Where you're stuck">
                        <Field label="Biggest block right now">
                            <select value={form.biggest_block as string} onChange={(e) => set("biggest_block", e.target.value)} className="form-input">
                                <option value="">— Select —</option>
                                {BLOCKS.map((b) => <option key={b}>{b}</option>)}
                            </select>
                        </Field>
                        <Field label="What have you tried that didn't work?">
                            <textarea rows={3} value={form.what_didnt_work as string} onChange={(e) => set("what_didnt_work", e.target.value)} className="form-input" />
                        </Field>
                    </Section>

                    <Section title="Where you're going">
                        <Field label="60-day goal">
                            <textarea rows={2} value={form.sixty_day_goal as string} onChange={(e) => set("sixty_day_goal", e.target.value)} className="form-input" />
                        </Field>
                        <Field label="1-year vision">
                            <textarea rows={2} value={form.one_year_vision as string} onChange={(e) => set("one_year_vision", e.target.value)} className="form-input" />
                        </Field>
                        <Field label="Why now?">
                            <textarea rows={2} value={form.why_now as string} onChange={(e) => set("why_now", e.target.value)} className="form-input" />
                        </Field>
                    </Section>

                    <Section title="You as the operator">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Mindfulness practice">
                                <select value={form.mindfulness_practice as string} onChange={(e) => set("mindfulness_practice", e.target.value)} className="form-input">
                                    <option value="">— Select —</option>
                                    {MINDFULNESS_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                                </select>
                            </Field>
                            <Field label="Social media struggles">
                                <select value={form.social_media_struggles as string} onChange={(e) => set("social_media_struggles", e.target.value)} className="form-input">
                                    <option value="">— Select —</option>
                                    {SOCIAL_STRUGGLES.map((s) => <option key={s}>{s}</option>)}
                                </select>
                            </Field>
                            <Field label="Timezone">
                                <input value={form.timezone as string} onChange={(e) => set("timezone", e.target.value)} className="form-input" placeholder="e.g. PST, EST" />
                            </Field>
                            <Field label="Hours per week available">
                                <input type="number" min="0" value={form.weekly_hours_available as string} onChange={(e) => set("weekly_hours_available", e.target.value)} className="form-input" />
                            </Field>
                        </div>
                    </Section>

                    <Section title="Ready to invest?">
                        <Field label="Investment readiness">
                            <select value={form.investment_readiness as string} onChange={(e) => set("investment_readiness", e.target.value)} className="form-input">
                                <option value="">— Select —</option>
                                <option>Yes, I'm ready to invest in the next 30 days</option>
                                <option>Maybe, depends on the fit</option>
                                <option>Not sure yet</option>
                                <option>Just exploring</option>
                            </select>
                        </Field>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={form.decision_maker as boolean} onChange={(e) => set("decision_maker", e.target.checked)} className="mt-1" />
                            <span className="text-sm text-zinc-700">I'm the final decision-maker for this purchase</span>
                        </label>
                        <Field label="How did you hear about us?">
                            <input value={form.how_did_you_hear as string} onChange={(e) => set("how_did_you_hear", e.target.value)} className="form-input" />
                        </Field>
                    </Section>

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
                        {submitting ? "Submitting..." : "Submit"}
                    </button>
                </form>
            </div>

            <style>{`
                .form-input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d4d4d8; border-radius: 0.375rem; font-size: 0.875rem; background: white; }
            `}</style>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <fieldset>
            <legend className="text-base font-semibold text-zinc-900 mb-3">{title}</legend>
            <div className="space-y-4">{children}</div>
        </fieldset>
    );
}

function Field({
    label,
    required,
    hint,
    className,
    children,
}: {
    label: string;
    required?: boolean;
    hint?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={className}>
            <label className="block text-sm font-medium text-zinc-700">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
            <div className="mt-1">{children}</div>
        </div>
    );
}
