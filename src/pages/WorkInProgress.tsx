import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Construction, Clock } from "lucide-react";

const WorkInProgress = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Construction className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-semibold text-foreground">Vega</span>
          </div>
          
          <Button 
            onClick={() => navigate('/review')} 
            variant="outline" 
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="mx-auto w-24 h-24 bg-primary/10 rounded-2xl flex items-center justify-center mb-8">
            <Construction className="w-12 h-12 text-primary" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-light text-foreground leading-tight">
            Work in
            <br />
            <span className="text-primary font-medium">Progress.</span>
          </h1>
          

          <div className="flex items-center justify-center space-x-2 text-muted-foreground pt-8">
            <Clock className="w-5 h-5" />
            <span className="text-lg">Coming soon...</span>
          </div>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto font-light">
            We're working hard to bring you the best review generation experience. 
            Please check back later!
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/20 mt-20">
        <div className="container mx-auto px-6 py-12">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                <Construction className="w-4 h-4 text-primary" />
              </div>
              <span className="text-lg font-semibold text-foreground">Vega</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Vega. Advanced intelligence solutions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WorkInProgress;
