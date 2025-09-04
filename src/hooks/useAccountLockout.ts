import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
  message: string;
}

export interface UseAccountLockoutReturn {
  lockoutStatus: LockoutStatus;
  checkLockoutStatus: (username: string) => Promise<void>;
  resetLockout: (username: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const useAccountLockout = (): UseAccountLockoutReturn => {
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus>({
    isLocked: false,
    remainingSeconds: 0,
    failedAttempts: 0,
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check lockout status from database with retry logic
  const checkLockoutStatus = useCallback(async (username: string) => {
    if (!username.trim()) {
      // Reset lockout status if no username provided
      setLockoutStatus({
        isLocked: false,
        remainingSeconds: 0,
        failedAttempts: 0,
        message: ''
      });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { data, error: rpcError } = await supabase.rpc('check_account_lockout_status', {
          p_username: username.trim()
        });

        if (rpcError) {
          console.error('Error checking lockout status:', rpcError);
          
          // If it's a network/CSP error, don't retry indefinitely
          if (rpcError.message.includes('Failed to fetch') || rpcError.message.includes('CSP')) {
            console.warn('Network or CSP error detected, using fallback lockout logic');
            setError('Network connectivity issue - using local lockout tracking');
            setIsLoading(false);
            return;
          }
          
          if (retryCount < maxRetries - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            continue;
          }
          
          setError(`Failed to check lockout status: ${rpcError.message}`);
          setIsLoading(false);
          return;
        }

        const status: LockoutStatus = {
          isLocked: data.is_locked || false,
          remainingSeconds: Math.max(0, data.remaining_seconds || 0),
          failedAttempts: data.failed_attempts || 0,
          message: data.message || ''
        };

        setLockoutStatus(status);
        setCurrentStoredUsername(username.trim()); // Set current username for localStorage tracking

        // Start countdown timer if account is locked
        if (status.isLocked && status.remainingSeconds > 0) {
          startCountdownTimer(status.remainingSeconds);
        }
        
        return; // Success, exit retry loop
        
      } catch (error) {
        console.error('Exception checking lockout status:', error);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        
        setError(`Network error: ${error.message}`);
        return;
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  // Reset lockout (for successful login or admin override) with retry logic
  const resetLockout = useCallback(async (username: string) => {
    if (!username.trim()) return;
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { error: rpcError } = await supabase.rpc('reset_account_lockout', {
          p_username: username.trim()
        });

        if (rpcError) {
          console.error('Error resetting lockout:', rpcError);
          
          if (retryCount < maxRetries - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
          
          setError(`Failed to reset lockout: ${rpcError.message}`);
          return;
        }

        // Clear timer and reset status
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        setLockoutStatus({
          isLocked: false,
          remainingSeconds: 0,
          failedAttempts: 0,
          message: ''
        });
        
        return; // Success, exit retry loop
        
      } catch (error) {
        console.error('Exception resetting lockout:', error);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        
        setError(`Network error: ${error.message}`);
        return;
      }
    }
  }, []);

  // Start countdown timer
  const startCountdownTimer = useCallback((initialSeconds: number) => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    let remainingSeconds = initialSeconds;
    
    timerRef.current = setInterval(() => {
      remainingSeconds--;
      
      if (remainingSeconds <= 0) {
        // Timer finished, clear interval and update status
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        setLockoutStatus(prev => ({
          ...prev,
          isLocked: false,
          remainingSeconds: 0,
          message: 'Account lockout has expired'
        }));
      } else {
        // Update remaining seconds
        setLockoutStatus(prev => ({
          ...prev,
          remainingSeconds
        }));
      }
    }, 1000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Clean up expired localStorage entries on mount
  useEffect(() => {
    const cleanupExpiredLockouts = () => {
      // Clean up any expired lockout entries from localStorage
      const keys = Object.keys(localStorage);
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith('lockout_expiry_')) {
          const expiryTime = parseInt(localStorage.getItem(key) || '0');
          if (expiryTime > 0 && now >= expiryTime) {
            const username = key.replace('lockout_expiry_', '');
            localStorage.removeItem(`lockout_username_${username}`);
            localStorage.removeItem(`lockout_expiry_${username}`);
            localStorage.removeItem(`lockout_attempts_${username}`);
          }
        }
      });
    };

    cleanupExpiredLockouts();
  }, []);

  // Store lockout info in localStorage when status changes (with current username tracking)
  const [currentStoredUsername, setCurrentStoredUsername] = useState<string>('');
  
  useEffect(() => {
    if (lockoutStatus.isLocked && lockoutStatus.remainingSeconds > 0 && currentStoredUsername) {
      const expiryTime = Date.now() + (lockoutStatus.remainingSeconds * 1000);
      localStorage.setItem(`lockout_username_${currentStoredUsername}`, currentStoredUsername);
      localStorage.setItem(`lockout_expiry_${currentStoredUsername}`, expiryTime.toString());
      localStorage.setItem(`lockout_attempts_${currentStoredUsername}`, lockoutStatus.failedAttempts.toString());
    } else if (!lockoutStatus.isLocked && currentStoredUsername) {
      // Clean up storage when not locked for current username
      localStorage.removeItem(`lockout_username_${currentStoredUsername}`);
      localStorage.removeItem(`lockout_expiry_${currentStoredUsername}`);
      localStorage.removeItem(`lockout_attempts_${currentStoredUsername}`);
    }
  }, [lockoutStatus.isLocked, lockoutStatus.remainingSeconds, lockoutStatus.failedAttempts, currentStoredUsername]);

  return {
    lockoutStatus,
    checkLockoutStatus,
    resetLockout,
    isLoading,
    error
  };
};
