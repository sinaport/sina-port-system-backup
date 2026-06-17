import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { fromEngine } from "@/lib/supabase";

// Team-member registry (per Khryzl's request): add new team members via a form,
// instead of editing the data directly. Inserts into engine.people_master.

const DEPARTMENTS = ["Setter", "Closer", "Delivery", "Admin", "Marketing"];
const ROLES = [
    "Setter", "Closer", "Success Manager", "EA", "QA", "CEO",
    "Media Buyer", "Content Manager", "Email Marketer", "Marketing Lead",
];
const DEPT_PREFIX: Record<string, string> = {
    Setter: "SET", Closer: "CLO", Delivery: "SM", Admin: "ADM", Marketing: "MKT",
};

const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
        </div>
    );
}

export function TeamRegistry() {
    const [form, setForm] = useState({ full_name: "", email: "", department: "", role: "", employment_type: "Full time" });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        const prefix = DEPT_PREFIX[form.department] ?? "TM";
        const person_id = `${prefix}-${Date.now().toString().slice(-4)}`;
        const { error: dbErr } = await fromEngine("people_master").insert({
            person_id,
            full_name: form.full_name || null,
            email: form.email || null,
            department: form.department || null,
            role: form.role || null,
            employment_type: form.employment_type || null,
            status: "Active",
        });
        setSubmitting(false);
        if (dbErr) {
            console.error("[TeamRegistry] insert failed:", dbErr.message);
            setError("Couldn't add this team member. Check the entries (email must be unique) and try again.");
            return;
        }
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="text-center max-w-md">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h2 className="text-lg font-semibold mt-3">Team member added</h2>
                    <p className="text-sm text-zinc-500 mt-1">They'll now appear in the team and the test "Assign to" picker.</p>
                    <button
                        onClick={() => { setSubmitted(false); setForm({ full_name: "", email: "", department: "", role: "", employment_type: "Full time" }); }}
                        className="mt-4 text-sm font-medium text-zinc-700 underline hover:no-underline"
                    >
                        Add another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <h1 className="text-xl font-semibold text-zinc-900">Add a team member</h1>
            <p className="mt-1 text-sm text-zinc-500">New hires are recorded here, then flow into the team and test routing automatically.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Full name" required>
                        <input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Work email" required>
                        <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} placeholder="name@sinaport.com" />
                    </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Department" required>
                        <select required value={form.department} onChange={(e) => set("department", e.target.value)} className={inputClass}>
                            <option value="">Select department</option>
                            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </Field>
                    <Field label="Role" required>
                        <select required value={form.role} onChange={(e) => set("role", e.target.value)} className={inputClass}>
                            <option value="">Select role</option>
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </Field>
                </div>
                <Field label="Employment type">
                    <select value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)} className={inputClass}>
                        <option>Full time</option>
                        <option>Part time</option>
                        <option>Contractor</option>
                    </select>
                </Field>

                {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

                <div className="flex justify-end pt-2 border-t border-zinc-200">
                    <button type="submit" disabled={submitting} className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60">
                        {submitting ? "Adding..." : "Add team member"}
                    </button>
                </div>
            </form>
        </div>
    );
}
