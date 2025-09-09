// Secure Cookie Management for Admin Sessions
// This replaces localStorage for sensitive session data

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  maxAge?: number; // seconds
  path?: string;
  domain?: string;
}

export class SecureCookieManager {
  private static readonly DEFAULT_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: true, // Only over HTTPS
    sameSite: 'Strict',
    path: '/',
    maxAge: 86400 // 24 hours
  };

  /**
   * Set a secure cookie (Note: httpOnly cookies can only be set by server)
   * This is a client-side implementation with maximum security available to browser
   */
  static setSecureCookie(name: string, value: string, options: Partial<CookieOptions> = {}): void {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    let cookieString = `${name}=${encodeURIComponent(value)}`;
    
    if (opts.maxAge !== undefined) {
      cookieString += `; Max-Age=${opts.maxAge}`;
    }
    
    if (opts.path) {
      cookieString += `; Path=${opts.path}`;
    }
    
    if (opts.domain) {
      cookieString += `; Domain=${opts.domain}`;
    }
    
    if (opts.secure) {
      cookieString += '; Secure';
    }
    
    if (opts.sameSite) {
      cookieString += `; SameSite=${opts.sameSite}`;
    }
    
    // Note: We cannot set HttpOnly from client-side JavaScript
    // This will be handled by the server-side admin login endpoint
    
    document.cookie = cookieString;
  }

  /**
   * Get cookie value
   */
  static getCookie(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  }

  /**
   * Delete cookie
   */
  static deleteCookie(name: string, path: string = '/'): void {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
  }

  /**
   * Check if cookies are enabled
   */
  static areCookiesEnabled(): boolean {
    try {
      const testCookieName = '__test_cookie__';
      this.setSecureCookie(testCookieName, 'test', { maxAge: 1 });
      const cookieEnabled = this.getCookie(testCookieName) === 'test';
      this.deleteCookie(testCookieName);
      return cookieEnabled;
    } catch (e) {
      return false;
    }
  }

  /**
   * Set admin session with maximum security
   */
  static setAdminSession(sessionToken: string): void {
    // Primary storage: Secure cookie
    this.setSecureCookie('admin_session', sessionToken, {
      secure: window.location.protocol === 'https:',
      sameSite: 'Strict',
      maxAge: 7200, // 2 hours
      path: '/'
    });

    // Fallback: sessionStorage (cleared on tab close)
    try {
      sessionStorage.setItem('admin_session_backup', sessionToken);
    } catch (e) {
      console.warn('SessionStorage not available');
    }
  }

  /**
   * Get admin session with fallback
   */
  static getAdminSession(): string | null {
    // Try cookie first
    let sessionToken = this.getCookie('admin_session');
    
    // Fallback to sessionStorage if cookie not available
    if (!sessionToken) {
      try {
        sessionToken = sessionStorage.getItem('admin_session_backup');
      } catch (e) {
        // SessionStorage not available
      }
    }

    return sessionToken;
  }

  /**
   * Clear admin session completely
   */
  static clearAdminSession(): void {
    // Clear cookie
    this.deleteCookie('admin_session');
    
    // Clear sessionStorage backup
    try {
      sessionStorage.removeItem('admin_session_backup');
    } catch (e) {
      // SessionStorage not available
    }

    // Clear any localStorage remnants
    try {
      localStorage.removeItem('admin_session_token');
    } catch (e) {
      // localStorage not available
    }
  }
}

// Export convenience functions
export const setAdminSession = (token: string) => SecureCookieManager.setAdminSession(token);
export const getAdminSession = () => SecureCookieManager.getAdminSession();
export const clearAdminSession = () => SecureCookieManager.clearAdminSession();
