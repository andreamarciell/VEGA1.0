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

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export const LoginForm = ({ onLoginSuccess }: LoginFormProps) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: "",
    password: ""
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credentials.username.trim() || !credentials.password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loginWithCredentials(credentials);
      
      if (result.error) {
        setError(result.error);
        setAttempts(prev => prev + 1);
        
        if (attempts >= 2) {
          toast({
            title: "Security Notice",
            description: "Multiple failed login attempts detected. Please verify your credentials.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Login Successful",
          description: "Welcome back! Redirecting to dashboard...",
          variant: "default"
        });
        onLoginSuccess();
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isHighAttempts = attempts >= 3;

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <SecurityIcon type="shield" className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold text-primary">Welcome Back</CardTitle>
        <CardDescription className="text-muted-foreground">
          Sign in to access your Toppery services
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <Alert variant={isHighAttempts ? "destructive" : "default"}>
            <SecurityIcon type="lock" className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Enter your username"
              disabled={isLoading}
              className={error ? "border-destructive focus-visible:ring-destructive" : ""}
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <PasswordInput
              value={credentials.password}
              onChange={(value) => setCredentials(prev => ({ ...prev, password: value }))}
              placeholder="Enter your password"
              disabled={isLoading}
              error={!!error}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin mr-2" />
                Signing In...
              </>
            ) : (
              <>
                <SecurityIcon type="lock" className="w-4 h-4 mr-2" />
                Sign In
              </>
            )}
          </Button>
        </form>

        <div className="pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Powered by Toppery Platform
          </p>
        </div>
      </CardContent>
    </Card>
  );
};