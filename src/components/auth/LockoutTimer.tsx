import { useEffect, useState } from 'react';
import { SecurityIcon } from '../SecurityIcon';

interface LockoutTimerProps {
  remainingSeconds: number;
  failedAttempts: number;
  onExpired: () => void;
}

export const LockoutTimer = ({ remainingSeconds, failedAttempts, onExpired }: LockoutTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(remainingSeconds);

  useEffect(() => {
    setTimeLeft(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpired();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onExpired]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  const getLockoutMessage = (attempts: number): string => {
    if (attempts >= 9) {
      return 'Account locked for 15 minutes due to excessive failed attempts';
    } else if (attempts >= 6) {
      return 'Account locked for 5 minutes due to multiple failed attempts';
    } else if (attempts >= 3) {
      return 'Account locked for 30 seconds due to failed attempts';
    }
    return 'Account is temporarily locked';
  };

  const getProgressColor = (attempts: number): string => {
    if (attempts >= 9) return 'bg-red-500';
    if (attempts >= 6) return 'bg-orange-500';
    return 'bg-amber-500';
  };

  const getProgressWidth = (attempts: number): string => {
    if (attempts >= 9) return 'w-full';
    if (attempts >= 6) return 'w-2/3';
    return 'w-1/3';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0">
            <SecurityIcon 
              type="lock" 
              className="w-6 h-6 text-red-600 dark:text-red-400" 
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
              Account Locked
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              {getLockoutMessage(failedAttempts)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-red-600 dark:text-red-400 mb-2">
            <span>Security Level</span>
            <span>{failedAttempts}/9 attempts</span>
          </div>
          <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full ${getProgressColor(failedAttempts)} transition-all duration-300 ease-out ${getProgressWidth(failedAttempts)}`}
            />
          </div>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/50 rounded-full border-4 border-red-200 dark:border-red-800">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {formatTime(timeLeft)}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                remaining
              </div>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div className="bg-red-200 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3 mb-4">
          <div className="flex items-start space-x-2">
            <SecurityIcon 
              type="shield" 
              className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" 
            />
            <div className="text-sm text-red-800 dark:text-red-200">
              <p className="font-medium">Security Notice</p>
              <p className="text-xs mt-1 opacity-90">
                {failedAttempts >= 6 
                  ? 'Your account has been locked due to multiple failed login attempts. This is a security measure to protect your account.'
                  : 'Please wait for the lockout to expire before attempting to log in again.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Attempt Counter */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-sm text-red-700 dark:text-red-300">
              {failedAttempts} failed attempt{failedAttempts === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Auto-unlock Notice */}
        <div className="text-center mt-4">
          <p className="text-xs text-red-600 dark:text-red-400">
            Your account will automatically unlock when the timer reaches zero
          </p>
        </div>
      </div>
    </div>
  );
};
