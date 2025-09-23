import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/dashboard/Dashboard";
import WorkInProgress from "./pages/WorkInProgress";
import AmlDashboard from "./pages/aml/AmlDashboard";
import ReviewGenerator from "./pages/review/ReviewGenerator";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminControl from "./pages/admin/AdminControl";
import ForgotPassword from "./pages/auth/ForgotPassword";
import UpdatePassword from "./pages/auth/UpdatePassword";
import ChromeExtensions from "./pages/ChromeExtensions";
import TopperyImageLanding from "./pages/extensions/TopperyImageLanding";
import TopTextLanding from "./pages/extensions/TopTextLanding";
import TopTextAILanding from "./pages/extensions/TopTextAILanding";
import TopperyIPLanding from "./pages/extensions/TopperyIPLanding";
import Presentation from "./pages/Presentation";
import { TestLockoutSystem } from "./components/auth/TestLockoutSystem";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth/login" replace />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/forgot" element={<ForgotPassword />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/toppery-aml" element={<AmlDashboard />} />
          <Route path="/review" element={<ReviewGenerator />} />
          <Route path="/work-in-progress" element={<WorkInProgress />} />
          <Route path="/control-login" element={<AdminLogin />} />
          <Route path="/control" element={<AdminControl />} />
          <Route path="/extensions" element={<ChromeExtensions />} />
          <Route path="/extensions/toppery-image" element={<TopperyImageLanding />} />
          <Route path="/extensions/toptext" element={<TopTextLanding />} />
          <Route path="/extensions/toptext-ai" element={<TopTextAILanding />} />
          <Route path="/extensions/toppery-ip" element={<TopperyIPLanding />} />
          <Route path="/presentation" element={<Presentation />} />
          <Route path="/test-lockout" element={<TestLockoutSystem />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;