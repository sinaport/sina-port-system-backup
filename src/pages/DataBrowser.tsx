import { useEffect, useMemo, useState } from "react";
import { Database, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LoadingState, EmptyState } from "@/components/LoadingState";

// Browsable data layer - the "better Airtable" view. Each tab is a Postgres
// view in the engine schema; rows are fetched paginated with client search.

interface TableDef {
    key: string;
    label: string;
    view: string;
    searchCols: string[]; // columns to match against the search box
}

const TABLES: TableDef[] = [
    { key: "leads", label: "Lead Journey", view: "v_data_lead_journey", searchCols: ["email", "funnel", "source"] },
    { key: "close", label: "Close Calls", view: "v_data_close_calls", searchCols: ["phone", "direction", "disposition", "rep"] },
    { key: "calendly", label: "Calendly Events", view: "v_data_calendly", searchCols: ["invitee_name", "invitee_email", "event"] },
    { key: "fathom", label: "Fathom Calls", view: "v_data_fathom", searchCols: ["title", "host_email"] },
    { key: "people", label: "People", view: "v_data_people", searchCols: ["full_name", "email", "department", "role"] },
    { key: "bottlenecks", label: "Bottlenecks", view: "v_data_bottlenecks", searchCols: ["bottleneck_title", "affected_metric", "owner", "status"] },
    { key: "winners", label: "Winners", view: "v_data_winners", searchCols: ["winner_title", "winning_metric", "owner", "status"] },
    { key: "tests", label: "Tests", view: "v_data_tests", searchCols: ["test_type", "affected_metric", "variables_to_test", "status_update"] },
];

const PAGE_SIZE = 50;

function formatVal(v: unknown): string {
    if (v === null || v === undefined) return "-";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        return new Date(v).toLocaleString();
    }
    if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
    return String(v);
}

export function DataBrowser() {
    const [active, setActive] = useState<string>("leads");
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState<number | null>(null);
    const [search, setSearch] = useState("");

    const tableDef = useMemo(() => TABLES.find((t) => t.key === active)!, [active]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        void supabase
            .schema("engine" as never)
            .from(tableDef.view)
            .select("*", { count: "exact" })
            .range(from, to)
            .then(({ data, count }) => {
                if (cancelled) return;
                setRows((data as Record<string, unknown>[]) ?? []);
                setTotal(count ?? null);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [tableDef, page]);

    const switchTable = (key: string) => {
        setActive(key);
        setPage(0);
        setSearch("");
        setRows([]);
    };

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const filtered = search.trim()
        ? rows.filter((r) =>
              tableDef.searchCols.some((c) => String(r[c] ?? "").toLowerCase().includes(search.toLowerCase()))
          )
        : rows;

    return (
        <div className="space-y-5">
            <header>
                <h1 className="text-2xl font-semibold text-zinc-900 flex items-center gap-2">
                    <Database className="w-5 h-5" /> Data
                </h1>
                <p className="text-sm text-zinc-500">Browse the underlying records, like a spreadsheet. Pulled live from your data layer.</p>
            </header>

            <div className="flex flex-wrap gap-2">
                {TABLES.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => switchTable(t.key)}
                        className={`px-3 py-1.5 rounded text-sm font-medium border ${
                            active === t.key
                                ? "bg-zinc-900 text-white border-zinc-900"
                                : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Search this page (${tableDef.searchCols.join(", ")})`}
                        className="w-full rounded border border-zinc-300 pl-9 pr-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
                    />
                </div>
                <div className="text-xs text-zinc-500 whitespace-nowrap">
                    {total !== null ? `${total.toLocaleString()} rows` : ""}
                </div>
            </div>

            {loading ? (
                <LoadingState />
            ) : rows.length === 0 ? (
                <EmptyState title="No data yet" description="Records will appear here as they flow in." />
            ) : (
                <div className="bg-white border border-zinc-200 rounded-md overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase tracking-wide">
                            <tr>
                                {columns.map((c) => (
                                    <th key={c} className="px-3 py-2 text-left whitespace-nowrap">{c.replace(/_/g, " ")}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r, i) => (
                                <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                                    {columns.map((c) => (
                                        <td key={c} className="px-3 py-2 text-zinc-700 max-w-xs truncate">{formatVal(r[c])}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {total !== null && total > PAGE_SIZE && (
                <div className="flex items-center justify-between text-sm">
                    <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-3 py-1.5 rounded border border-zinc-300 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-zinc-500">
                        Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
                    </span>
                    <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={(page + 1) * PAGE_SIZE >= total}
                        className="px-3 py-1.5 rounded border border-zinc-300 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
