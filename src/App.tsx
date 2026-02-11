import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, SignIn } from "@clerk/clerk-react";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";

const queryClient = new QueryClient();
const MASTER_ADMIN_ID = import.meta.env.VITE_MASTER_ADMIN_ID;

const SuperAdminRoute = () => {
  const { isLoaded, userId } = useAuth();

  // Debug logging
  console.log('🔐 SuperAdminRoute - isLoaded:', isLoaded, 'userId:', userId, 'MASTER_ADMIN_ID:', MASTER_ADMIN_ID);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!userId) {
    console.log('⚠️ SuperAdminRoute: No userId, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (MASTER_ADMIN_ID && userId !== MASTER_ADMIN_ID) {
    console.log('⚠️ SuperAdminRoute: User is not master admin, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ SuperAdminRoute: Access granted');
  return <SuperAdminDashboard />;
};

const LoginPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Super Admin Login
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Sign in to access the tenant onboarding dashboard
          </p>
        </div>
        <SignIn 
          routing="path" 
          path="/login"
          signUpUrl="/login"
          afterSignInUrl="/super-admin"
        />
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/super-admin" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/super-admin" element={<SuperAdminRoute />} />
          <Route path="*" element={<Navigate to="/super-admin" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
