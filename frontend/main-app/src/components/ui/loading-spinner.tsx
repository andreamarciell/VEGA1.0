import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

export const LoadingSpinner = ({ 
  size = "md", 
  className,
  label = "Loading..." 
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  };

  return (
    <div className={cn("flex flex-col items-center space-y-3", className)}>
      <div className="relative">
        {/* Background circle */}
        <div className={cn(
          "border-4 border-slate-200 dark:border-slate-700 rounded-full",
          sizeClasses[size]
        )}></div>
        
        {/* Animated circle */}
        <div className={cn(
          "absolute inset-0 border-4 border-transparent border-t-slate-600 dark:border-t-slate-400 rounded-full animate-spin",
          sizeClasses[size]
        )}></div>
      </div>
      
      {label && (
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {label}
        </p>
      )}
    </div>
  );
};
