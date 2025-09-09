import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight } from "lucide-react";

interface HeroProps {
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  loginCta: string;
  onPrimaryCta: () => void;
  onSecondaryCta: () => void;
  onLoginCta: () => void;
}

export const Hero = ({
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  loginCta,
  onPrimaryCta,
  onSecondaryCta,
  onLoginCta
}: HeroProps) => {
  return (
    <section className="container mx-auto px-6 py-20 text-center">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-5xl md:text-7xl font-light text-foreground leading-tight">
          {headline}
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light">
          {subheadline}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
          <Button 
            onClick={onPrimaryCta}
            size="lg"
            className="px-8 py-6 text-lg rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {primaryCta}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
          
          <Button 
            onClick={onSecondaryCta}
            variant="outline"
            size="lg"
            className="px-8 py-6 text-lg rounded-full"
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
            {loginCta}
          </Button>
        </div>
      </div>
    </section>
  );
};
