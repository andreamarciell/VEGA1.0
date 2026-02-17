import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft, ExternalLink, Zap, Brain, Sparkles, Wand2, CheckCircle } from "lucide-react";

const TopTextAILanding = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Brain className="w-6 h-6 text-yellow-500" />,
      title: "AI Writing Assistant",
      description: "Intelligent AI-powered writing suggestions and content generation"
    },
    {
      icon: <Sparkles className="w-6 h-6 text-purple-500" />,
      title: "Smart Completion",
      description: "Auto-complete sentences and paragraphs with AI-driven predictions"
    },
    {
      icon: <Wand2 className="w-6 h-6 text-blue-500" />,
      title: "Content Enhancement",
      description: "Transform and improve existing text with AI-powered enhancements"
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-green-500" />,
      title: "Context Awareness",
      description: "AI understands context to provide relevant and accurate suggestions"
    }
  ];

  const handleInstall = () => {
    window.open('https://get.toppery.work/toptext-ai', '_blank', 'noopener,noreferrer');
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
              <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-yellow-500" />
              </div>
              <span className="text-xl font-semibold text-foreground">TopText AI</span>
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
            <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center">
              <Zap className="w-10 h-10 text-yellow-500" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-light text-foreground leading-tight">
            TopText AI
            <br />
            <span className="text-yellow-500 font-medium">Extension</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-light">
            AI-powered text generation and intelligent writing assistance that transforms your content creation with cutting-edge artificial intelligence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              onClick={handleInstall}
              size="lg"
              className="px-8 py-6 text-lg rounded-full bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Install TopText AI
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-foreground mb-4">
              AI-Powered Features
            </h2>
            <p className="text-xl text-muted-foreground">
              Experience the future of intelligent writing assistance
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-yellow-500/20 transition-colors">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-lg flex items-center justify-center">
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
            Ready for AI-powered writing?
          </h2>
          <Button 
            onClick={handleInstall}
            size="lg"
            className="px-12 py-6 text-lg rounded-full bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Install TopText AI Now
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
              © 2025 Vega. AI-powered writing solutions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TopTextAILanding;
