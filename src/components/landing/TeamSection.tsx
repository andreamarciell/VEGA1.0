import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Award, 
  Target, 
  TrendingUp,
  LucideIcon 
} from "lucide-react";
import { motion } from "framer-motion";

interface TeamMember {
  name: string;
  role: string;
  expertise: string[];
  avatar?: string;
}

interface TeamSectionProps {
  title: string;
  subtitle: string;
  members: TeamMember[];
  stats: {
    label: string;
    value: string;
    icon: string;
  }[];
}

const iconMap: Record<string, LucideIcon> = {
  Users,
  Award,
  Target,
  TrendingUp
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

export const TeamSection = ({ title, subtitle, members, stats }: TeamSectionProps) => {
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

        {/* Stats Section */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {stats.map((stat, index) => {
            const IconComponent = iconMap[stat.icon] || TrendingUp;
            
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -5 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="text-center border-0 bg-gradient-to-br from-background via-background to-primary/5 hover:from-primary/5 hover:to-primary/10 transition-all duration-500 shadow-lg hover:shadow-2xl hover:shadow-primary/10 group">
                  <CardContent className="p-8">
                    <motion.div 
                      className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300"
                      whileHover={{ rotate: 5 }}
                    >
                      <IconComponent className="w-8 h-8 text-primary" />
                    </motion.div>
                    
                    <div className="text-3xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                      {stat.value}
                    </div>
                    
                    <div className="text-muted-foreground text-sm">
                      {stat.label}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Team Members */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {members.map((member, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="h-full border-0 bg-gradient-to-br from-background via-background to-primary/5 hover:from-primary/5 hover:to-primary/10 transition-all duration-500 shadow-lg hover:shadow-2xl hover:shadow-primary/10 group relative overflow-hidden">
                {/* Background gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <CardContent className="p-8 text-center space-y-6 relative z-10">
                  {/* Avatar placeholder */}
                  <motion.div 
                    className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: 5 }}
                  >
                    <Users className="w-12 h-12 text-primary" />
                  </motion.div>
                  
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                      {member.name}
                    </h3>
                    
                    <p className="text-primary font-semibold text-lg">
                      {member.role}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 justify-center">
                    {member.expertise.map((skill, skillIndex) => (
                      <Badge 
                        key={skillIndex}
                        variant="secondary" 
                        className="text-xs px-3 py-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors duration-300"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
