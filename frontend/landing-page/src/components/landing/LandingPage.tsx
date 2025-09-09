import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";

// Import components
import { Hero } from "./Hero";
import { ValueList } from "./ValueList";
import { ProductGrid } from "./ProductGrid";
import { Solutions } from "./Solutions";
import { TechnologiesSection } from "./TechnologiesSection";
import { Testimonials } from "./Testimonials";
import { CTASection } from "./CTASection";
import { LandingFooter } from "./LandingFooter";

// Import content
import { landingContent } from "@/content/landing.it";

export const LandingPage = () => {
  const handleLogin = () => {
    // For standalone landing page, redirect to main app login
    window.open('https://your-main-app.netlify.app/auth/login', '_blank');
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
    // For standalone landing page, redirect to main app extensions
    window.open('https://your-main-app.netlify.app/extensions', '_blank');
  };

  const handleDetailsClick = (route: string) => {
    // For standalone landing page, redirect to main app
    window.open(`https://your-main-app.netlify.app${route}`, '_blank');
  };

  const handleExternalClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div 
            className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">Toppery</span>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              onClick={handleLogin} 
              variant="default" 
              size="sm"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
            >
              Login
            </Button>
          </motion.div>
        </div>
      </motion.header>

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

      {/* Technologies */}
      <TechnologiesSection
        title={landingContent.technologies.title}
        subtitle={landingContent.technologies.subtitle}
        description={landingContent.technologies.description}
        features={landingContent.technologies.features}
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