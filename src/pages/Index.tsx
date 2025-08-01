import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth";
import { DollarSign, Shield, FileText, ChevronRight } from "lucide-react";

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

  const handleLogin = () => {
    navigate('/auth/login');
  };

  return (
    <div className="min-h-screen bg-background">
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
            Data Analysis.
            <br />
            <span className="text-primary font-medium">Simplified.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light">
            Advanced tools that transform complex analysis into actionable insights.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="px-8 py-6 text-lg rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Get Started
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container w-full h-full mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
              Everything you need.
            </h2>
            <p className="text-xl text-muted-foreground font-light">
              Powerful tools designed for financial professionals.
            </p>
          </div>

          {/* CORREZIONE: items-stretch per altezza uguale, flex per allineamento interno */}
          <div className="grid md:grid-cols-2 gap-16">

            {/* Feature 1: AML Analysis */}
            <div className="flex flex-col space-y-3 w-full h-full">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-3xl font-light text-foreground">
                Toppery AML
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed flex-grow">
                Advanced data analysis with intelligent pattern recognition, perfect for AML/Fraud analysis.
              </p>
              <div className="space-y-3 pt-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Advanced financial data analysis</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Gameplay analysis with data visualization</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Full IP Analysis</span>
                </div>
              </div>
            </div>

            {/* Feature 2: Review Generator */}
            <div className="flex flex-col space-y-3 w-full h-full">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-3xl font-light text-foreground">
                Toppery AML
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed flex-grow">
                Advanced data analysis with intelligent pattern recognition, perfect for AML/Fraud analysis.
              </p>
              <div className="space-y-3 pt-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Advanced financial data analysis</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Gameplay analysis with data visualization</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">Full IP Analysis</span>
                </div>
              </div>
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
          <Button 
            onClick={handleLogin}
            size="lg"
            className="px-12 py-6 text-lg rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Get started
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
    </div>
  );
};

export default Index;
