import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";

// Import components
import { Hero } from "./Hero";
import { ValueList } from "./ValueList";
import { ProductGrid } from "./ProductGrid";
import { Solutions } from "./Solutions";
import { Ecosystem } from "./Ecosystem";
import { Testimonials } from "./Testimonials";
import { CTASection } from "./CTASection";
import { LandingFooter } from "./LandingFooter";

// Import content
import { landingContent } from "@/content/landing.it";

export const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const session = await getCurrentSession();
        if (session) {
          // L'utente è loggato, reindirizza alla dashboard
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Errore nel controllo dell\'autenticazione:', error);
      }
    };

    checkAuthAndRedirect();
  }, [navigate]);

  const handleLogin = () => {
    navigate('/auth/login');
  };

  const handleProductsClick = () => {
    // Scroll to products section
    const element = document.getElementById('prodotti');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleContactClick = () => {
    // TODO: Implement contact functionality
    console.log('Contact clicked');
  };

  const handleExtensionsClick = () => {
    navigate('/extensions');
  };

  const handleDetailsClick = (route: string) => {
    navigate(route);
  };

  const handleExternalClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-semibold text-foreground">Toppery</span>
          </div>
          
          <Button onClick={handleLogin} variant="default" size="sm">
            Login
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <Hero
        headline={landingContent.hero.headline}
        subheadline={landingContent.hero.subheadline}
        primaryCta={landingContent.hero.primaryCta}
        secondaryCta={landingContent.hero.secondaryCta}
        loginCta={landingContent.hero.loginCta}
        onPrimaryCta={handleProductsClick}
        onSecondaryCta={handleContactClick}
        onLoginCta={handleLogin}
      />

      {/* Value Proposition */}
      <ValueList
        title={landingContent.valueProposition.title}
        subtitle={landingContent.valueProposition.subtitle}
        features={landingContent.valueProposition.features}
      />

      {/* Products Grid */}
      <ProductGrid
        title={landingContent.products.title}
        subtitle={landingContent.products.subtitle}
        onDetailsClick={handleDetailsClick}
        onLoginClick={handleLogin}
        onExternalClick={handleExternalClick}
      />

      {/* Solutions */}
      <Solutions
        title={landingContent.solutions.title}
        subtitle={landingContent.solutions.subtitle}
        cards={landingContent.solutions.cards}
      />

      {/* Ecosystem */}
      <Ecosystem
        title={landingContent.ecosystem.title}
        subtitle={landingContent.ecosystem.subtitle}
        description={landingContent.ecosystem.description}
        integrations={landingContent.ecosystem.integrations}
      />

      {/* Testimonials */}
      <Testimonials
        title={landingContent.testimonials.title}
        subtitle={landingContent.testimonials.subtitle}
        items={landingContent.testimonials.items}
      />

      {/* CTA Section */}
      <CTASection
        title={landingContent.cta.title}
        subtitle={landingContent.cta.subtitle}
        primaryCta={landingContent.cta.primaryCta}
        secondaryCta={landingContent.cta.secondaryCta}
        loginCta={landingContent.cta.loginCta}
        onPrimaryCta={handleProductsClick}
        onSecondaryCta={handleContactClick}
        onLoginCta={handleLogin}
      />

      {/* Footer */}
      <LandingFooter
        company={landingContent.footer.company}
        tagline={landingContent.footer.tagline}
        links={landingContent.footer.links}
        copyright={landingContent.footer.copyright}
        onProductsClick={handleProductsClick}
        onExtensionsClick={handleExtensionsClick}
        onContactClick={handleContactClick}
      />
    </div>
  );
};
