import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordInput } from "@/components/PasswordInput";
import { adminLogin, checkAdminSession, initializeDefaultAdmin } from "@/lib/adminAuth";
import { toast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

const AdminLogin = () => {
  const [credentials, setCredentials] = useState({ nickname: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const admin = await checkAdminSession();
      if (admin) {
        navigate("/control");
      }
    };

    const initialize = async () => {
      await initializeDefaultAdmin();
    };

    initialize();
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
      const { admin, error } = await adminLogin(credentials.nickname, credentials.password);

      if (error) {
        setError(error);
        toast({
          title: "Login Failed",
          description: error,
          variant: "destructive",
        });
      } else if (admin) {
        toast({
          title: "Welcome Admin",
          description: `Successfully logged in as ${admin.nickname}`,
        });
        navigate("/control");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Admin Control Panel</CardTitle>
          <p className="text-muted-foreground">
            Secure administrative access
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="nickname">Admin Nickname</Label>
              <Input
                id="nickname"
                type="text"
                value={credentials.nickname}
                onChange={(e) => setCredentials(prev => ({ ...prev, nickname: e.target.value }))}
                placeholder="Enter admin nickname"
                disabled={isLoading}
                className={error ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                value={credentials.password}
                onChange={(value) => setCredentials(prev => ({ ...prev, password: value }))}
                placeholder="Enter admin password"
                disabled={isLoading}
                error={!!error}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Authenticating..." : "Access Control Panel"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;