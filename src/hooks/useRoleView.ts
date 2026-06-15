import { useEffect, useState } from "react";
import { fromEngine } from "@/lib/supabase";

export function useRoleView<T = Record<string, unknown>>(viewName: string) {
    const [data, setData] = useState<T[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, error } = await fromEngine(viewName).select("*");
            if (cancelled) return;
            if (error) {
                // Keep the real error for debugging, but the UI shows a friendly message.
                console.error(`[useRoleView] ${viewName}:`, error.message);
                setError(error.message);
                setData(null);
            } else {
                setData(data as T[]);
                setError(null);
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [viewName]);

    return { data, loading, error };
}
