import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "../PasswordInput";
import { SecurityIcon } from "../SecurityIcon";
import { loginWithCredentials, LoginCredentials } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { securityLogger } from "@/lib/securityLogger";
import { useAccountLockout } from "@/hooks/useAccountLockout";
import { LockoutTimer } from "./LockoutTimer";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

// Input validation and sanitization utilities
const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

const validateCredentials = (credentials: LoginCredentials): { isValid: boolean; error: string | null } => {
  const { username, password } = credentials;
  
  // Basic validation - only check for empty fields
  if (!username || !username.trim()) {
    return { isValid: false, error: "Username is required" };
  }
  
  if (!password || !password.trim()) {
    return { isValid: false, error: "Password is required" };
  }
  
  return { isValid: true, error: null };
};

export const LoginForm = ({
  onLoginSuccess
}: LoginFormProps) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [showLockoutScreen, setShowLockoutScreen] = useState(false);
  const [localFailedAttempts, setLocalFailedAttempts] = useState(0);

  // Use the account lockout hook
  const { lockoutStatus, checkLockoutStatus, resetLockout, clearLockoutState } = useAccountLockout();

  // Check lockout status when username changes and reset local attempts
  useEffect(() => {
    if (credentials.username.trim() && credentials.username !== currentUsername) {
      setCurrentUsername(credentials.username);
      setLocalFailedAttempts(0); // Reset local attempts for new username
      setError(null); // Clear any previous errors
      setShowLockoutScreen(false); // Reset lockout screen state
      
      // Check if this username is already locked
      checkLockoutStatus(credentials.username);
    }
  }, [credentials.username, currentUsername, checkLockoutStatus]);

  // Show lockout screen if account is locked
  useEffect(() => {
    if (lockoutStatus.isLocked && credentials.username.trim() === currentUsername && currentUsername !== "") {
      setShowLockoutScreen(true);
    }
  }, [lockoutStatus.isLocked, credentials.username, currentUsername]);

  // Handle lockout expiration (only when timer expires)
  const handleLockoutExpired = () => {
    // Clear the lockout state from the hook to stop any timers
    clearLockoutState();
    
    // Clear all local state
    setShowLockoutScreen(false);
    setError(null);
    setLocalFailedAttempts(0);
    setCredentials({ username: "", password: "" });
    setCurrentUsername("");
    
    toast({
      title: "Account Unlocked",
      description: "Your account has been unlocked. You can now attempt to log in again.",
      variant: "default",
      duration: 5000
    });
  };

  // Handle manual return to login (without unlocking account)
  const handleReturnToLogin = () => {
    // Clear the lockout state from the hook first to stop any running timers
    clearLockoutState();
    
    // Clear the lockout screen state
    setShowLockoutScreen(false);
    
    // Reset form state completely
    setCredentials({ username: "", password: "" });
    setCurrentUsername("");
    setError(null);
    setLocalFailedAttempts(0);
    
    toast({
      title: "Returned to Login", 
      description: "You can now try with a different account. The previous account remains locked.",
      variant: "default",
      duration: 3000
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Input validation
    const validation = validateCredentials(credentials);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }
    
    // Sanitize inputs
    const sanitizedCredentials = {
      username: sanitizeInput(credentials.username),
      password: credentials.password // Don't sanitize password as it may contain special chars
    };
    
    // Always check lockout status for the username being submitted
    // If it's the same as the currently tracked username and is locked, show lockout screen
    if (sanitizedCredentials.username === currentUsername && lockoutStatus.isLocked) {
      setShowLockoutScreen(true);
      toast({
        title: "Account Still Locked",
        description: "This account is still locked. Please wait for the timer to expire.",
        variant: "destructive"
      });
      return;
    }
    
    // If it's a different username that hasn't been checked yet, wait for the check to complete
    if (sanitizedCredentials.username !== currentUsername) {
      // The useEffect will handle the username change and lockout check
      // For now, let the login proceed - the server will also validate lockout status
      console.log('Attempting login with different username:', sanitizedCredentials.username);
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Log login attempt using centralized security logger
      securityLogger.logLoginAttempt(sanitizedCredentials.username, false, {
        ipAddress: 'client-side', // In production, get from server
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
      
      const result = await loginWithCredentials(sanitizedCredentials);
      
      if (result.error) {
        // Check if the error includes lockout information
        if ('lockoutInfo' in result && result.lockoutInfo) {
          // Account is now locked - show lockout screen
          await checkLockoutStatus(sanitizedCredentials.username);
          setShowLockoutScreen(true);
          
          toast({
            title: "Account Locked",
            description: result.lockoutInfo.message,
            variant: "destructive"
          });
          
          return;
        }
        
        // Log failed attempt
        securityLogger.logLoginAttempt(sanitizedCredentials.username, false, {
          error: result.error,
          ipAddress: 'client-side',
          userAgent: navigator.userAgent
        });
        
        // Check if account is now locked after this failed attempt
        await checkLockoutStatus(sanitizedCredentials.username);
        
        // If account is now locked, show lockout screen
        if (lockoutStatus.isLocked && sanitizedCredentials.username === currentUsername) {
          setShowLockoutScreen(true);
          return;
        }
        
        // Fallback: If database RPC failed and we need to track locally
        if (sanitizedCredentials.username === currentUsername && lockoutStatus.failedAttempts === 0) {
          // Only increment local attempts if database count is not available
          const newAttempts = localFailedAttempts + 1;
          setLocalFailedAttempts(newAttempts);
          
          // Show warning after multiple local attempts
          if (newAttempts >= 2) {
            toast({
              title: "Warning",
              description: "Multiple failed attempts detected. Account may be temporarily locked.",
              variant: "destructive"
            });
            
            // After 3 local attempts, show lockout screen
            if (newAttempts >= 3) {
              setShowLockoutScreen(true);
              return;
            }
          }
        }
        
        // Generic error message to avoid information disclosure
        setError("Invalid username or password");
      } else {
        // Reset lockout on successful login
        await resetLockout(sanitizedCredentials.username);
        setLocalFailedAttempts(0);
        
        // Log successful login
        securityLogger.logLoginAttempt(sanitizedCredentials.username, true, {
          ipAddress: 'client-side',
          userAgent: navigator.userAgent,
          userId: result.user?.id
        });
        
        toast({
          title: "Login Successful",
          description: "Welcome back! Redirecting to dashboard...",
          variant: "default"
        });
        onLoginSuccess();
      }
    } catch (error) {
      console.error("Login error:", error);
      
      // Increment local failed attempts on error only for current username and only if database tracking is not working
      if (sanitizedCredentials.username === currentUsername && lockoutStatus.failedAttempts === 0) {
        const newAttempts = localFailedAttempts + 1;
        setLocalFailedAttempts(newAttempts);
      }
      
      // Log unexpected error
      securityLogger.error('Login error - unexpected', {
        username: sanitizedCredentials.username,
        error: error.message,
        stack: error.stack
      }, {
        ipAddress: 'client-side',
        userAgent: navigator.userAgent
      });
      
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // If account is locked, show lockout timer (either from database or local fallback)
  if (showLockoutScreen) {
    return (
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Account Locked
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your account has been temporarily locked for security reasons
          </p>
        </div>

        {/* Lockout Timer */}
        <LockoutTimer
          remainingSeconds={lockoutStatus.remainingSeconds > 0 ? lockoutStatus.remainingSeconds : 0}
          failedAttempts={lockoutStatus.failedAttempts || localFailedAttempts}
          onExpired={handleLockoutExpired}
        />

        {/* Return to Login Button */}
        <div className="text-center">
          <Button
            variant="outline"
            onClick={handleReturnToLogin}
            className="w-full"
          >
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  // Calculate total failed attempts (prefer database count, fallback to local) for current username only
  const totalFailedAttempts = credentials.username.trim() === currentUsername ? 
    (lockoutStatus.failedAttempts > 0 ? lockoutStatus.failedAttempts : localFailedAttempts) : 0;
  const isHighAttempts = totalFailedAttempts >= 2;
  
  return (
    <div className="w-full max-w-md space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Welcome back
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Enter your credentials to access your account
        </p>
      </div>

      {/* Security Warning for High Attempts - only show for current username */}
      {isHighAttempts && totalFailedAttempts < 3 && credentials.username.trim() === currentUsername && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-start space-x-2">
            <SecurityIcon 
              type="shield" 
              className="w-4 h-4 mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" 
            />
            <div className="space-y-1">
              <p className="font-medium text-amber-700 dark:text-amber-300">
                Security Warning
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 opacity-90">
                {totalFailedAttempts === 2 
                  ? "Multiple failed login attempts detected. Account will be locked after 3 failed attempts."
                  : `Account will be locked after ${3 - totalFailedAttempts} more failed attempt${3 - totalFailedAttempts === 1 ? '' : 's'}.`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className={`
          rounded-lg border p-4 text-sm
          ${isHighAttempts 
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300' 
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
          }
        `}>
          <div className="flex items-start space-x-2">
            <SecurityIcon 
              type="lock" 
              className={`
                w-4 h-4 mt-0.5 shrink-0
                ${isHighAttempts ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}
              `} 
            />
            <div className="space-y-1">
              <p className="font-medium">
                {isHighAttempts ? 'Account Security Alert' : 'Authentication Error'}
              </p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          {/* Username Field */}
          <div className="space-y-2">
            <Label 
              htmlFor="username" 
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Username
            </Label>
            <Input 
              id="username" 
              type="text" 
              value={credentials.username} 
              onChange={e => setCredentials(prev => ({
                ...prev,
                username: e.target.value
              }))} 
              placeholder="Enter your username" 
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
              onChange={value => setCredentials(prev => ({
                ...prev,
                password: value
              }))} 
              placeholder="Enter your password" 
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your password to access your account
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          type="submit" 
          className="w-full h-11 text-sm font-medium transition-all duration-200 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span>Sign in to your account</span>
              <div className="w-4 h-4 ml-1">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                </svg>
              </div>
            </div>
          )}
        </Button>
      </form>

      {/* Footer Links */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <Link 
          to="/auth/forgot" 
          className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          Forgot password?
        </Link>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
          <span className="text-xs text-slate-500 dark:text-slate-400">Secure connection</span>
        </div>
      </div>

      {/* Attempt Counter for debugging - only show for current username */}
      {totalFailedAttempts > 0 && credentials.username.trim() === currentUsername && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {totalFailedAttempts} failed attempt{totalFailedAttempts === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};