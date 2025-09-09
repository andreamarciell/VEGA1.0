import { Button } from "@/components/ui/button";
import { Shield, ArrowRight } from "lucide-react";

interface LandingFooterProps {
  company: string;
  tagline: string;
  links: {
    products: string;
    extensions: string;
    privacy: string;
    terms: string;
    contact: string;
  };
  copyright: string;
  onProductsClick: () => void;
  onExtensionsClick: () => void;
  onContactClick: () => void;
}

export const LandingFooter = ({
  company,
  tagline,
  links,
  copyright,
  onProductsClick,
  onExtensionsClick,
  onContactClick
}: LandingFooterProps) => {
  return (
    <footer className="border-t bg-muted/20">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company Info */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-2 mb-4">
              <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <span className="text-lg font-semibold text-foreground">{company}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {tagline}
            </p>
          </div>

          {/* Quick Links */}
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-4">Link Rapidi</h3>
            <div className="space-y-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onProductsClick}
                className="text-muted-foreground hover:text-foreground"
              >
                {links.products}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
              <br />
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onExtensionsClick}
                className="text-muted-foreground hover:text-foreground"
              >
                {links.extensions}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>

          {/* Contact */}
          <div className="text-center md:text-right">
            <h3 className="font-semibold text-foreground mb-4">Contatti</h3>
            <Button 
              variant="outline"
              size="sm"
              onClick={onContactClick}
            >
              {links.contact}
            </Button>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {copyright}
          </p>
        </div>
      </div>
    </footer>
  );
};
