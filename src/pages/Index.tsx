import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth";
import { DollarSign, Shield, FileText, ChevronRight, Star, Users, TrendingUp } from "lucide-react";
const Index = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const session = await getCurrentSession();
        if (session) {
          // User is logged in, redirect to dashboard
          navigate('/dashboard', {
            replace: true
          });
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    };
    checkAuthAndRedirect();
  }, [navigate]);
  const handleLogin = () => {
    navigate('/auth/login');
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-semibold text-foreground">Toppery</span>
          </div>
          
          <Button onClick={handleLogin} variant="default" size="sm">
            Login
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-7xl font-light text-foreground leading-tight">
            Financial Intelligence.
            <br />
            <span className="text-primary font-medium">Simplified.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light">
            Advanced AML analysis and review generation tools that transform complex financial data into actionable insights.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button onClick={handleLogin} size="lg" className="px-8 py-6 text-lg rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Get Started
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
            
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
              Everything you need.
            </h2>
            <p className="text-xl text-muted-foreground font-light">
              Powerful tools designed for financial professionals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* AML Analysis */}
            <div className="space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-3xl font-light text-foreground">
                AML Analysis
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Advanced anti-money laundering analysis with intelligent pattern recognition and automated compliance reporting.
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Real-time transaction monitoring</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Automated risk scoring</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Compliance reporting</span>
                </div>
              </div>
            </div>

            <div className="h-80 bg-gradient-to-br from-primary/5 to-primary/10 rounded-3xl"></div>

            {/* Review Generator */}
            

            <div className="space-y-6">
              <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-3xl font-light text-foreground">
                Review Generator
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Intelligent review generation that creates comprehensive reports from your financial data analysis.
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <span className="text-muted-foreground">Automated report generation</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <span className="text-muted-foreground">Customizable templates</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <span className="text-muted-foreground">Export capabilities</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="space-y-4">
              <TrendingUp className="w-12 h-12 text-primary mx-auto" />
              <div className="text-4xl font-light text-foreground">99.9%</div>
              <p className="text-muted-foreground">Detection Accuracy</p>
            </div>
            <div className="space-y-4">
              <Users className="w-12 h-12 text-primary mx-auto" />
              <div className="text-4xl font-light text-foreground">10K+</div>
              <p className="text-muted-foreground">Trusted Users</p>
            </div>
            <div className="space-y-4">
              <Star className="w-12 h-12 text-primary mx-auto" />
              <div className="text-4xl font-light text-foreground">4.9/5</div>
              <p className="text-muted-foreground">User Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-light text-foreground">
            Ready to get started?
          </h2>
          
          <Button onClick={handleLogin} size="lg" className="px-12 py-6 text-lg rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Start Today
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20">
        <div className="container mx-auto px-6 py-12">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <span className="text-lg font-semibold text-foreground">Toppery</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Toppery. Advanced financial intelligence solutions.
            </p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Index;