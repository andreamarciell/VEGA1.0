import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityIcon } from "@/components/SecurityIcon";
import { getCurrentSession } from "@/lib/auth";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const session = await getCurrentSession();
        if (session) {
          // User is logged in, redirect to dashboard
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    };

    checkAuthAndRedirect();
  }, [navigate]);

  const handleAccessSystem = () => {
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg mx-auto shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-security/10 rounded-full flex items-center justify-center">
            <SecurityIcon type="shield" className="w-10 h-10 text-security" />
          </div>
          <CardTitle className="text-3xl font-bold text-security">
            Secure Gateway Portal
          </CardTitle>
          <CardDescription className="text-lg">
            Enterprise-grade authentication system with advanced security features
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4 text-center">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span>Account Lockout Protection</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span>Session Management</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span>Secure Password Validation</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span>Enterprise Encryption</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAccessSystem}
            variant="security"
            size="lg"
            className="w-full"
          >
            <SecurityIcon type="lock" className="w-5 h-5 mr-2" />
            Access Secure System
          </Button>

          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Powered by Supabase Authentication • Enterprise Security Standards
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
