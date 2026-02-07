import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  checkAdminSession, 
  adminLogout, 
  getUserAnalytics, 
  getAllUsers,
  createUser,
  updateUserNickname,
  updateUserPassword 
} from "@/lib/adminAuth";
import { toast } from "@/hooks/use-toast";
import { 
  Shield, 
  LogOut, 
  Users, 
  BarChart3, 
  UserPlus,
  Edit3,
  Key,
  Calendar,
  Activity,
  AlertTriangle
} from "lucide-react";
import { AdminUserManagement } from "@/components/admin/AdminUserManagement";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminRiskEngineConfig } from "@/components/admin/AdminRiskEngineConfig";

const AdminControl = () => {
  const [admin, setAdmin] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔍 AdminControl: Checking admin session...');
      const adminUser = await checkAdminSession();
      console.log('📊 AdminControl: Session check result:', adminUser ? { id: adminUser.id, nickname: adminUser.nickname } : null);
      
      if (!adminUser) {
        console.log('❌ AdminControl: No admin session, redirecting to login...');
        navigate("/control-login");
      } else {
        console.log('✅ AdminControl: Admin session valid, admin ID:', adminUser.id);
        setAdmin(adminUser);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/v1/admin/logout', {
        method: 'POST',
        credentials: 'include' // Important for cookies
      });
      
      if (response.ok) {
        toast({
          title: "Logged Out",
          description: "Successfully logged out from admin panel",
        });
        // Redirect to login page
        window.location.assign("/control-login");
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Admin Control Panel</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome back, {admin.nickname}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="text-xs">
                <Activity className="w-3 h-3 mr-1" />
                Online
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="risk-config" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Risk Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="risk-config">
            <AdminRiskEngineConfig />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminControl;