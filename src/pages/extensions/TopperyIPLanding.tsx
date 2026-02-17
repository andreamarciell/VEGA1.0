import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft, ExternalLink, Globe, Network, Monitor, Lock, CheckCircle } from "lucide-react";

const TopperyIPLanding = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Network className="w-6 h-6 text-purple-500" />,
      title: "IP Analysis",
      description: "Advanced IP address tracking and analysis for network security"
    },
    {
      icon: <Monitor className="w-6 h-6 text-blue-500" />,
      title: "Network Monitoring",
      description: "Real-time network monitoring and traffic analysis tools"
    },
    {
      icon: <Lock className="w-6 h-6 text-red-500" />,
      title: "Security Insights",
      description: "Comprehensive security analysis and threat detection"
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-green-500" />,
      title: "IP Geolocation",
      description: "Accurate geolocation services for IP address mapping"
    }
  ];

  const handleInstall = () => {
    window.open('https://get.toppery.work/toppery-ip', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/extensions')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Extensions</span>
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5 text-purple-500" />
              </div>
              <span className="text-xl font-semibold text-foreground">Vega IP</span>
            </div>
          </div>
          
          <Button onClick={handleInstall} variant="default" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Install Extension
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center">
              <Globe className="w-10 h-10 text-purple-500" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-light text-foreground leading-tight">
            Vega IP
            <br />
            <span className="text-purple-500 font-medium">Extension</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-light">
            IP management and network analysis tools designed for advanced users who need comprehensive network insights and security analysis.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              onClick={handleInstall}
              size="lg"
              className="px-8 py-6 text-lg rounded-full bg-purple-500 hover:bg-purple-600 text-white"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Install Vega IP
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-foreground mb-4">
              Advanced IP Features
            </h2>
            <p className="text-xl text-muted-foreground">
              Professional-grade network analysis and IP management tools
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-purple-500/20 transition-colors">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-light text-foreground">
            Ready to analyze your network?
          </h2>
          <Button 
            onClick={handleInstall}
            size="lg"
            className="px-12 py-6 text-lg rounded-full bg-purple-500 hover:bg-purple-600 text-white"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Install Vega IP Now
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
              <span className="text-lg font-semibold text-foreground">Vega</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Vega. Advanced IP management solutions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TopperyIPLanding;
