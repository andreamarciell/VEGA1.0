// Input validation system for secure user input handling
export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  sanitizedValue: string;
}

export class InputValidator {
  private static readonly USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;
  private static readonly PASSWORD_MIN_LENGTH = 8;
  private static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  /**
   * Advanced string sanitization
   */
  static sanitizeString(input: string, maxLength: number = 100): string {
    if (!input) return '';
    
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>\"'&]/g, '') // Remove dangerous characters
      .replace(/\s+/g, ' '); // Normalize spaces
  }
  
  /**
   * Validate username with backward compatibility
   */
  static validateUsername(username: string): ValidationResult {
    if (!username || username.trim().length === 0) {
      return {
        isValid: false,
        error: 'Username is required',
        sanitizedValue: ''
      };
    }
    
    const sanitized = this.sanitizeString(username, 50); // Increased for compatibility
    
    if (sanitized.length < 3) {
      return {
        isValid: false,
        error: 'Username must be at least 3 characters long',
        sanitizedValue: sanitized
      };
    }
    
    if (sanitized.length > 50) {
      return {
        isValid: false,
        error: 'Username must be no more than 50 characters long',
        sanitizedValue: sanitized
      };
    }
    
    // More permissive pattern for existing users
    const permissivePattern = /^[a-zA-Z0-9_.-@+]{3,50}$/;
    if (!permissivePattern.test(sanitized)) {
      return {
        isValid: false,
        error: 'Username contains invalid characters',
        sanitizedValue: sanitized
      };
    }
    
    return {
      isValid: true,
      error: null,
      sanitizedValue: sanitized
    };
  }
  
  /**
   * Validate password - less strict for existing users
   */
  static validatePassword(password: string): ValidationResult {
    if (!password || password.length === 0) {
      return {
        isValid: false,
        error: 'Password is required',
        sanitizedValue: ''
      };
    }
    
    // Basic validation for compatibility
    if (password.length < this.PASSWORD_MIN_LENGTH) {
      return {
        isValid: false,
        error: `Password must be at least ${this.PASSWORD_MIN_LENGTH} characters long`,
        sanitizedValue: password
      };
    }
    
    // Password stays as-is for login, no sanitization
    return {
      isValid: true,
      error: null,
      sanitizedValue: password
    };
  }
  
  /**
   * Validate email
   */
  static validateEmail(email: string): ValidationResult {
    if (!email || email.trim().length === 0) {
      return {
        isValid: false,
        error: 'Email is required',
        sanitizedValue: ''
      };
    }
    
    const sanitized = this.sanitizeString(email, 254);
    
    if (!this.EMAIL_PATTERN.test(sanitized)) {
      return {
        isValid: false,
        error: 'Please enter a valid email address',
        sanitizedValue: sanitized
      };
    }
    
    return {
      isValid: true,
      error: null,
      sanitizedValue: sanitized
    };
  }
  
  /**
   * Validate new password with stronger requirements
   */
  static validateNewPassword(password: string): ValidationResult {
    if (!password || password.length === 0) {
      return {
        isValid: false,
        error: 'Password is required',
        sanitizedValue: ''
      };
    }
    
    if (password.length < 12) {
      return {
        isValid: false,
        error: 'New password must be at least 12 characters long',
        sanitizedValue: password
      };
    }
    
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return {
        isValid: false,
        error: 'New password must contain uppercase, lowercase, number, and special character',
        sanitizedValue: password
      };
    }
    
    return {
      isValid: true,
      error: null,
      sanitizedValue: password
    };
  }
}

/**
 * Legacy compatibility function
 */
export const sanitizeInput = (input: string): string => {
  return InputValidator.sanitizeString(input);
};

/**
 * Legacy compatibility function
 */
export const validateCredentials = (credentials: { username: string; password: string }): { isValid: boolean; error: string | null } => {
  const usernameValidation = InputValidator.validateUsername(credentials.username);
  if (!usernameValidation.isValid) {
    return { isValid: false, error: usernameValidation.error };
  }
  
  const passwordValidation = InputValidator.validatePassword(credentials.password);
  if (!passwordValidation.isValid) {
    return { isValid: false, error: passwordValidation.error };
  }
  
  return { isValid: true, error: null };
};
