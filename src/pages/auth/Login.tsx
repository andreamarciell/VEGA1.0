import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, SignIn, useOrganizationList } from "@clerk/clerk-react";
import { toast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isLoaded: isOrgLoaded, organizationList } = useOrganizationList();

  // Mostra messaggio se reindirizzati per sessione scaduta (auto-logout 3h)
  useEffect(() => {
    const state = location.state as { sessionExpired?: boolean; message?: string } | null;
    if (state?.sessionExpired) {
      toast({
        title: "Sessione scaduta",
        description: state.message ?? "Sessione scaduta per sicurezza.",
        variant: "destructive",
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Check authentication and organization status
  useEffect(() => {
    if (!isLoaded || !isOrgLoaded) {
      return;
    }

    if (isSignedIn && userId) {
      // Check if user has an organization
      if (!organizationList || organizationList.length === 0) {
        // User is signed in but has no organization
        toast({
          title: "Accesso negato",
          description: "Devi essere membro di un'organizzazione per accedere all'applicazione.",
          variant: "destructive",
        });
        return;
      }

      // User has organization, redirect to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [isLoaded, isOrgLoaded, isSignedIn, userId, organizationList, navigate]);

  // If already signed in with organization, redirect
  if (isLoaded && isOrgLoaded && isSignedIn && userId && organizationList && organizationList.length > 0) {
    return null; // Will redirect via useEffect
  }

  const handleSignInSuccess = () => {
    toast({
      title: "Welcome to Vega",
      description: "Redirecting to your dashboard...",
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px]"></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">
                Vega Platform
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed">
                Advanced AML Analytics
              </p>
            </div>
            
            <div className="space-y-4 text-slate-300">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span className="text-sm">Transaction monitoring</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span className="text-sm">Intelligent risk assessment</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span className="text-sm">Comprehensive reporting tools</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Header */}
          <div className="lg:hidden text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Vega Platform
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign in to your account
            </p>
          </div>
          
          {!isLoaded ? (
            <div className="text-center space-y-6">
              <div className="relative mx-auto w-12 h-12">
                <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
                <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-slate-600 dark:border-t-slate-400 rounded-full animate-spin"></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Loading...</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Please wait while we initialize</p>
              </div>
            </div>
          ) : (
            <SignIn 
              routing="virtual"
              fallbackRedirectUrl="/dashboard"
              forceRedirectUrl="/dashboard"
              afterSignIn={handleSignInSuccess}
            />
          )}
          
          {/* Footer */}
          <div className="text-center space-y-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Protected by enterprise-grade security
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
