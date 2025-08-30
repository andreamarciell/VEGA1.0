import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft, ExternalLink, Type, FileText, Edit3, Copy, CheckCircle } from "lucide-react";

const TopTextLanding = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Type className="w-6 h-6 text-green-500" />,
      title: "Text Formatting",
      description: "Advanced text formatting tools for professional content creation"
    },
    {
      icon: <Edit3 className="w-6 h-6 text-blue-500" />,
      title: "Smart Editing",
      description: "Intelligent text editing features with real-time suggestions"
    },
    {
      icon: <Copy className="w-6 h-6 text-purple-500" />,
      title: "Quick Copy",
      description: "One-click copying and formatting for seamless workflow"
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-orange-500" />,
      title: "Grammar Check",
      description: "Built-in grammar and style checking for error-free content"
    }
  ];

  const handleInstall = () => {
    window.open('https://get.toppery.work/toptext', '_blank', 'noopener,noreferrer');
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
              <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-xl font-semibold text-foreground">TopText</span>
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
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
              <Shield className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-light text-foreground leading-tight">
            TopText
            <br />
            <span className="text-green-500 font-medium">Extension</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-light">
            Smart text enhancement and formatting tools that revolutionize your content creation with powerful writing assistance.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              onClick={handleInstall}
              size="lg"
              className="px-8 py-6 text-lg rounded-full bg-green-500 hover:bg-green-600 text-white"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Install TopText
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-foreground mb-4">
              Advanced Text Features
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need for professional text processing
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-green-500/20 transition-colors">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg flex items-center justify-center">
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
            Ready to enhance your text?
          </h2>
          <Button 
            onClick={handleInstall}
            size="lg"
            className="px-12 py-6 text-lg rounded-full bg-green-500 hover:bg-green-600 text-white"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Install TopText Now
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
              © 2025 Toppery. Advanced text processing solutions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TopTextLanding;
