import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/PasswordInput";
import { checkAdminSession } from "@/lib/adminAuth";
import { toast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";
import { CSRFTokenInput, useCSRFProtection } from "@/lib/csrfProtection";

const AdminLogin = () => {
  const [credentials, setCredentials] = useState({ nickname: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  
  // CSRF Protection
  const { ensureCSRFToken } = useCSRFProtection();

  useEffect(() => {
    const checkSession = async () => {
      // Check if admin is already logged in (would require server-side session check)
      // For now, just proceed to login form
      console.log('Admin login page loaded');
    };

    checkSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!credentials.nickname || !credentials.password) {
      setError("Please enter both nickname and password");
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔍 Starting server-side admin login...');
      console.log('Credentials:', { nickname: credentials.nickname, password: credentials.password ? '***' : 'MISSING' });
      
      const response = await fetch('/.netlify/functions/adminLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for cookies
        body: JSON.stringify({ 
          nickname: credentials.nickname, 
          password: credentials.password 
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Login Failed');
        console.log('❌ Server login error:', response.status, errorText);
        setError(errorText || 'Login Failed');
        toast({
          title: "Login Failed",
          description: errorText || 'Invalid credentials',
          variant: "destructive",
        });
      } else {
        console.log('✅ Server login successful');
        toast({
          title: "Welcome Admin",
          description: "Successfully logged in to admin panel",
        });
        console.log('🚀 Navigating to /control...');
        // Cookie is automatically set by server, redirect to admin area
        window.location.assign('/control');
      }
    } catch (err) {
      const errorMsg = "An unexpected error occurred";
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Admin Control Panel
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Secure administrative access to the platform
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300 p-4 text-sm">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
              <div className="space-y-1">
                <p className="font-medium">Authentication Failed</p>
                <p className="text-xs opacity-90">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CSRF Protection */}
          <CSRFTokenInput />
          
          <div className="space-y-4">
            {/* Nickname Field */}
            <div className="space-y-2">
              <Label 
                htmlFor="nickname" 
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Admin Nickname
              </Label>
              <Input
                id="nickname"
                type="text"
                value={credentials.nickname}
                onChange={(e) => setCredentials(prev => ({ ...prev, nickname: e.target.value }))}
                placeholder="Enter your admin nickname"
                disabled={isLoading}
                className={`
                  h-11 border-slate-200 dark:border-slate-700 
                  focus:border-slate-400 focus:ring-slate-400 dark:focus:border-slate-500 dark:focus:ring-slate-500
                  placeholder:text-slate-400 dark:placeholder:text-slate-500
                  bg-white dark:bg-slate-900
                  ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-400' : ''}
                `}
                autoComplete="username"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label 
                htmlFor="password" 
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </Label>
              <PasswordInput
                value={credentials.password}
                onChange={(value) => setCredentials(prev => ({ ...prev, password: value }))}
                placeholder="Enter your admin password"
                disabled={isLoading}
                error={!!error}
                className={`
                  h-11 border-slate-200 dark:border-slate-700 
                  focus:border-slate-400 focus:ring-slate-400 dark:focus:border-slate-500 dark:focus:ring-slate-500
                  placeholder:text-slate-400 dark:placeholder:text-slate-500
                  bg-white dark:bg-slate-900
                  ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-400' : ''}
                `}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full h-11 text-sm font-medium transition-all duration-200 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Access Control Panel</span>
              </div>
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Administrative access only
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This area is restricted to authorized administrators
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;