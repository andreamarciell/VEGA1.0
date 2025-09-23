import React from 'react';
import { motion } from 'framer-motion';

interface ContentSlideProps {
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  layout?: 'centered' | 'left' | 'right' | 'two-column';
}

export const ContentSlide: React.FC<ContentSlideProps> = ({ 
  title, 
  subtitle, 
  content, 
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
          className="text-center mb-12"
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
          {content}
        </motion.div>
      </div>
    </div>
  );
};
