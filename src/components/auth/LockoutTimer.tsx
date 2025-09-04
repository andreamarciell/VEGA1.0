import { useEffect, useState, useRef } from 'react';
import { SecurityIcon } from '../SecurityIcon';

interface LockoutTimerProps {
  remainingSeconds: number;
  failedAttempts: number;
  onExpired: () => void;
}

export const LockoutTimer = ({ remainingSeconds, failedAttempts, onExpired }: LockoutTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(remainingSeconds);
  const [hasExpired, setHasExpired] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any existing timer
  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Update timeLeft when remainingSeconds prop changes and restart timer
  useEffect(() => {
    setTimeLeft(remainingSeconds);
    if (remainingSeconds > 0) {
      setHasExpired(false);
    }
    
    // Clear and restart timer when new remainingSeconds is provided
    clearTimer();
    
    if (remainingSeconds > 0 && !hasExpired) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            setHasExpired(true);
            onExpired();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return clearTimer;
  }, [remainingSeconds, hasExpired, onExpired]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, []);

  const formatTime = (seconds: number): string => {
    // Ensure we always show integers, no decimals
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    
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
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full border-4 transition-all duration-500 ${
            hasExpired 
              ? 'bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800'
              : 'bg-red-100 dark:bg-red-900/50 border-red-200 dark:border-red-800'
          }`}>
            <div className="text-center">
              {hasExpired ? (
                <>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                    ✓
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    unlocked
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">
                    remaining
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Warning/Success Message */}
        <div className={`rounded-lg p-3 mb-4 ${
          hasExpired 
            ? 'bg-green-200 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
            : 'bg-red-200 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
        }`}>
          <div className="flex items-start space-x-2">
            <SecurityIcon 
              type={hasExpired ? "shield" : "shield"} 
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                hasExpired 
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} 
            />
            <div className={`text-sm ${
              hasExpired 
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}>
              <p className="font-medium">
                {hasExpired ? 'Account Unlocked' : 'Security Notice'}
              </p>
              <p className="text-xs mt-1 opacity-90">
                {hasExpired 
                  ? 'Your account lockout has expired. You can now return to the login page and try again.'
                  : (failedAttempts >= 6 
                    ? 'Your account has been locked due to multiple failed login attempts. This is a security measure to protect your account.'
                    : 'Please wait for the lockout to expire before attempting to log in again.'
                  )
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
          <p className={`text-xs ${
            hasExpired 
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {hasExpired 
              ? 'Account successfully unlocked! You can now login again.'
              : 'Your account will automatically unlock when the timer reaches zero'
            }
          </p>
        </div>
      </div>
    </div>
  );
};
