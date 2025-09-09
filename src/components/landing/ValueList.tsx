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
import { motion } from "framer-motion";

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

export const ValueList = ({ title, subtitle, features }: ValueListProps) => {
  return (
    <section className="container mx-auto px-6 py-32">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            {title}
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-3xl mx-auto">
            {subtitle}
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {features.map((feature, index) => {
            const IconComponent = iconMap[feature.icon] || Shield;
            
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="h-full border-0 bg-gradient-to-br from-background via-background to-primary/5 hover:from-primary/5 hover:to-primary/10 transition-all duration-500 shadow-lg hover:shadow-2xl hover:shadow-primary/10 group">
                  <CardContent className="p-8 text-center space-y-6 relative overflow-hidden">
                    {/* Background gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <motion.div 
                      className="relative z-10 w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300"
                      whileHover={{ rotate: 5 }}
                    >
                      <IconComponent className="w-10 h-10 text-primary group-hover:text-primary/80" />
                    </motion.div>
                    
                    <div className="relative z-10 space-y-4">
                      <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                        {feature.title}
                      </h3>
                      
                      <p className="text-muted-foreground leading-relaxed text-lg">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
