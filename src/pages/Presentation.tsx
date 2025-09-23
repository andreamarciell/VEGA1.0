import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ExternalLink, Presentation as PresentationIcon } from 'lucide-react';
import { Presentation as PresentationComponent } from '@/components/presentation/Presentation';

const Presentation = () => {
  return <PresentationComponent />;
};

export default Presentation;
