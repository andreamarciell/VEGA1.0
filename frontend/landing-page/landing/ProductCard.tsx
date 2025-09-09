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
import { motion } from "framer-motion";

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
  primary: "bg-gradient-to-br from-primary/20 to-primary/10",
  blue: "bg-gradient-to-br from-blue-500/20 to-blue-500/10",
  purple: "bg-gradient-to-br from-purple-500/20 to-purple-500/10",
  yellow: "bg-gradient-to-br from-yellow-500/20 to-yellow-500/10",
  green: "bg-gradient-to-br from-green-500/20 to-green-500/10"
};

const borderColorMap: Record<string, string> = {
  primary: "border-primary/20 hover:border-primary/40",
  blue: "border-blue-500/20 hover:border-blue-500/40",
  purple: "border-purple-500/20 hover:border-purple-500/40",
  yellow: "border-yellow-500/20 hover:border-yellow-500/40",
  green: "border-green-500/20 hover:border-green-500/40"
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
  const bgColor = bgColorMap[color] || "bg-gradient-to-br from-primary/20 to-primary/10";
  const borderColor = borderColorMap[color] || "border-primary/20 hover:border-primary/40";

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className={`h-full border-2 ${borderColor} transition-all duration-500 group bg-gradient-to-br from-background via-background to-primary/5 hover:from-primary/5 hover:to-primary/10 shadow-lg hover:shadow-2xl hover:shadow-primary/10 relative overflow-hidden`}>
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardHeader className="text-center pb-6 relative z-10">
          <motion.div 
            className={`mx-auto w-24 h-24 ${bgColor} rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
            whileHover={{ rotate: 5 }}
          >
            <IconComponent className={`w-12 h-12 ${iconColor} group-hover:scale-110 transition-transform duration-300`} />
          </motion.div>
          
          <div className="space-y-3">
            <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors duration-300">
              {title}
            </CardTitle>
            <Badge 
              variant="secondary" 
              className="text-sm px-4 py-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors duration-300"
            >
              {category}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 relative z-10">
          <p className="text-muted-foreground leading-relaxed text-center text-lg">
            {description}
          </p>
          
          <div className="space-y-3">
            {features.slice(0, 3).map((feature, index) => (
              <motion.div 
                key={index} 
                className="flex items-center space-x-3"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="w-2 h-2 bg-gradient-to-r from-primary to-primary/60 rounded-full flex-shrink-0"></div>
                <span className="text-sm text-muted-foreground">{feature}</span>
              </motion.div>
            ))}
          </div>
          
          <div className="flex flex-col gap-3 pt-6">
            {route && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={() => onDetailsClick(route)}
                >
                  Dettagli
                </Button>
              </motion.div>
            )}
            
            {hasLogin && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="outline"
                  className="w-full border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                  onClick={onLoginClick}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </motion.div>
            )}
            
            {externalUrl && (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="outline"
                  className="w-full border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                  onClick={() => onExternalClick(externalUrl)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Installa
                </Button>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
