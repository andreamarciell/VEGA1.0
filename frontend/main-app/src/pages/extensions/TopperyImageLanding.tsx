import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft, ExternalLink, Star, Image, Zap, Download, CheckCircle } from "lucide-react";

const TopperyImageLanding = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Image className="w-6 h-6 text-blue-500" />,
      title: "Image Optimization",
      description: "Automatically optimize images for faster loading and better quality"
    },
    {
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      title: "Instant Processing",
      description: "Real-time image enhancement and compression with lightning speed"
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-green-500" />,
      title: "Format Conversion",
      description: "Convert between multiple image formats seamlessly"
    },
    {
      icon: <Download className="w-6 h-6 text-purple-500" />,
      title: "Batch Processing",
      description: "Process multiple images at once for maximum efficiency"
    }
  ];

  const handleInstall = () => {
    window.open('https://get.toppery.work/toppery-image', '_blank', 'noopener,noreferrer');
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
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-xl font-semibold text-foreground">Toppery Image</span>
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
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Star className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-light text-foreground leading-tight">
            Toppery Image
            <br />
            <span className="text-blue-500 font-medium">Extension</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-light">
            Advanced image processing and optimization tools that transform your browsing experience with powerful image enhancement capabilities.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button 
              onClick={handleInstall}
              size="lg"
              className="px-8 py-6 text-lg rounded-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Install Toppery Image
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-light text-foreground mb-4">
              Powerful Image Features
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need for professional image processing
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-blue-500/20 transition-colors">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg flex items-center justify-center">
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
            Ready to enhance your images?
          </h2>
          <Button 
            onClick={handleInstall}
            size="lg"
            className="px-12 py-6 text-lg rounded-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Install Toppery Image Now
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
              © 2025 Toppery. Advanced image processing solutions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TopperyImageLanding;
