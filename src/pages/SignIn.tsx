import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function SignIn() {
    const { signInWithOtp } = useAuth();
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const result = await signInWithOtp(email);
        setLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            setSubmitted(true);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
                <h1 className="text-xl font-semibold text-zinc-900">Sina Port</h1>
                <p className="mt-1 text-sm text-zinc-500">Sign in with your work email.</p>

                {submitted ? (
                    <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
                        Check your inbox at <span className="font-medium">{email}</span> for a magic link.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                                Work email
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                                placeholder="you@brandwithsina.com"
                            />
                        </div>
                        {error && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-zinc-900 text-white text-sm font-medium py-2 rounded-md hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {loading ? "Sending..." : "Send magic link"}
                        </button>
                    </form>
                )}
                <p className="mt-4 text-xs text-zinc-400">
                    Access is restricted to active team members in PEOPLE_MASTER.
                </p>
            </div>
        </div>
    );
}
