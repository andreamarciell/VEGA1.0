import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePresentation } from '../../hooks/usePresentation';
import { PresentationControls } from './PresentationControls';
import { slides } from '../../slides';

export const Presentation: React.FC = () => {
  const {
    currentSlide,
    isFullscreen,
    isPlaying,
    nextSlide,
    prevSlide,
    goToSlide,
    toggleFullscreen,
    togglePlay,
  } = usePresentation(slides.length);

  const currentSlideData = slides[currentSlide];

  return (
    <div className={`min-h-screen bg-background ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="w-full h-full"
        >
          {currentSlideData.content}
        </motion.div>
      </AnimatePresence>

      <PresentationControls
        currentSlide={currentSlide}
        totalSlides={slides.length}
        isFullscreen={isFullscreen}
        isPlaying={isPlaying}
        onNext={nextSlide}
        onPrev={prevSlide}
        onToggleFullscreen={toggleFullscreen}
        onTogglePlay={togglePlay}
        onGoToSlide={goToSlide}
        onGoToStart={() => goToSlide(0)}
      />

      {/* Keyboard shortcuts help */}
      {!isFullscreen && (
        <div className="fixed top-4 right-4 bg-card/80 backdrop-blur-md border border-border rounded-lg p-4 text-sm text-muted-foreground z-40 max-w-xs">
          <div className="space-y-1">
            <div><kbd className="px-2 py-1 bg-muted rounded text-xs">←</kbd> <kbd className="px-2 py-1 bg-muted rounded text-xs">→</kbd> Navigate</div>
            <div><kbd className="px-2 py-1 bg-muted rounded text-xs">F</kbd> Fullscreen</div>
            <div><kbd className="px-2 py-1 bg-muted rounded text-xs">P</kbd> Play/Pause</div>
            <div><kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd> Exit</div>
          </div>
        </div>
      )}
    </div>
  );
};
