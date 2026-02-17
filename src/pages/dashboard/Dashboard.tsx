import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser, useClerk, useOrganization, OrganizationSwitcher } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Shield, FileText, LogOut, DollarSign, Settings, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";

const Dashboard = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isOrgLoaded) {
      return;
    }
    
    if (!isSignedIn) {
      navigate('/auth/login', { replace: true });
      return;
    }
  }, [isLoaded, isOrgLoaded, isSignedIn, navigate]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been securely logged out"
      });
      navigate('/auth/login', { replace: true });
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
      toast({ title: "Error", description: "Please enter a new password", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters long", variant: "destructive" });
      return;
    }

    setIsSavingPassword(true);
    try {
      if (!user) {
        throw new Error("User not found");
      }

      await user.update({ password: newPassword });

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      setNewPassword("");
      setConfirmPassword("");
      setShowSettings(false);

    } catch (error) {
      toast({
        title: "Error updating password",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!isLoaded || !isOrgLoaded) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>;
  }

  if (!isSignedIn || !user) {
    return null;
  }

  // Check if user has an organization selected
  if (!organization) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Organization Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You need to select an organization to access the dashboard. Please select an organization below.
            </p>
            <div className="flex justify-center">
              <OrganizationSwitcher />
            </div>
          </CardContent>
        </Card>
      </div>;
  }

  return <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Vega Platform</h1>
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

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Welcome, {user.username || user.firstName || user.emailAddresses[0]?.emailAddress || 'User'}!
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/vega')}>
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                <img 
                  src="/topperyaml.png" 
                  alt="Vega Logo" 
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }}
                />
                <DollarSign className="w-10 h-10 text-primary hidden" />
              </div>
              <CardTitle className="text-2xl">Vega</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button className="w-full" onClick={e => {
              e.stopPropagation();
              navigate('/vega');
            }}>
                <DollarSign className="w-4 h-4 mr-2" />
                Accedi
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/review')}>
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                <img 
                  src="/topperyreview.png" 
                  alt="Vega Review Logo" 
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }}
                />
                <FileText className="w-10 h-10 text-secondary hidden" />
              </div>
              <CardTitle className="text-2xl">Vega Review Generator</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="secondary" className="w-full" onClick={e => {
              e.stopPropagation();
              navigate('/review');
            }}>
                <FileText className="w-4 h-4 mr-2" />
                Accedi
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/vega-live')}>
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                <img 
                  src="/topperyaml.png" 
                  alt="Vega Live Logo" 
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }}
                />
                <DollarSign className="w-10 h-10 text-primary hidden" />
              </div>
              <CardTitle className="text-2xl">Vega Live</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button className="w-full" onClick={e => {
              e.stopPropagation();
              navigate('/vega-live');
            }}>
                <DollarSign className="w-4 h-4 mr-2" />
                Accedi
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

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
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Username</Label>
                <Input 
                  value={user.username || user.firstName || user.emailAddresses[0]?.emailAddress || ""}
                  disabled 
                  className="mt-1 bg-muted"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <Input 
                  value={user.emailAddresses[0]?.emailAddress || ""}
                  disabled 
                  className="mt-1 bg-muted"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Last Sign In</Label>
                <Input 
                  value={user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : "Never"}
                  disabled 
                  className="mt-1 bg-muted"
                />
              </div>
            </div>

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
