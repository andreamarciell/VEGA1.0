import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft, ExternalLink, Puzzle, Star, Zap, Globe } from "lucide-react";

const ChromeExtensions = () => {
  const navigate = useNavigate();

  const extensions = [
    {
      id: 1,
      title: "Toppery Analytics",
      description: "Advanced web analytics and data tracking for your browsing experience",
      icon: <Star className="w-8 h-8 text-blue-500" />,
      url: "https://get.toppery.work/analytics"
    },
    {
      id: 2,
      title: "Toppery Security",
      description: "Enhanced security and privacy protection while browsing",
      icon: <Shield className="w-8 h-8 text-green-500" />,
      url: "https://get.toppery.work/security"
    },
    {
      id: 3,
      title: "Toppery Productivity",
      description: "Boost your productivity with smart automation tools",
      icon: <Zap className="w-8 h-8 text-yellow-500" />,
      url: "https://get.toppery.work/productivity"
    },
    {
      id: 4,
      title: "Toppery Navigator",
      description: "Smart web navigation and bookmark management system",
      icon: <Globe className="w-8 h-8 text-purple-500" />,
      url: "https://get.toppery.work/navigator"
    }
  ];

  const handleExtensionClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
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
              onClick={() => navigate('/')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-semibold text-foreground">Toppery Extensions</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Puzzle className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-light text-foreground leading-tight">
            Chrome Extensions
            <br />
            <span className="text-primary font-medium">Collection</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light">
            Enhance your browsing experience with our powerful Chrome extensions designed for productivity and security.
          </p>
        </div>
      </section>

      {/* Extensions Grid */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {extensions.map((extension) => (
            <Card 
              key={extension.id} 
              className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20 group"
              onClick={() => handleExtensionClick(extension.url)}
            >
              <CardHeader className="text-center pb-6">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  {extension.icon}
                </div>
                <CardTitle className="text-2xl group-hover:text-primary transition-colors">
                  {extension.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  {extension.description}
                </p>
                <Button 
                  className="w-full group-hover:bg-primary/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExtensionClick(extension.url);
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Install Extension
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20 mt-16">
        <div className="container mx-auto px-6 py-12">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <span className="text-lg font-semibold text-foreground">Toppery</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Toppery. Advanced browser extensions for enhanced productivity.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ChromeExtensions;
