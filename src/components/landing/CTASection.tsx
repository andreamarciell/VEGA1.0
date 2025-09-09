import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight, LogIn } from "lucide-react";

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
    <section className="container mx-auto px-6 py-20">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h2 className="text-4xl md:text-5xl font-light text-foreground">
          {title}
        </h2>
        
        <p className="text-xl text-muted-foreground font-light">
          {subtitle}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
          <Button 
            onClick={onPrimaryCta}
            size="lg"
            className="px-12 py-6 text-lg rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {primaryCta}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
          
          <Button 
            onClick={onSecondaryCta}
            variant="outline"
            size="lg"
            className="px-12 py-6 text-lg rounded-full"
          >
            {secondaryCta}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <div className="pt-4">
          <Button 
            onClick={onLoginCta}
            variant="ghost"
            size="lg"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogIn className="w-4 h-4 mr-2" />
            {loginCta}
          </Button>
        </div>
      </div>
    </section>
  );
};
