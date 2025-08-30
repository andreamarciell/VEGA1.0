import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentSession, createSeededUser } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
const Login = () => {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getCurrentSession();
        if (session) {
          // User is already logged in, redirect to dashboard
          navigate('/dashboard', {
            replace: true
          });
          return;
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [navigate]);

  // User should now exist in database - no need to create seeded user anymore

  const handleLoginSuccess = () => {
    toast({
      title: "Welcome to Toppery",
      description: "Redirecting to your dashboard..."
    });

    // Small delay for better UX
    setTimeout(() => {
      navigate('/dashboard', {
        replace: true
      });
    }, 1000);
  };
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-slate-600 dark:border-t-slate-400 rounded-full animate-spin"></div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Authenticating</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Please wait while we verify your session</p>
          </div>
        </div>
      </div>
    );
  }

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
                Toppery Platform
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed">
                Advanced AML Analytics & <br />
                Compliance Management
              </p>
            </div>
            
            <div className="space-y-4 text-slate-300">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span className="text-sm">Real-time transaction monitoring</span>
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
              Toppery Platform
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign in to your account
            </p>
          </div>
          
          <LoginForm onLoginSuccess={handleLoginSuccess} />
          
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