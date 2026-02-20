import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Protect } from "@clerk/clerk-react";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import ExtensionLogin from "./pages/auth/ExtensionLogin";
import Dashboard from "./pages/dashboard/Dashboard";
import WorkInProgress from "./pages/WorkInProgress";
import AmlDashboard from "./pages/aml/AmlDashboard";
import AmlLivePlayersList from "./pages/aml/AmlLivePlayersList";
import AmlLivePlayerDetail from "./pages/aml/AmlLivePlayerDetail";
import ReviewGenerator from "./pages/review/ReviewGenerator";
import AdminControl from "./pages/admin/AdminControl";
import ChromeExtensions from "./pages/ChromeExtensions";
import TopperyImageLanding from "./pages/extensions/TopperyImageLanding";
import TopTextLanding from "./pages/extensions/TopTextLanding";
import TopTextAILanding from "./pages/extensions/TopTextAILanding";
import TopperyIPLanding from "./pages/extensions/TopperyIPLanding";
import Presentation from "./pages/Presentation";
import PresentationSlides from "./pages/PresentationSlides";
import { TestLockoutSystem } from "./components/auth/TestLockoutSystem";
import TextWizard from "./pages/tools/TextWizard";
import { useTenantFeatures } from "./hooks/useTenantFeatures";

const queryClient = new QueryClient();

const TextWizardRoute = () => {
  const { features, loading } = useTenantFeatures();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!features?.text_wizard) {
    return <Navigate to="/dashboard" replace />;
  }
  return <TextWizard />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth/login" replace />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/extension-login" element={<ExtensionLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vega" element={<AmlDashboard />} />
          <Route path="/vega-live" element={<AmlLivePlayersList />} />
          <Route path="/vega-live/:accountId" element={<AmlLivePlayerDetail />} />
          <Route path="/review" element={<ReviewGenerator />} />
          <Route path="/work-in-progress" element={<WorkInProgress />} />
          <Route path="/control" element={
            <Protect role="org:admin" fallback={<Navigate to="/dashboard" />}>
              <AdminControl />
            </Protect>
          } />
          <Route path="/extensions" element={<ChromeExtensions />} />
          <Route path="/extensions/toppery-image" element={<TopperyImageLanding />} />
          <Route path="/extensions/toptext" element={<TopTextLanding />} />
          <Route path="/extensions/toptext-ai" element={<TopTextAILanding />} />
          <Route path="/extensions/toppery-ip" element={<TopperyIPLanding />} />
          <Route path="/presentation" element={<Presentation />} />
          <Route path="/presentation/slides" element={<PresentationSlides />} />
          <Route path="/text-wizard" element={<TextWizardRoute />} />
          <Route path="/test-lockout" element={<TestLockoutSystem />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;