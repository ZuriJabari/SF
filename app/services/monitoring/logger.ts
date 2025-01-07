import * as Sentry from '@sentry/react-native'

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, any>
  error?: Error
}

class Logger {
  private static instance: Logger
  private logs: LogEntry[] = []
  private readonly maxLogs: number = 1000

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    }
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // In development, log to console
    if (__DEV__) {
      const consoleArgs = [
        `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`,
      ]
      if (entry.context) consoleArgs.push(entry.context)
      if (entry.error) consoleArgs.push(entry.error)

      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(...consoleArgs)
          break
        case LogLevel.INFO:
          console.info(...consoleArgs)
          break
        case LogLevel.WARN:
          console.warn(...consoleArgs)
          break
        case LogLevel.ERROR:
          console.error(...consoleArgs)
          break
      }
    }

    // In production, send to Sentry based on level
    if (!__DEV__) {
      switch (entry.level) {
        case LogLevel.ERROR:
          Sentry.captureException(entry.error || new Error(entry.message), {
            extra: entry.context,
          })
          break
        case LogLevel.WARN:
          Sentry.captureMessage(entry.message, {
            level: 'warning',
            extra: entry.context,
          })
          break
        default:
          Sentry.addBreadcrumb({
            message: entry.message,
            category: entry.level,
            data: entry.context,
            level: entry.level as Sentry.SeverityLevel,
          })
      }
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.addLog(this.createLogEntry(LogLevel.DEBUG, message, context))
  }

  info(message: string, context?: Record<string, any>): void {
    this.addLog(this.createLogEntry(LogLevel.INFO, message, context))
  }

  warn(message: string, context?: Record<string, any>): void {
    this.addLog(this.createLogEntry(LogLevel.WARN, message, context))
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.addLog(this.createLogEntry(LogLevel.ERROR, message, context, error))
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }

  // Utility method to log API requests
  logApiRequest(
    method: string,
    url: string,
    data?: any,
    headers?: Record<string, string>,
  ): void {
    this.debug('API Request', {
      method,
      url,
      data,
      headers: headers ? this.sanitizeHeaders(headers) : undefined,
    })
  }

  // Utility method to log API responses
  logApiResponse(
    method: string,
    url: string,
    status: number,
    data?: any,
    duration?: number,
  ): void {
    const context = {
      method,
      url,
      status,
      data,
      duration,
    }

    if (status >= 400) {
      this.error(`API Error: ${status}`, undefined, context)
    } else {
      this.debug('API Response', context)
    }
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers }
    const sensitiveHeaders = ['authorization', 'cookie', 'x-auth-token']
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]'
      }
    })
    
    return sanitized
  }
}

export const logger = Logger.getInstance() 