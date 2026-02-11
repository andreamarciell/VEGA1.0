import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth, SignIn } from "@clerk/clerk-react";
import { useEffect } from "react";
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

  if (MASTER_ADMIN_ID) {
    if (userId !== MASTER_ADMIN_ID) {
      console.log('⚠️ SuperAdminRoute: User is not master admin, redirecting to login');
      console.log('   Expected:', MASTER_ADMIN_ID, 'Got:', userId);
      return <Navigate to="/login" replace />;
    }
  } else {
    console.warn('⚠️ VITE_MASTER_ADMIN_ID not configured - allowing any authenticated user');
  }

  console.log('✅ SuperAdminRoute: Access granted');
  return <SuperAdminDashboard />;
};

const LoginPage = () => {
  const { isLoaded, userId, isSignedIn, sessionId } = useAuth();
  const navigate = useNavigate();
  
  // Debug logging
  console.log('🔐 LoginPage - isLoaded:', isLoaded, 'userId:', userId, 'isSignedIn:', isSignedIn, 'sessionId:', sessionId);
  
  // Monitor authentication state changes and redirect when signed in
  useEffect(() => {
    if (isLoaded && isSignedIn && userId) {
      console.log('✅ LoginPage: User signed in detected, redirecting to super-admin');
      console.log('   userId:', userId);
      navigate('/super-admin', { replace: true });
    }
  }, [isLoaded, isSignedIn, userId, navigate]);
  
  // If already signed in, redirect to super-admin
  if (isLoaded && isSignedIn && userId) {
    console.log('✅ LoginPage: User already signed in, redirecting to super-admin');
    return <Navigate to="/super-admin" replace />;
  }
  
  if (isLoaded && !isSignedIn) {
    console.log('ℹ️ LoginPage: User not signed in - showing SignIn component');
  }
  
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
          {isLoaded && !isSignedIn && (
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">
              ⚠️ Not authenticated - Please sign in below
            </p>
          )}
        </div>
        {!isLoaded ? (
          <div className="text-center">
            <p>Loading Clerk...</p>
          </div>
        ) : (
          <SignIn 
            routing="path" 
            path="/login"
            signUpUrl="/login"
            fallbackRedirectUrl="/super-admin"
            forceRedirectUrl="/super-admin"
            afterSignIn={() => {
              console.log('✅ SignIn afterSignIn callback: User signed in successfully');
              // Force navigation after a short delay to ensure state is updated
              setTimeout(() => {
                console.log('🔄 SignIn: Navigating to /super-admin');
                navigate('/super-admin', { replace: true });
              }, 500);
            }}
            afterSignUp={() => {
              console.log('✅ SignUp afterSignUp callback: User signed up successfully');
              setTimeout(() => {
                console.log('🔄 SignUp: Navigating to /super-admin');
                navigate('/super-admin', { replace: true });
              }, 500);
            }}
          />
        )}
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
