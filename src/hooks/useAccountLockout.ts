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
}

export const useAccountLockout = (): UseAccountLockoutReturn => {
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus>({
    isLocked: false,
    remainingSeconds: 0,
    failedAttempts: 0,
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check lockout status from database
  const checkLockoutStatus = useCallback(async (username: string) => {
    if (!username.trim()) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_account_lockout_status', {
        p_username: username.trim()
      });

      if (error) {
        console.error('Error checking lockout status:', error);
        return;
      }

      const status: LockoutStatus = {
        isLocked: data.is_locked || false,
        remainingSeconds: Math.max(0, data.remaining_seconds || 0),
        failedAttempts: data.failed_attempts || 0,
        message: data.message || ''
      };

      setLockoutStatus(status);

      // Start countdown timer if account is locked
      if (status.isLocked && status.remainingSeconds > 0) {
        startCountdownTimer(status.remainingSeconds);
      }
    } catch (error) {
      console.error('Exception checking lockout status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset lockout (for successful login or admin override)
  const resetLockout = useCallback(async (username: string) => {
    if (!username.trim()) return;
    
    try {
      const { error } = await supabase.rpc('reset_account_lockout', {
        p_username: username.trim()
      });

      if (error) {
        console.error('Error resetting lockout:', error);
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
    } catch (error) {
      console.error('Exception resetting lockout:', error);
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

  // Check lockout status from localStorage on mount
  useEffect(() => {
    const checkStoredLockout = () => {
      const storedUsername = localStorage.getItem('lockout_username');
      const storedExpiry = localStorage.getItem('lockout_expiry');
      
      if (storedUsername && storedExpiry) {
        const expiryTime = parseInt(storedExpiry);
        const now = Date.now();
        
        if (now < expiryTime) {
          // Still locked, calculate remaining time
          const remainingSeconds = Math.ceil((expiryTime - now) / 1000);
          setLockoutStatus({
            isLocked: true,
            remainingSeconds,
            failedAttempts: parseInt(localStorage.getItem('lockout_attempts') || '0'),
            message: 'Account is currently locked'
          });
          
          // Start countdown timer
          startCountdownTimer(remainingSeconds);
        } else {
          // Lockout expired, clean up storage
          localStorage.removeItem('lockout_username');
          localStorage.removeItem('lockout_expiry');
          localStorage.removeItem('lockout_attempts');
        }
      }
    };

    checkStoredLockout();
  }, [startCountdownTimer]);

  // Store lockout info in localStorage when status changes
  useEffect(() => {
    if (lockoutStatus.isLocked && lockoutStatus.remainingSeconds > 0) {
      const expiryTime = Date.now() + (lockoutStatus.remainingSeconds * 1000);
      localStorage.setItem('lockout_username', 'current'); // We'll update this with actual username when needed
      localStorage.setItem('lockout_expiry', expiryTime.toString());
      localStorage.setItem('lockout_attempts', lockoutStatus.failedAttempts.toString());
    } else if (!lockoutStatus.isLocked) {
      // Clean up storage when not locked
      localStorage.removeItem('lockout_username');
      localStorage.removeItem('lockout_expiry');
      localStorage.removeItem('lockout_attempts');
    }
  }, [lockoutStatus.isLocked, lockoutStatus.remainingSeconds, lockoutStatus.failedAttempts]);

  return {
    lockoutStatus,
    checkLockoutStatus,
    resetLockout,
    isLoading
  };
};
