import { useState } from "react";
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
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if account is locked
    if (isLocked && lockoutTime && Date.now() < lockoutTime) {
      const remainingTime = Math.ceil((lockoutTime - Date.now()) / 1000);
      setError(`Account locked. Try again in ${remainingTime} seconds.`);
      return;
    }
    
    // Reset lockout if time has passed
    if (isLocked && lockoutTime && Date.now() >= lockoutTime) {
      setIsLocked(false);
      setLockoutTime(null);
      setAttempts(0);
    }
    
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
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        // Log failed attempt
        securityLogger.logLoginAttempt(sanitizedCredentials.username, false, {
          attempts: newAttempts,
          error: result.error,
          ipAddress: 'client-side',
          userAgent: navigator.userAgent
        });
        
        // Progressive lockout: 3 attempts = 30 sec, 6 attempts = 5 min, 9+ attempts = 15 min
        if (newAttempts >= 9) {
          setIsLocked(true);
          setLockoutTime(Date.now() + 15 * 60 * 1000); // 15 minutes
          
          securityLogger.logAccountLockout(sanitizedCredentials.username, 'Too many failed attempts', 15 * 60 * 1000, {
            attempts: newAttempts,
            ipAddress: 'client-side',
            userAgent: navigator.userAgent
          });
          
          toast({
            title: "Account Locked",
            description: "Too many failed attempts. Account locked for 15 minutes.",
            variant: "destructive"
          });
        } else if (newAttempts >= 6) {
          setIsLocked(true);
          setLockoutTime(Date.now() + 5 * 60 * 1000); // 5 minutes
          
          securityLogger.logAccountLockout(sanitizedCredentials.username, 'Multiple failed attempts', 5 * 60 * 1000, {
            attempts: newAttempts,
            ipAddress: 'client-side',
            userAgent: navigator.userAgent
          });
          
          toast({
            title: "Account Temporarily Locked",
            description: "Multiple failed attempts. Account locked for 5 minutes.",
            variant: "destructive"
          });
        } else if (newAttempts >= 3) {
          setIsLocked(true);
          setLockoutTime(Date.now() + 30 * 1000); // 30 seconds
          
          securityLogger.logAccountLockout(sanitizedCredentials.username, 'Multiple failed attempts', 30 * 1000, {
            attempts: newAttempts,
            ipAddress: 'client-side',
            userAgent: navigator.userAgent
          });
          
          toast({
            title: "Account Temporarily Locked",
            description: "Multiple failed attempts. Account locked for 30 seconds.",
            variant: "destructive"
          });
        } else if (newAttempts >= 2) {
          toast({
            title: "Security Warning",
            description: "Multiple failed login attempts detected. Account will be locked after 3 failed attempts.",
            variant: "destructive"
          });
        }
        
        // Generic error message to avoid information disclosure
        setError("Invalid username or password");
      } else {
        // Reset attempts on successful login
        setAttempts(0);
        setIsLocked(false);
        setLockoutTime(null);
        
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

  const isHighAttempts = attempts >= 3;
  
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
              disabled={isLoading || isLocked}
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
              disabled={isLoading || isLocked}
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
          className={`
            w-full h-11 text-sm font-medium transition-all duration-200
            ${isLocked 
              ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800' 
              : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-sm hover:shadow-md
          `}
          disabled={isLoading || isLocked}
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : isLocked ? (
            <div className="flex items-center space-x-2">
              <SecurityIcon type="lock" className="w-4 h-4" />
              <span>Account Locked</span>
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

      {/* Attempt Counter for debugging */}
      {attempts > 0 && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {attempts} failed attempt{attempts === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};