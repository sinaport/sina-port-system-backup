import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
    switch (person.department) {
        case "Admin":
            return <Navigate to="/ea" replace />;
        case "Closer":
            return <Navigate to="/closer" replace />;
        case "Setter":
            return <Navigate to="/setter" replace />;
        case "Delivery":
            return <Navigate to="/sm" replace />;
        default:
            return <Navigate to="/ea" replace />;
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
                        <Route path="/setter" element={<SetterDashboard />} />
                        <Route path="/closer" element={<CloserDashboard />} />
                        <Route path="/sm" element={<SuccessManagerDashboard />} />
                        <Route path="/ea" element={<EaDashboard />} />
                        <Route path="/kpis" element={<KpiDictionary />} />
                        <Route path="/log/bottleneck" element={<RegistrySubmit kind="bottleneck" />} />
                        <Route path="/log/winner" element={<RegistrySubmit kind="winner" />} />
                        <Route path="/log/test-input" element={<RegistrySubmit kind="test_input" />} />
                        <Route path="/testing" element={<TestingForm />} />
                        <Route path="/data" element={<DataBrowser />} />
                        <Route path="/team/new" element={<TeamRegistry />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
