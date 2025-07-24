import { Shield, Lock, Eye, EyeOff } from "lucide-react";

interface SecurityIconProps {
  type: 'shield' | 'lock' | 'eye' | 'eye-off';
  className?: string;
}

export const SecurityIcon = ({ type, className = "w-5 h-5" }: SecurityIconProps) => {
  const icons = {
    shield: Shield,
    lock: Lock,
    eye: Eye,
    'eye-off': EyeOff
  };

  const Icon = icons[type];
  return <Icon className={className} />;
};