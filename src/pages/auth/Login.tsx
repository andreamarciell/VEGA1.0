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
          navigate('/dashboard', { replace: true });
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

  useEffect(() => {
    // Create seeded user on component mount (only if not exists)
    const initializeSeededUser = async () => {
      try {
        await createSeededUser();
      } catch (error) {
        // User might already exist, which is fine
        console.log('Seeded user creation skipped (may already exist)');
      }
    };

    initializeSeededUser();
  }, []);

  const handleLoginSuccess = () => {
    toast({
      title: "Access Granted",
      description: "Redirecting to secure dashboard...",
    });
    
    // Small delay for better UX
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 1000);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Secure Gateway
          </h1>
          <p className="text-muted-foreground">
            Advanced authentication system
          </p>
        </div>
        
        <LoginForm onLoginSuccess={handleLoginSuccess} />
        
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Demo Credentials:</p>
          <p className="font-mono bg-muted/50 px-2 py-1 rounded">
            Username: andrea | Password: topperyGiasai456!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;