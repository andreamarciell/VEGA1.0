import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight, LogIn } from "lucide-react";
import { motion } from "framer-motion";

interface CTASectionProps {
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  loginCta: string;
  onPrimaryCta: () => void;
  onSecondaryCta: () => void;
  onLoginCta: () => void;
}

export const CTASection = ({
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  loginCta,
  onPrimaryCta,
  onSecondaryCta,
  onLoginCta
}: CTASectionProps) => {
  return (
    <section className="relative container mx-auto px-6 py-32 overflow-hidden">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-tr from-primary/15 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground">
            {title}
          </h2>
          
          <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-2xl mx-auto">
            {subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              onClick={onPrimaryCta}
              size="lg"
              className="px-16 py-8 text-xl rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-2xl shadow-primary/25 border-0"
            >
              {primaryCta}
              <ChevronRight className="w-6 h-6 ml-3" />
            </Button>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              onClick={onSecondaryCta}
              variant="outline"
              size="lg"
              className="px-16 py-8 text-xl rounded-full border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 backdrop-blur-sm"
            >
              {secondaryCta}
              <ArrowRight className="w-6 h-6 ml-3" />
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="pt-6"
        >
          <Button 
            onClick={onLoginCta}
            variant="ghost"
            size="lg"
            className="text-muted-foreground hover:text-foreground hover:bg-primary/5 rounded-full px-8 py-4"
          >
            <LogIn className="w-5 h-5 mr-2" />
            {loginCta}
          </Button>
        </motion.div>
      </div>
    </section>
  );
};
