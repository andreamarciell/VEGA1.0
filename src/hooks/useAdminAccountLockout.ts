import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminLockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
  message: string;
}

export interface UseAdminAccountLockoutReturn {
  lockoutStatus: AdminLockoutStatus;
  checkLockoutStatus: (nickname: string) => Promise<AdminLockoutStatus | null>;
  clearLockoutState: () => void;
  isLoading: boolean;
  error: string | null;
}

export const useAdminAccountLockout = (): UseAdminAccountLockoutReturn => {
  const [lockoutStatus, setLockoutStatus] = useState<AdminLockoutStatus>({
    isLocked: false,
    remainingSeconds: 0,
    failedAttempts: 0,
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentStoredNickname, setCurrentStoredNickname] = useState<string>('');

  // Check lockout status from database with retry logic
  const checkLockoutStatus = useCallback(async (nickname: string): Promise<AdminLockoutStatus | null> => {
    if (!nickname.trim()) {
      // Reset lockout status if no nickname provided
      const resetStatus = {
        isLocked: false,
        remainingSeconds: 0,
        failedAttempts: 0,
        message: ''
      };
      setLockoutStatus(resetStatus);
      return resetStatus;
    }
    
    setIsLoading(true);
    setError(null);
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { data, error: rpcError } = await supabase.rpc('check_admin_account_lockout_status', {
          p_nickname: nickname.trim()
        });

        if (rpcError) {
          console.error('Error checking admin lockout status:', rpcError);
          
          // If it's a network/CSP error, don't retry indefinitely
          if (rpcError.message.includes('Failed to fetch') || rpcError.message.includes('CSP')) {
            console.warn('Network or CSP error detected, using fallback admin lockout logic');
            setError('Network connectivity issue - using local admin lockout tracking');
            setIsLoading(false);
            return null;
          }
          
          if (retryCount < maxRetries - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            continue;
          }
          
          setError(`Failed to check admin lockout status: ${rpcError.message}`);
          setIsLoading(false);
          return null;
        }

        const status: AdminLockoutStatus = {
          isLocked: data.is_locked || false,
          remainingSeconds: Math.max(0, data.remaining_seconds || 0),
          failedAttempts: data.failed_attempts || 0,
          message: data.message || ''
        };

        setLockoutStatus(status);
        setCurrentStoredNickname(nickname.trim()); // Set current nickname for localStorage tracking

        // Start countdown timer if account is locked and we have time remaining
        if (status.isLocked && status.remainingSeconds > 0) {
          startCountdownTimer(status.remainingSeconds);
        } else if (!status.isLocked || status.remainingSeconds <= 0) {
          // Account is not locked or timer has expired, clear any existing timers
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
        
        setIsLoading(false);
        return status; // Return the fresh status
        
      } catch (error) {
        console.error('Network error checking admin lockout status:', error);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          continue;
        }
        
        setError('Network error - unable to verify admin lockout status');
        setIsLoading(false);
        return null;
      }
    }
    
    setIsLoading(false);
    return null;
  }, []);

  // Start countdown timer for UI updates
  const startCountdownTimer = useCallback((initialSeconds: number) => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    let remainingSeconds = initialSeconds;
    
    timerRef.current = setInterval(() => {
      remainingSeconds -= 1;
      
      if (remainingSeconds <= 0) {
        // Timer expired, unlock the account
        setLockoutStatus(prev => ({
          ...prev,
          isLocked: false,
          remainingSeconds: 0,
          message: ''
        }));
        
        // Clear localStorage
        if (currentStoredNickname) {
          localStorage.removeItem(`admin_lockout_${currentStoredNickname}`);
        }
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        // Update remaining seconds in state
        setLockoutStatus(prev => ({
          ...prev,
          remainingSeconds
        }));
        
        // Update localStorage for persistence
        if (currentStoredNickname) {
          const lockoutData = {
            isLocked: true,
            remainingSeconds,
            failedAttempts: lockoutStatus.failedAttempts,
            message: lockoutStatus.message,
            expiresAt: Date.now() + (remainingSeconds * 1000)
          };
          localStorage.setItem(`admin_lockout_${currentStoredNickname}`, JSON.stringify(lockoutData));
        }
      }
    }, 1000);
  }, [currentStoredNickname, lockoutStatus.failedAttempts, lockoutStatus.message]);

  // Load lockout state from localStorage on mount or when nickname changes
  const loadFromLocalStorage = useCallback((nickname: string) => {
    if (!nickname.trim()) return;
    
    try {
      const stored = localStorage.getItem(`admin_lockout_${nickname.trim()}`);
      if (!stored) return;
      
      const lockoutData = JSON.parse(stored);
      const now = Date.now();
      
      if (lockoutData.expiresAt && now < lockoutData.expiresAt) {
        // Lockout is still active
        const remainingSeconds = Math.floor((lockoutData.expiresAt - now) / 1000);
        
        const status = {
          isLocked: true,
          remainingSeconds,
          failedAttempts: lockoutData.failedAttempts || 0,
          message: lockoutData.message || 'Admin account is locked'
        };
        
        setLockoutStatus(status);
        setCurrentStoredNickname(nickname.trim());
        
        // Start the countdown timer
        if (remainingSeconds > 0) {
          startCountdownTimer(remainingSeconds);
        }
      } else {
        // Lockout has expired, clean up
        localStorage.removeItem(`admin_lockout_${nickname.trim()}`);
      }
    } catch (error) {
      console.error('Error loading admin lockout from localStorage:', error);
      localStorage.removeItem(`admin_lockout_${nickname.trim()}`);
    }
  }, [startCountdownTimer]);

  // Clear lockout state
  const clearLockoutState = useCallback(() => {
    setLockoutStatus({
      isLocked: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      message: ''
    });
    setError(null);
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Clear localStorage
    if (currentStoredNickname) {
      localStorage.removeItem(`admin_lockout_${currentStoredNickname}`);
    }
    
    setCurrentStoredNickname('');
  }, [currentStoredNickname]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    lockoutStatus,
    checkLockoutStatus,
    clearLockoutState,
    isLoading,
    error
  };
};
