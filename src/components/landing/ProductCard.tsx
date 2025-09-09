import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  LogIn,
  LucideIcon,
  DollarSign,
  Star,
  Globe,
  Zap,
  Shield,
  FileText
} from "lucide-react";

interface ProductCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  features: string[];
  hasLogin: boolean;
  route?: string;
  externalUrl?: string;
  onDetailsClick: (route: string) => void;
  onLoginClick: () => void;
  onExternalClick: (url: string) => void;
}

const iconMap: Record<string, LucideIcon> = {
  DollarSign,
  Star,
  Globe,
  Zap,
  Shield,
  FileText
};

const colorMap: Record<string, string> = {
  primary: "text-primary",
  blue: "text-blue-500",
  purple: "text-purple-500",
  yellow: "text-yellow-500",
  green: "text-green-500"
};

const bgColorMap: Record<string, string> = {
  primary: "bg-primary/10",
  blue: "bg-blue-500/10",
  purple: "bg-purple-500/10",
  yellow: "bg-yellow-500/10",
  green: "bg-green-500/10"
};

export const ProductCard = ({
  id,
  title,
  description,
  category,
  icon,
  color,
  features,
  hasLogin,
  route,
  externalUrl,
  onDetailsClick,
  onLoginClick,
  onExternalClick
}: ProductCardProps) => {
  const IconComponent = iconMap[icon] || Shield;
  const iconColor = colorMap[color] || "text-primary";
  const bgColor = bgColorMap[color] || "bg-primary/10";

  return (
    <Card className="h-full border-2 hover:border-primary/20 transition-all duration-300 group">
      <CardHeader className="text-center pb-6">
        <div className={`mx-auto w-20 h-20 ${bgColor} rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
          <IconComponent className={`w-10 h-10 ${iconColor}`} />
        </div>
        
        <div className="space-y-2">
          <CardTitle className="text-2xl group-hover:text-primary transition-colors">
            {title}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {category}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <p className="text-muted-foreground leading-relaxed text-center">
          {description}
        </p>
        
        <div className="space-y-2">
          {features.slice(0, 3).map((feature, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col gap-2 pt-4">
          {route && (
            <Button 
              className="w-full group-hover:bg-primary/90 transition-colors"
              onClick={() => onDetailsClick(route)}
            >
              Dettagli
            </Button>
          )}
          
          {hasLogin && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={onLoginClick}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
          )}
          
          {externalUrl && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => onExternalClick(externalUrl)}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Installa
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
