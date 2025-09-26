import React from 'react';
import { motion } from 'framer-motion';

interface ImageSlideProps {
  title: string;
  subtitle?: string;
  imagePath: string;
  imageAlt: string;
  description?: string;
  layout?: 'centered' | 'left' | 'right' | 'two-column';
}

export const ImageSlide: React.FC<ImageSlideProps> = ({ 
  title, 
  subtitle, 
  imagePath,
  imageAlt,
  description,
  layout = 'centered' 
}) => {
  const getLayoutClasses = () => {
    switch (layout) {
      case 'left':
        return 'text-left max-w-4xl mx-auto';
      case 'right':
        return 'text-right max-w-4xl mx-auto';
      case 'two-column':
        return 'text-left max-w-6xl mx-auto';
      default:
        return 'text-center max-w-4xl mx-auto';
    }
  };

  return (
    <div className="presentation-slide">
      <div className="slide-content">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="slide-title">{title}</h1>
          {subtitle && (
            <p className="slide-subtitle">{subtitle}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className={getLayoutClasses()}
        >
          <div className="space-y-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200"
            >
              <img 
                src={imagePath} 
                alt={imageAlt}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            </motion.div>
            
            {description && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="text-lg text-muted-foreground max-w-3xl mx-auto"
              >
                {description}
              </motion.p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
