import { Card, CardContent } from "@/components/ui/card";
import { 
  Zap, 
  BarChart3, 
  Shield, 
  Puzzle, 
  TrendingUp, 
  Clock,
  LucideIcon 
} from "lucide-react";

interface ValueFeature {
  icon: string;
  title: string;
  description: string;
}

interface ValueListProps {
  title: string;
  subtitle: string;
  features: ValueFeature[];
}

const iconMap: Record<string, LucideIcon> = {
  Zap,
  BarChart3,
  Shield,
  Puzzle,
  TrendingUp,
  Clock
};

export const ValueList = ({ title, subtitle, features }: ValueListProps) => {
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = iconMap[feature.icon] || Shield;
            
            return (
              <Card 
                key={index} 
                className="border-2 hover:border-primary/20 transition-colors bg-muted/20"
              >
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                    <IconComponent className="w-8 h-8 text-primary" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
