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
    columnLabels?: Record<string, string>; // exact display labels per column key (overrides the underscore-to-space default)
}

// Lead Journey mirrors her FLOW sheet column-for-column, with her exact header text.
const LEAD_JOURNEY_LABELS: Record<string, string> = {
    flow: "Flow", lead_created_date: "Lead Created Date", lead_name: "Lead Name", lead_email: "Lead Email",
    country: "Country", phone_number: "Phone Number", funnel_id: "FUNNEL_ID", funnel: "Funnel",
    landing_page_copy: "Landing Page Copy", vsl: "VSL", opt_in_question: "Opt In Question", funnel_flow: "Funnel Flow",
    purchased_lto: "Purchased LTO", lto_programs: "LTO Programs", lto_value: "LTO Value", lead_grade: "Lead Grade",
    organic: "Organic", platform_id: "Platform_ID", account_id: "Account_ID", ads: "Ads", content_id: "Content_ID",
    ad_account: "Ad Account", ad_campaign: "Ad Campaign", ad_set: "Ad Set", ad_creative: "Ad Creative",
    ad_creative_script: "Ad Creative Script", angle: "Angle", hook: "Hook", meat: "Meat", cta: "CTA", editor: "Editor",
    utm_source_lead: "UTM_Source_Lead", utm_campaign_lead: "UTM_Campaign_Lead", utm_medium_lead: "UTM_Medium_Lead",
    resource_id: "Resource_ID", assigned_setter: "Assigned Setter", dials: "Dials", conversations: "Conversations",
    outbound: "Outbound", outbound_id: "Outbound_ID", outbound_script_used: "Outbound Script used",
    q_have_business: "Do you currently have a business?",
    q_biggest_goal: "What is your biggest business goal for the next 12 months?",
    q_describes_you: "Which one describes you best right now?",
    q_struggling_with: "What are you struggling with the most right now?",
    q_how_committed: "How committed are you to changing your business situation this year?",
    q_prepared_to_invest: "How much are you realistically prepared to invest into mentorship/business growth this year?",
    script_applied_setter_out: "Script Applied?", inbound: "Inbound", inbound_id: "Inbound_ID",
    inbound_script_used: "Inbound Script used", script_applied_setter_in: "Script Applied?", setter_sop: "Setter SOP",
    setter_sop_applied: "Setter SOP Applied?", call_grade: "Call Grade", objection_type_setter: "Objection Type",
    platform_id_in: "Platform_ID", account_id_in: "Account_ID", calendly_id: "Calendly_ID", source_id: "Source_ID",
    utm_source_inset: "UTM_Source_INSet", utm_campaign_inset: "UTM_Campaign_INSet", utm_medium_inset: "UTM_Medium_INSet",
    appointments: "Appointments", closing_calls_booked: "Closing Calls booked", assigned_closer: "Assigned Closer",
    show_up: "Show up", objection_type_closer: "Objection Type", closing_script_used: "Closing Script used",
    script_applied_closer: "Script Applied?", closer_sop: "Closer SOP", webinar_attended: "Webinar Attended",
    webinar_id: "Webinar_ID", webinar_used: "Webinar Used", webinar_script_used: "Webinar Script Used",
    closed_deal: "Closed Deal", program: "Program", objection_type_closed: "Objection Type",
    convert_reason: "Convert Reason", cac: "CAC", onboarded: "Onboarded", onboarded_date: "Onboarded Date",
    offboarded_date: "Offboarded Date", days_left: "Days Left", contract_signed: "Contract Signed",
    date_contract_signed: "Date Contract Signed", total_logins: "Total logins", last_login_date: "Last login date",
    activation_gap: "Activation Gap", kick_off_call_booked: "Kick off Call Booked", kick_off_call_date: "Kick off Call Date",
    kick_off_call_script_used: "Kick off Call Script Used", brand_audit_form_submitted: "Brand Audit Form Submitted",
    brand_audit_form_questionnaires: "Brand Audit Form questionnaires", onboarding_steps_completed: "Onboarding Steps Completed",
    first_win: "First win", momentum_call: "Momentum call", momentum_call_script_used: "Momentum Call Script Used",
    ascended: "Ascended", ascension_id: "Ascension_ID", objection_type_ascension: "Objection Type",
    ascension_reason: "Ascension Reason", micro_id: "Micro_ID", flow_id: "Flow_ID", system_id: "System_ID",
};

