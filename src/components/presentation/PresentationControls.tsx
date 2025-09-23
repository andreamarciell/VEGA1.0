import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Maximize, 
  Minimize,
  Home,
  RotateCcw
} from 'lucide-react';

interface PresentationControlsProps {
  currentSlide: number;
  totalSlides: number;
  isFullscreen: boolean;
  isPlaying: boolean;
  onNext: () => void;
  onPrev: () => void;
  onToggleFullscreen: () => void;
  onTogglePlay: () => void;
  onGoToSlide: (index: number) => void;
  onGoToStart: () => void;
}

export const PresentationControls: React.FC<PresentationControlsProps> = ({
  currentSlide,
  totalSlides,
  isFullscreen,
  isPlaying,
  onNext,
  onPrev,
  onToggleFullscreen,
  onTogglePlay,
  onGoToSlide,
  onGoToStart,
}) => {
  return (
    <div className="navigation-controls">
      <button
        onClick={onGoToStart}
        className="p-2 hover:bg-accent rounded-full transition-colors"
        title="Go to start (Home)"
      >
        <Home className="w-4 h-4" />
      </button>
      
      <button
        onClick={onPrev}
        disabled={currentSlide === 0}
        className="p-2 hover:bg-accent rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Previous slide (←)"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        onClick={onTogglePlay}
        className="p-2 hover:bg-accent rounded-full transition-colors"
        title={isPlaying ? "Pause (P)" : "Play (P)"}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      <button
        onClick={onNext}
        disabled={currentSlide === totalSlides - 1}
        className="p-2 hover:bg-accent rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Next slide (→ or Space)"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <button
        onClick={onToggleFullscreen}
        className="p-2 hover:bg-accent rounded-full transition-colors"
        title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>

      {/* Slide indicators */}
      <div className="flex items-center space-x-2 ml-4 pl-4 border-l border-border">
        {Array.from({ length: totalSlides }, (_, index) => (
          <button
            key={index}
            onClick={() => onGoToSlide(index)}
            className={`slide-indicator ${
              index === currentSlide ? 'active' : ''
            } ${
              index < currentSlide ? 'completed' : ''
            }`}
            title={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="ml-4 pl-4 border-l border-border text-sm text-muted-foreground">
        {currentSlide + 1} / {totalSlides}
      </div>
    </div>
  );
};
