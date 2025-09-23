export interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  type: 'title' | 'content' | 'feature' | 'demo' | 'conclusion';
}

export interface PresentationState {
  currentSlide: number;
  totalSlides: number;
  isFullscreen: boolean;
  isPlaying: boolean;
}

export interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  details?: string[];
}

export interface Extension {
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  url: string;
}
