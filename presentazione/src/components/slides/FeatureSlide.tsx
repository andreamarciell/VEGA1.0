import React from 'react';
import { motion } from 'framer-motion';
import { Feature } from '../../types';

interface FeatureSlideProps {
  title: string;
  subtitle?: string;
  features: Feature[];
  layout?: 'grid' | 'list' | 'highlight';
}

export const FeatureSlide: React.FC<FeatureSlideProps> = ({ 
  title, 
  subtitle, 
  features, 
  layout = 'grid' 
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  };

  const renderGridLayout = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="feature-grid"
    >
      {features.map((feature, index) => (
        <motion.div
          key={index}
          variants={itemVariants}
          className="feature-card"
        >
          <div className="feature-icon">
            {feature.icon}
          </div>
          <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
          <p className="text-muted-foreground mb-4">{feature.description}</p>
          {feature.details && (
            <ul className="text-sm text-muted-foreground space-y-1">
              {feature.details.map((detail, idx) => (
                <li key={idx} className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      ))}
    </motion.div>
  );

  const renderListLayout = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-6"
    >
      {features.map((feature, index) => (
        <motion.div
          key={index}
          variants={itemVariants}
          className="flex items-start space-x-6 p-6 bg-card rounded-lg border border-border"
        >
          <div className="feature-icon flex-shrink-0">
            {feature.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-semibold mb-2">{feature.title}</h3>
            <p className="text-muted-foreground mb-3">{feature.description}</p>
            {feature.details && (
              <ul className="text-sm text-muted-foreground space-y-1">
                {feature.details.map((detail, idx) => (
                  <li key={idx} className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></span>
                    {detail}
                </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );

  const renderHighlightLayout = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto"
    >
      {features.map((feature, index) => (
        <motion.div
          key={index}
          variants={itemVariants}
          className={`mb-12 p-8 rounded-2xl ${
            index % 2 === 0 
              ? 'bg-gradient-to-r from-primary/5 to-transparent' 
              : 'bg-gradient-to-l from-accent/5 to-transparent'
          }`}
        >
          <div className="flex items-center space-x-6">
            <div className="feature-icon">
              {feature.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold mb-3">{feature.title}</h3>
              <p className="text-lg text-muted-foreground mb-4">{feature.description}</p>
              {feature.details && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {feature.details.map((detail, idx) => (
                    <div key={idx} className="flex items-center text-muted-foreground">
                      <span className="w-2 h-2 bg-primary rounded-full mr-3"></span>
                      {detail}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );

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

        {layout === 'grid' && renderGridLayout()}
        {layout === 'list' && renderListLayout()}
        {layout === 'highlight' && renderHighlightLayout()}
      </div>
    </div>
  );
};
