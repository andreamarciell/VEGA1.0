import { ProductCard } from "./ProductCard";
import { getAllProducts } from "@/content/landing.it";

interface ProductGridProps {
  title: string;
  subtitle: string;
  onDetailsClick: (route: string) => void;
  onLoginClick: () => void;
  onExternalClick: (url: string) => void;
}

export const ProductGrid = ({
  title,
  subtitle,
  onDetailsClick,
  onLoginClick,
  onExternalClick
}: ProductGridProps) => {
  const products = getAllProducts();

  return (
    <section id="prodotti" className="container mx-auto px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            {title}
          </h2>
          <p className="text-xl text-muted-foreground font-light">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              title={product.title}
              description={product.description}
              category={product.category}
              icon={product.icon}
              color={product.color}
              features={product.features}
              hasLogin={product.hasLogin}
              route={product.route}
              externalUrl={product.externalUrl}
              onDetailsClick={onDetailsClick}
              onLoginClick={onLoginClick}
              onExternalClick={onExternalClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
