import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SecurityIcon } from "./SecurityIcon";
import { cn } from "@/lib/utils";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

export const PasswordInput = ({ 
  value, 
  onChange, 
  placeholder = "Enter your password",
  disabled = false,
  className,
  error = false
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "pr-12 transition-all duration-200",
          error && "border-red-300 focus:border-red-400 focus:ring-red-400 dark:border-red-700 dark:focus:border-red-500 dark:focus:ring-red-500",
          className
        )}
        autoComplete="current-password"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-md",
          "hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => setShowPassword(!showPassword)}
        disabled={disabled}
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        <SecurityIcon 
          type={showPassword ? "eye-off" : "eye"} 
          className="w-4 h-4 text-slate-500 dark:text-slate-400" 
        />
      </Button>
    </div>
  );
};