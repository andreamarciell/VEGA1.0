import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ExternalLink, Presentation as PresentationIcon } from 'lucide-react';

const Presentation = () => {
  const navigate = useNavigate();

  const openPresentation = () => {
    // Navigate to the actual presentation
    navigate('/presentation/slides');
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
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <PresentationIcon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-semibold text-foreground">TopperyAML Presentation</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <PresentationIcon className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground">
              TopperyAML
              <br />
              <span className="text-primary">Presentation</span>
            </h1>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Contenuti della Presentazione</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              <div className="text-left space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary">1</span>
                  <span>Introduzione e Panoramica</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary">2</span>
                  <span>Dashboard AML e Funzionalità</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary">3</span>
                  <span>Architettura Tecnica</span>
                </div>
              </div>
              <div className="text-left space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary">4</span>
                  <span>Stack Tecnologico</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary">5</span>
                  <span>Conclusione e Prova Live</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Button 
              onClick={openPresentation}
              size="lg"
              className="text-lg px-8 py-6"
            >
              <PresentationIcon className="w-5 h-5 mr-2" />
              Apri Presentazione
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <p>La presentazione si aprirà nella stessa finestra</p>
              <p>Usa le frecce ← → per navigare, F per fullscreen, P per auto-play</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Presentation;
