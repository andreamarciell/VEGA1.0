import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Integration {
  name: string;
  type: string;
}

interface EcosystemProps {
  title: string;
  subtitle: string;
  description: string;
  integrations: Integration[];
}

export const Ecosystem = ({ 
  title, 
  subtitle, 
  description, 
  integrations 
}: EcosystemProps) => {
  return (
    <section className="container mx-auto px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            {title}
          </h2>
          <p className="text-xl text-muted-foreground font-light mb-8">
            {subtitle}
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        <Card className="border-2 bg-muted/20">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-semibold text-foreground mb-4">
                Integrazioni Supportate
              </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {integrations.map((integration, index) => (
                <div 
                  key={index}
                  className="text-center p-4 rounded-lg bg-background/50 border"
                >
                  <div className="text-lg font-medium text-foreground mb-1">
                    {integration.name}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {integration.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