const TABLES: TableDef[] = [
    { key: "leads", label: "Lead Journey", view: "v_data_lead_journey", searchCols: ["lead_email", "lead_name", "funnel", "program"], columnLabels: LEAD_JOURNEY_LABELS },
    { key: "close", label: "Close Calls", view: "v_data_close_calls", searchCols: ["phone", "direction", "disposition", "rep"] },
    { key: "calendly", label: "Calendly Events", view: "v_data_calendly", searchCols: ["invitee_name", "invitee_email", "event"] },
    { key: "fathom", label: "Fathom Calls", view: "v_data_fathom", searchCols: ["title", "host_email"] },
    { key: "people", label: "People", view: "v_data_people", searchCols: ["full_name", "email", "department", "role"] },
    { key: "bottlenecks", label: "Bottlenecks", view: "v_data_bottlenecks", searchCols: ["bottleneck_title", "affected_metric", "owner", "status"] },
    { key: "winners", label: "Winners", view: "v_data_winners", searchCols: ["winner_title", "winning_metric", "owner", "status"] },
    { key: "tests", label: "Tests", view: "v_data_tests", searchCols: ["test_type", "affected_metric", "variables_to_test", "status_update"] },
    { key: "kpi_benchmark", label: "KPI Benchmark", view: "v_data_kpi_benchmark", searchCols: ["kpi_name", "department", "economic_engine_flow", "owner_role"] },
    { key: "ideas", label: "Ideas Generator", view: "v_data_ideas", searchCols: ["idea_id", "source", "kpi", "output", "economic_engine_flow"] },
    { key: "lib_pattern", label: "Library: Pattern", view: "v_data_lib_pattern", searchCols: ["id_lead", "status", "program", "lead_grade"] },
    { key: "lib_marketing", label: "Library: Marketing", view: "v_data_lib_marketing", searchCols: ["id_lead", "status", "hook", "angle"] },
    { key: "lib_setters", label: "Library: Setters", view: "v_data_lib_setters", searchCols: ["id_lead", "status"] },
    { key: "lib_closers", label: "Library: Closers", view: "v_data_lib_closers", searchCols: ["id_lead", "status", "program"] },
    { key: "lib_delivery", label: "Library: Delivery", view: "v_data_lib_delivery", searchCols: ["id_lead", "status"] },
    { key: "business_dictionary", label: "Business Dictionary", view: "v_data_business_dictionary", searchCols: ["section", "item", "detail"] },
    { key: "customer_avatar", label: "Customer Avatar", view: "v_data_customer_avatar", searchCols: ["attribute"] },
    { key: "cac_creative", label: "CAC by Creative", view: "v_cac_per_creative", searchCols: ["creative", "ad_id", "campaign", "ad_set"], columnLabels: {
        creative: "Ad Creative", ad_id: "Creative / Ad ID", ad_account: "Ads Account", ad_set: "Ad Set",
        campaign: "Campaign", meta_status: "Meta Status", spend_eur: "Amount Spent", hto_buyers: "Deals (HTO buyers)",
        cash_collected_eur: "Cash Collected", cac_eur: "CAC" } },
    { key: "input_forms", label: "Submitted Forms", view: "v_data_input_forms", searchCols: ["form_type", "title", "fields", "submitted_by"] },
];

const PAGE_SIZE = 50;

// Columns that hold EUR amounts get a euro symbol + thousands separators (R5 #4: match her sheet).
const CURRENCY_COL = /(_eur$|^spend$|^cac$|^cash|collected)/i;

function formatVal(v: unknown, col?: string): string {
    if (v === null || v === undefined) return "-";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (col && CURRENCY_COL.test(col)) {
        const n = Number(v);
        if (Number.isFinite(n)) return "€" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
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
        // Debounce so we don't query on every keystroke. Server-side search across ALL rows
        // (not just the current page) via a case-insensitive OR over the table's search columns.
        const handle = setTimeout(() => {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const term = search.trim();
            let query = supabase
                .schema("engine" as never)
                .from(tableDef.view)
                .select("*", { count: "exact" });
            if (term) {
                // Build a wildcard pattern that tolerates spaces (PostgREST .or() breaks on a literal
                // space in the value): "Doreen Herzog" -> *Doreen*Herzog*. Strip PostgREST delimiters.
                const words = term.replace(/[,()*%]/g, " ").split(/\s+/).filter(Boolean);
                const pat = "*" + words.join("*") + "*";
                query = query.or(tableDef.searchCols.map((c) => `${c}.ilike.${pat}`).join(","));
            }
            void query.range(from, to).then(({ data, count, error }) => {
                if (cancelled) return;
                if (error && term) {
                    // Search filter failed (e.g. a column mismatch) - fall back to an unfiltered page
                    // so the table still loads instead of breaking.
                    void supabase
                        .schema("engine" as never)
                        .from(tableDef.view)
                        .select("*", { count: "exact" })
                        .range(from, to)
                        .then((res) => {
                            if (cancelled) return;
                            setRows((res.data as Record<string, unknown>[]) ?? []);
                            setTotal(res.count ?? null);
                            setLoading(false);
                        });
                    return;
                }
                setRows((data as Record<string, unknown>[]) ?? []);
                setTotal(count ?? null);
                setLoading(false);
            });
        }, search.trim() ? 350 : 0);
        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [tableDef, page, search]);

    const switchTable = (key: string) => {
        setActive(key);
        setPage(0);
        setSearch("");
        setRows([]);
    };

    const onSearch = (v: string) => {
        setSearch(v);
        setPage(0); // a new search starts from page 1
    };

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const filtered = rows; // filtering now happens server-side

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
                        onChange={(e) => onSearch(e.target.value)}
                        placeholder={`Search all rows (${tableDef.searchCols.join(", ")})`}
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
                                    <th key={c} className="px-3 py-2 text-left whitespace-nowrap">{tableDef.columnLabels?.[c] ?? c.replace(/_/g, " ")}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r, i) => (
                                <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                                    {columns.map((c) => (
                                        <td key={c} className="px-3 py-2 text-zinc-700 max-w-xs truncate">{formatVal(r[c], c)}</td>
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
