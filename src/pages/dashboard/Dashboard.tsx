import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SecurityIcon } from "@/components/SecurityIcon";
import { getCurrentSession, logout, AuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Shield, User, Clock, LogOut } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentSession = await getCurrentSession();
        if (!currentSession) {
          // User is not authenticated, redirect to login
          navigate('/auth/login', { replace: true });
          return;
        }
        setSession(currentSession);
      } catch (error) {
        console.error('Auth check error:', error);
        navigate('/auth/login', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      const result = await logout();
      
      if (result.error) {
        toast({
          title: "Logout Error",
          description: result.error,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Logged Out",
          description: "You have been securely logged out",
        });
        navigate('/auth/login', { replace: true });
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Logout Error",
        description: "An unexpected error occurred during logout",
        variant: "destructive"
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect in useEffect
  }

  const loginTime = new Date(session.user.created_at || '').toLocaleString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-security/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-security" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-security">Secure Dashboard</h1>
              <p className="text-sm text-muted-foreground">Protected Environment</p>
            </div>
          </div>
          
          <Button
            onClick={handleLogout}
            variant="outline"
            disabled={isLoggingOut}
            className="flex items-center space-x-2"
          >
            {isLoggingOut ? (
              <>
                <div className="w-4 h-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                <span>Logging out...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-success/10 rounded-full flex items-center justify-center">
            <SecurityIcon type="shield" className="w-10 h-10 text-success" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Welcome, {session.user.username || 'User'}!
            </h2>
            <p className="text-lg text-muted-foreground mt-2">
              You have successfully accessed the secure dashboard
            </p>
          </div>
        </div>

        {/* Security Status */}
        <Alert className="border-success/20 bg-success/5">
          <Shield className="w-4 h-4 text-success" />
          <AlertDescription className="text-success-foreground">
            <strong>Security Status:</strong> All systems secure. Your session is protected with enterprise-grade encryption.
          </AlertDescription>
        </Alert>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Info Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User Information</CardTitle>
              <User className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">{session.user.username || 'N/A'}</div>
                <div className="text-xs text-muted-foreground">
                  Email: {session.user.email}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {session.user.id.slice(0, 8)}...
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Info Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Session Details</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-success">Active</div>
                <div className="text-xs text-muted-foreground">
                  Login time: {loginTime}
                </div>
                <div className="text-xs text-muted-foreground">
                  Session ID: {session.access_token.slice(0, 12)}...
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Features Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Features</CardTitle>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>Account lockout protection</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>Secure password validation</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>Session management</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Protected Content */}
        <Card className="border-security/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <SecurityIcon type="lock" className="w-5 h-5 text-security" />
              <span>Protected Content Area</span>
            </CardTitle>
            <CardDescription>
              This area is only accessible to authenticated users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground">
              Congratulations! You have successfully authenticated and gained access to the secure dashboard. 
              This demonstrates the following security features:
            </p>
            
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start space-x-2">
                <span className="text-success">•</span>
                <span>Username-based authentication with secure password verification</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-success">•</span>
                <span>Account lockout protection after failed login attempts</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-success">•</span>
                <span>Automatic session management and security validation</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-success">•</span>
                <span>Secure routing with authentication guards</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-success">•</span>
                <span>Enterprise-grade encryption and token management</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;