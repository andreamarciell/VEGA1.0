import { ProductCard } from "./ProductCard";
import { getAllProducts } from "@/content/landing.it";
import { motion } from "framer-motion";

interface ProductGridProps {
  title: string;
  subtitle: string;
  onDetailsClick: (route: string) => void;
  onLoginClick: () => void;
  onExternalClick: (url: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: "easeOut"
    }
  }
};

export const ProductGrid = ({
  title,
  subtitle,
  onDetailsClick,
  onLoginClick,
  onExternalClick
}: ProductGridProps) => {
  const products = getAllProducts();

  return (
    <section id="prodotti" className="container mx-auto px-6 py-32">
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
          {products.map((product) => (
            <motion.div
              key={product.id}
              variants={itemVariants}
            >
              <ProductCard
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
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
