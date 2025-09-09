import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  FileText, 
  Image, 
  Globe,
  LucideIcon 
} from "lucide-react";

interface SolutionCard {
  title: string;
  description: string;
  products: string[];
  icon: string;
}

interface SolutionsProps {
  title: string;
  subtitle: string;
  cards: SolutionCard[];
}

const iconMap: Record<string, LucideIcon> = {
  Shield,
  FileText,
  Image,
  Globe
};

export const Solutions = ({ title, subtitle, cards }: SolutionsProps) => {
  return (
    <section className="container mx-auto px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            {title}
          </h2>
          <p className="text-xl text-muted-foreground font-light">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {cards.map((card, index) => {
            const IconComponent = iconMap[card.icon] || Shield;
            
            return (
              <Card 
                key={index} 
                className="border-2 hover:border-primary/20 transition-colors bg-muted/20"
              >
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                      <IconComponent className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-2xl text-foreground">
                        {card.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    {card.products.map((product, productIndex) => (
                      <Badge 
                        key={productIndex} 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {product}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
