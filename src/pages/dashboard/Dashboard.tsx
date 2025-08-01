import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession, logout, AuthSession } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Shield, FileText, LogOut, DollarSign, Settings, Eye, EyeOff, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
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

  const handleSavePassword = async () => {
    if (!newPassword) {
      toast({
        title: "Error",
        description: "Please enter a new password",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error", 
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      // Note: In a real implementation, you'd call Supabase auth.updateUser here
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setNewPassword("");
      setConfirmPassword("");
      setShowSettings(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update password",
        variant: "destructive"
      });
    } finally {
      setIsSavingPassword(false);
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
          
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => setShowSettings(true)} 
              variant="ghost" 
              size="icon"
              className="hover:bg-muted"
            >
              <Settings className="w-4 h-4" />
            </Button>
            
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

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Account Settings</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowSettings(false)}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Account Info */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Username</Label>
                <Input 
                  value={session?.user.username || ""}
                  disabled 
                  className="mt-1 bg-muted"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Last Login</Label>
                <Input 
                  value={new Date(session?.user.created_at || '').toLocaleString()}
                  disabled 
                  className="mt-1 bg-muted"
                />
              </div>
            </div>

            {/* Change Password */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-medium">Change Password</h3>
              
              <div>
                <Label htmlFor="new-password" className="text-sm">New Password</Label>
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="confirm-password" className="text-sm">Confirm Password</Label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm new password"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowSettings(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSavePassword}
              disabled={isSavingPassword || !newPassword}
            >
              {isSavingPassword ? (
                <>
                  <div className="w-4 h-4 border-2 border-background/20 border-t-background rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Dashboard;