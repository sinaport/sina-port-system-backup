import { Link, Outlet, useLocation } from "react-router-dom";
import { LogOut, LayoutDashboard, GaugeCircle, AlertCircle, Trophy, FlaskConical, Users, PhoneCall, GraduationCap, Beaker, Database, UserPlus, UserCog, Plus, FileText, Link2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard };
type NavSection = { heading?: string; items: NavItem[] };

const ACCOUNT: NavItem = { label: "Account", to: "/account", icon: UserCog };
const LOGGING: NavItem[] = [
    { label: "Log bottleneck", to: "/log/bottleneck", icon: AlertCircle },
    { label: "Log winner", to: "/log/winner", icon: Trophy },
];

// "Input Forms" section (Khryzl feedback #5): team + test + the 7 new capture forms.
const ADMIN_INPUT_FORMS: NavItem[] = [
    { label: "Add team member", to: "/team/new", icon: UserPlus },
    { label: "Submit a test", to: "/testing", icon: Beaker },
    { label: "New Metric", to: "/inputs/metric", icon: Plus },
    { label: "New KPI", to: "/inputs/kpi", icon: GaugeCircle },
    { label: "New Variable", to: "/inputs/variables", icon: FlaskConical },
    { label: "New Program", to: "/inputs/program", icon: FileText },
    { label: "New Link", to: "/inputs/link", icon: Link2 },
    { label: "New SOP", to: "/inputs/sop", icon: FileText },
    { label: "New Script", to: "/inputs/script", icon: FileText },
];

// Non-admin roles: only Submit a test in Input Forms.
const ROLE_INPUT_FORMS: NavItem[] = [{ label: "Submit a test", to: "/testing", icon: Beaker }];

function roleSections(dashboardLabel: string, to: string): NavSection[] {
    return [
        { items: [{ label: dashboardLabel, to, icon: LayoutDashboard }] },
        { heading: "Input Forms", items: ROLE_INPUT_FORMS },
        { heading: "Logging", items: LOGGING },
        { items: [ACCOUNT] },
    ];
}

const NAV_BY_DEPARTMENT: Record<string, NavSection[]> = {
    Admin: [
        { items: [{ label: "Operations overview", to: "/ea", icon: LayoutDashboard }] },
        { heading: "Dashboards", items: [
            { label: "Setter view", to: "/setter", icon: Users },
            { label: "Closer view", to: "/closer", icon: PhoneCall },
            { label: "Success Manager view", to: "/sm", icon: GraduationCap },
        ] },
        { heading: "Data", items: [
            { label: "Data", to: "/data", icon: Database },
            { label: "KPI Dictionary", to: "/kpis", icon: GaugeCircle },
        ] },
        { heading: "Input Forms", items: ADMIN_INPUT_FORMS },
        { heading: "Logging", items: LOGGING },
        { items: [ACCOUNT] },
    ],
    Setter: roleSections("Today", "/setter"),
    Closer: roleSections("Today", "/closer"),
    Delivery: roleSections("Today", "/sm"),
    Marketing: [
        { heading: "Input Forms", items: ROLE_INPUT_FORMS },
        { heading: "Logging", items: LOGGING },
        { items: [ACCOUNT] },
    ],
};

export function Layout() {
    const { person, signOut, user } = useAuth();
    const location = useLocation();
    const sections = NAV_BY_DEPARTMENT[person?.department ?? ""] ?? [];

    return (
        <div className="min-h-screen flex">
            <aside className="w-60 bg-zinc-900 text-zinc-100 flex flex-col">
                <div className="px-6 py-5 border-b border-zinc-800">
                    <div className="text-sm font-semibold tracking-tight">Sina Port</div>
                    <div className="text-xs text-zinc-400 truncate">{person?.full_name ?? user?.email}</div>
                    <div className="text-xs text-zinc-500">{person?.role ?? ""}</div>
                </div>
                <nav className="px-3 py-3 space-y-1 overflow-y-auto flex-1">
                    {sections.map((section, i) => (
                        <div key={i} className={section.heading ? "pt-3" : ""}>
                            {section.heading && (
                                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                    {section.heading}
                                </div>
                            )}
                            {section.items.map((item) => {
                                const Icon = item.icon;
                                const active = location.pathname === item.to;
                                return (
                                    <Link
                                        key={item.to + item.label}
                                        to={item.to}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                            active ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                    <button
                        onClick={() => void signOut()}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 mt-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign out
                    </button>
                </nav>
            </aside>
            <main className="flex-1 p-8 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
