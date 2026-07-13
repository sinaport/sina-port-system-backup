import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { LoadingState } from "@/components/LoadingState";
import { SignIn } from "@/pages/SignIn";
import { SetterDashboard } from "@/pages/SetterDashboard";
import { CloserDashboard } from "@/pages/CloserDashboard";
import { SuccessManagerDashboard } from "@/pages/SuccessManagerDashboard";
import { EaDashboard } from "@/pages/EaDashboard";
import { KpiDictionary } from "@/pages/KpiDictionary";
import { WinsForm } from "@/pages/WinsForm";
import { BrandAuditForm } from "@/pages/BrandAuditForm";
import { RegistrySubmit } from "@/pages/RegistrySubmit";
import { TestingForm } from "@/pages/TestingForm";
import { DataBrowser } from "@/pages/DataBrowser";
import { TeamRegistry } from "@/pages/TeamRegistry";
import { InputForm } from "@/pages/InputForm";
import { Account } from "@/pages/Account";
import { MediaBuyingDashboard } from "@/pages/MediaBuyingDashboard";
import { TestIntelligence } from "@/pages/TestIntelligence";

function DefaultRedirect() {
    const { person, loading, user } = useAuth();
    if (loading) return <LoadingState />;
    if (!user) return <Navigate to="/signin" replace />;
    if (!person) {
        // Logged in but no PEOPLE_MASTER match: lock them out gracefully.
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="text-center max-w-md">
                    <div className="text-base font-semibold">Access not provisioned</div>
                    <p className="text-sm text-zinc-500 mt-1">
                        Your email isn't linked to an active team member. Ask your admin to add you to PEOPLE_MASTER.
                    </p>
                </div>
            </div>
        );
    }
    return <Navigate to={homePath(person.department)} replace />;
}

// Each department's landing route. Marketing has no dashboard yet -> tests.
function homePath(department?: string | null): string {
    switch (department) {
        case "Admin": return "/ea";
        case "Closer": return "/closer";
        case "Setter": return "/setter";
        case "Delivery": return "/sm";
        default: return "/testing"; // Marketing / others
    }
}

function ProtectedRoutes() {
    const { user, loading } = useAuth();
    if (loading) return <LoadingState />;
    if (!user) return <Navigate to="/signin" replace />;
    return (
        <Layout />
    );
}

// Route-level role gate: Admin sees everything; others only routes their department allows.
// Anything outside scope redirects to their own landing (so URL-hopping can't reach it).
function Gate({ allow }: { allow: string[] }) {
    const { person, loading, user } = useAuth();
    if (loading) return <LoadingState />;
    if (!user) return <Navigate to="/signin" replace />;
    const dept = person?.department;
    if (dept === "Admin" || (dept && allow.includes(dept))) return <Outlet />;
    return <Navigate to={homePath(dept)} replace />;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public customer-facing forms (no auth) */}
                    <Route path="/wins" element={<WinsForm />} />
                    <Route path="/audit/gm3" element={<BrandAuditForm variant="gm3" />} />
                    <Route path="/audit/gptby" element={<BrandAuditForm variant="gptby" />} />

                    {/* Auth */}
                    <Route path="/signin" element={<SignIn />} />

                    {/* Authenticated team area */}
                    <Route path="/" element={<DefaultRedirect />} />
                    <Route element={<ProtectedRoutes />}>
                        {/* Role-scoped dashboards (Admin sees all) */}
                        <Route element={<Gate allow={["Setter"]} />}>
                            <Route path="/setter" element={<SetterDashboard />} />
                        </Route>
                        <Route element={<Gate allow={["Closer"]} />}>
                            <Route path="/closer" element={<CloserDashboard />} />
                        </Route>
                        <Route element={<Gate allow={["Delivery"]} />}>
                            <Route path="/sm" element={<SuccessManagerDashboard />} />
                        </Route>
                        {/* Admin-only: master ops, data browser, KPI editor, team registry */}
                        <Route element={<Gate allow={["Admin"]} />}>
                            <Route path="/media-buying" element={<MediaBuyingDashboard />} />
                            <Route path="/intelligence" element={<TestIntelligence />} />
                            <Route path="/ea" element={<EaDashboard />} />
                            <Route path="/kpis" element={<KpiDictionary />} />
                            <Route path="/data" element={<DataBrowser />} />
                            <Route path="/team/new" element={<TeamRegistry />} />
                            <Route path="/inputs/metric" element={<InputForm kind="metric" />} />
                            <Route path="/inputs/variables" element={<InputForm kind="variables" />} />
                            <Route path="/inputs/program" element={<InputForm kind="program" />} />
                            <Route path="/inputs/link" element={<InputForm kind="link" />} />
                            <Route path="/inputs/sop" element={<InputForm kind="sop" />} />
                            <Route path="/inputs/script" element={<InputForm kind="script" />} />
                        </Route>
                        {/* Common - any authenticated team member */}
                        <Route path="/log/bottleneck" element={<RegistrySubmit kind="bottleneck" />} />
                        <Route path="/log/winner" element={<RegistrySubmit kind="winner" />} />
                        <Route path="/log/test-input" element={<RegistrySubmit kind="test_input" />} />
                        <Route path="/testing" element={<TestingForm />} />
                        <Route path="/account" element={<Account />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
