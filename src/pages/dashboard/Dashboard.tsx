import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession, logout, AuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Shield, FileText, LogOut, DollarSign } from "lucide-react";
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
          navigate('/auth/login', {
            replace: true
          });
          return;
        }
        setSession(currentSession);
      } catch (error) {
        console.error('Auth check error:', error);
        navigate('/auth/login', {
          replace: true
        });
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
          description: "You have been securely logged out"
        });
        navigate('/auth/login', {
          replace: true
        });
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
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>;
  }
  if (!session) {
    return null; // Will redirect in useEffect
  }
  const loginTime = new Date(session.user.created_at || '').toLocaleString();
  return <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Toppery Platform</h1>
              
            </div>
          </div>
          
          <Button onClick={handleLogout} variant="outline" disabled={isLoggingOut} className="flex items-center space-x-2">
            {isLoggingOut ? <>
                <div className="w-4 h-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                <span>Logging out...</span>
              </> : <>
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </>}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Welcome, {session.user.username}!
            </h2>
            
          </div>
        </div>

        {/* Service Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Toppery AML */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/toppery-aml')}>
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <DollarSign className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Toppery AML</CardTitle>
              
            </CardHeader>
            <CardContent className="text-center">
              
              <Button className="w-full" onClick={e => {
              e.stopPropagation();
              navigate('/toppery-aml');
            }}>
                <DollarSign className="w-4 h-4 mr-2" />
                Access Toppery AML
              </Button>
            </CardContent>
          </Card>

          {/* Toppery Review Generator */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/work-in-progress')}>
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-secondary" />
              </div>
              <CardTitle className="text-2xl">Toppery Review Generator</CardTitle>
              
            </CardHeader>
            <CardContent className="text-center">
              
              <Button variant="secondary" className="w-full" onClick={e => {
              e.stopPropagation();
              navigate('/work-in-progress');
            }}>
                <FileText className="w-4 h-4 mr-2" />
                Access Review Generator
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>;
};
export default Dashboard;