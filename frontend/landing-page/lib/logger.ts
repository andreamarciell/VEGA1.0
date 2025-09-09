// Secure logging system with environment-based configuration
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogContext {
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  [key: string]: any;
}

export class SecureLogger {
  private static instance: SecureLogger;
  private logLevel: LogLevel;
  
  private constructor() {
    // Use environment variable or default to WARN in production
    const envLogLevel = process.env.NODE_ENV === 'production' ? 'WARN' : 'DEBUG';
    const configLogLevel = process.env.LOG_LEVEL || envLogLevel;
    
    switch (configLogLevel.toUpperCase()) {
      case 'ERROR':
        this.logLevel = LogLevel.ERROR;
        break;
      case 'WARN':
        this.logLevel = LogLevel.WARN;
        break;
      case 'INFO':
        this.logLevel = LogLevel.INFO;
        break;
      case 'DEBUG':
        this.logLevel = LogLevel.DEBUG;
        break;
      default:
        this.logLevel = LogLevel.WARN;
    }
  }
  
  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }
  
  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const env = process.env.NODE_ENV || 'development';
    
    if (context) {
      // Sanitize context to remove sensitive data
      const sanitizedContext = this.sanitizeContext(context);
      return `[${timestamp}] [${env}] [${level}] ${message} | ${JSON.stringify(sanitizedContext)}`;
    }
    
    return `[${timestamp}] [${env}] [${level}] ${message}`;
  }
  
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };
    
    // Remove sensitive data
    const sensitiveKeys = ['password', 'token', 'session', 'secret', 'key', 'auth'];
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 100) {
        sanitized[key] = sanitized[key].substring(0, 97) + '...';
      }
    });
    
    return sanitized;
  }
  
  error(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, context));
    }
  }
  
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }
  
  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }
  
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }
  
  /**
   * Log security events with automatic sanitization
   */
  security(event: string, context: LogContext = {}): void {
    const securityContext = {
      ...context,
      eventType: 'security',
      timestamp: new Date().toISOString()
    };
    
    this.warn(`SECURITY: ${event}`, securityContext);
  }
  
  /**
   * Log authentication events
   */
  auth(event: string, context: LogContext = {}): void {
    const authContext = {
      ...context,
      eventType: 'authentication',
      timestamp: new Date().toISOString()
    };
    
    this.info(`AUTH: ${event}`, authContext);
  }
}

// Export singleton instance
export const logger = SecureLogger.getInstance();

// Legacy compatibility with existing securityLogger
export const securityLogger = {
  logLoginAttempt: (username: string, success: boolean, context?: any) => {
    logger.auth(`Login ${success ? 'successful' : 'failed'}`, {
      username,
      success,
      ...context
    });
  },
  
  logAccountLockout: (username: string, reason: string, duration: number, context?: any) => {
    logger.security('Account locked', {
      username,
      reason,
      lockoutDuration: duration,
      ...context
    });
  },
  
  logSuspiciousActivity: (activity: string, details: Record<string, any>, context?: any) => {
    logger.security(`Suspicious activity: ${activity}`, {
      ...details,
      ...context
    });
  },
  
  error: (event: string, details: Record<string, any>, context?: any) => {
    logger.error(event, { ...details, ...context });
  },
  
  warning: (event: string, details?: Record<string, any>, context?: any) => {
    logger.warn(event, { ...details, ...context });
  },
  
  info: (event: string, details?: Record<string, any>, context?: any) => {
    logger.info(event, { ...details, ...context });
  }
};
