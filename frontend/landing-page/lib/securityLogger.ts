// Security logging system for the application
export interface SecurityEvent {
  timestamp: string;
  event: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  sessionId?: string;
}

export interface SecurityMetrics {
  failedLoginAttempts: number;
  successfulLogins: number;
  accountLockouts: number;
  suspiciousActivities: number;
  lastUpdated: string;
}

class SecurityLogger {
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics = {
    failedLoginAttempts: 0,
    successfulLogins: 0,
    accountLockouts: 0,
    suspiciousActivities: 0,
    lastUpdated: new Date().toISOString()
  };

  private maxEvents = 1000; // Keep last 1000 events in memory
  private readonly logLevels = {
    INFO: 0,
    WARNING: 1,
    ERROR: 2,
    CRITICAL: 3
  };

  /**
   * Log a security event
   */
  log(
    event: string,
    level: SecurityEvent['level'] = 'INFO',
    details: Record<string, any> = {},
    context?: {
      userId?: string;
      username?: string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): void {
    const securityEvent: SecurityEvent = {
      timestamp: new Date().toISOString(),
      event,
      level,
      details,
      ...context
    };

    // Add to events array
    this.events.push(securityEvent);
    
    // Keep only last maxEvents
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Update metrics based on event type
    this.updateMetrics(securityEvent);

    // Console logging with structured format
    const logMessage = this.formatLogMessage(securityEvent);
    
    switch (level) {
      case 'CRITICAL':
        console.error(logMessage);
        break;
      case 'ERROR':
        console.error(logMessage);
        break;
      case 'WARNING':
        console.warn(logMessage);
        break;
      default:
        console.log(logMessage);
    }

    // In production, you might want to send to external logging service
    this.sendToExternalService(securityEvent);
  }

  /**
   * Log info level security event
   */
  info(event: string, details?: Record<string, any>, context?: any): void {
    this.log(event, 'INFO', details, context);
  }

  /**
   * Log warning level security event
   */
  warning(event: string, details?: Record<string, any>, context?: any): void {
    this.log(event, 'WARNING', details, context);
  }

  /**
   * Log error level security event
   */
  error(event: string, details?: Record<string, any>, context?: any): void {
    this.log(event, 'ERROR', details, context);
  }

  /**
   * Log critical level security event
   */
  critical(event: string, details?: Record<string, any>, context?: any): void {
    this.log(event, 'CRITICAL', details, context);
  }

  /**
   * Log login attempt
   */
  logLoginAttempt(username: string, success: boolean, context?: any): void {
    const event = success ? 'Login successful' : 'Login failed';
    const level = success ? 'INFO' : 'WARNING';
    
    this.log(event, level, {
      username,
      success,
      attemptType: 'password'
    }, context);
  }

  /**
   * Log account lockout
   */
  logAccountLockout(username: string, reason: string, duration: number, context?: any): void {
    this.log('Account locked', 'WARNING', {
      username,
      reason,
      lockoutDuration: duration,
      lockoutType: 'progressive'
    }, context);
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(activity: string, details: Record<string, any>, context?: any): void {
    this.log(`Suspicious activity: ${activity}`, 'WARNING', details, context);
  }

  /**
   * Log session events
   */
  logSessionEvent(event: string, sessionId: string, details?: Record<string, any>, context?: any): void {
    this.log(`Session: ${event}`, 'INFO', {
      sessionId,
      ...details
    }, context);
  }

  /**
   * Get security metrics
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events by level
   */
  getEventsByLevel(level: SecurityEvent['level']): SecurityEvent[] {
    return this.events.filter(event => event.level === level);
  }

  /**
   * Get events by user
   */
  getEventsByUser(userId: string): SecurityEvent[] {
    return this.events.filter(event => event.userId === userId);
  }

  /**
   * Clear old events (keep only last 100)
   */
  clearOldEvents(): void {
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
  }

  /**
   * Export events for analysis
   */
  exportEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Private methods
   */
  private updateMetrics(event: SecurityEvent): void {
    this.metrics.lastUpdated = new Date().toISOString();

    switch (event.event) {
      case 'Login successful':
        this.metrics.successfulLogins++;
        break;
      case 'Login failed':
        this.metrics.failedLoginAttempts++;
        break;
      case 'Account locked':
        this.metrics.accountLockouts++;
        break;
      default:
        if (event.level === 'WARNING' || event.level === 'ERROR' || event.level === 'CRITICAL') {
          this.metrics.suspiciousActivities++;
        }
    }
  }

  private formatLogMessage(event: SecurityEvent): string {
    const timestamp = new Date(event.timestamp).toLocaleString();
    const context = [
      event.username && `User: ${event.username}`,
      event.ipAddress && `IP: ${event.ipAddress}`,
      event.sessionId && `Session: ${event.sessionId}`
    ].filter(Boolean).join(' | ');

    return `[SECURITY ${event.level}] ${timestamp} | ${event.event} | ${context} | ${JSON.stringify(event.details)}`;
  }

  private sendToExternalService(event: SecurityEvent): void {
    // In production, implement sending to external logging service
    // Examples: LogRocket, Sentry, DataDog, etc.
    
    // For now, just check if we should alert on critical events
    if (event.level === 'CRITICAL') {
      this.sendAlert(event);
    }
  }

  private sendAlert(event: SecurityEvent): void {
    // In production, implement alerting system
    // Examples: Email, Slack, PagerDuty, etc.
    
    console.warn(`🚨 CRITICAL SECURITY ALERT: ${event.event}`, {
      timestamp: event.timestamp,
      details: event.details,
      context: {
        userId: event.userId,
        username: event.username,
        ipAddress: event.ipAddress
      }
    });
  }
}

// Export singleton instance
export const securityLogger = new SecurityLogger();

// Convenience functions for common security events
export const logSecurityEvent = (
  event: string,
  details: Record<string, any> = {},
  context?: any
) => securityLogger.info(event, details, context);

export const logSecurityWarning = (
  event: string,
  details: Record<string, any> = {},
  context?: any
) => securityLogger.warning(event, details, context);

export const logSecurityError = (
  event: string,
  details: Record<string, any> = {},
  context?: any
) => securityLogger.error(event, details, context);

export const logSecurityCritical = (
  event: string,
  details: Record<string, any> = {},
  context?: any
) => securityLogger.critical(event, details, context);
