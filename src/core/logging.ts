import type { BaseLogger, LevelWithSilent, LevelWithSilentOrString } from 'pino'

export const DefaultLoggerPrefix = 'markdown-manager'

export type LogLevels = LevelWithSilentOrString
export type LoggingApi = BaseLogger & {
  level: LogLevels
  child: (options: { [key: string]: any }) => LoggingApi
}
export type LoggingConfig = {
  loggerPrefix?: string
  logging: boolean | LevelWithSilent | LoggingApi
}

export const DefaultLoggingConfig: LoggingConfig = {
  loggerPrefix: DefaultLoggerPrefix,
  logging: false,
}

export const noOpLogger: LoggingApi = {
  level: 'silent',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  silent: () => {},
  child: () => noOpLogger!,
}

const levelMap: Record<LogLevels, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
}

// a lightweight implementation of the logging api that maps to console.log
// this tries to be *somewhat* smart about how it computes log levels to reduce
// overhead of logging when the log level is set to silent
// it does this by computing the log function on first call and then replacing
// the log function with the computed one
export const consoleLogger: LoggingApi & {
  _type: 'console'
  _level: LogLevels
  _rootLog: Console
  logFn: (level: LogLevels, ...args: any[]) => void
  buildLogFn: (level: LogLevels) => (level: LogLevels, ...args: any[]) => void
} = {
  _type: 'console',
  _level: 'info',
  // we use console as the root log and allows for testing to replace it
  _rootLog: console,
  buildLogFn(level: LogLevels) {
    const mappings: Record<LogLevels, (...args: any) => void> = {
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      silent: () => {},
    }
    for (const key in levelMap) {
      // this is safe because we know that the keys are the log levels 
      const l = key as LogLevels
      if (levelMap[l] >= levelMap[level]) {
        // silent is a special case because we don't want to call console.log, it is a no-op
        if (l === 'silent') {
          mappings[l] = () => {}
        } else {
          // we just cast to any here because we know that the console object has all the log levels but the type mapping is painful
          const consoleAny = consoleLogger._rootLog as any
          // we check if the console has the log level function and if it is a function, if not, fallback to default log
          const consoleFn =
            consoleAny.hasOwnProperty(l) && typeof consoleAny[l] === 'function'
              ? consoleAny[l]
              : (...args: any[]) => this._rootLog.log(...args)
          mappings[l] = consoleFn
        }
      }
    }
    return (level: LogLevels, ...args: any[]) => {
      mappings[level](...args)
    }
  },
  logFn(level: LogLevels, ...args: any[]) {
    // we replace this function with the result of buildLogFn on first call
    const builtFn = consoleLogger.buildLogFn(this._level)
    this.logFn = builtFn
    return builtFn(level, ...args)
  },
  get level() {
    return this._level
  },
  set level(level: LogLevels) {
    this._level = level
    this.logFn = this.buildLogFn(level)
  },
  trace: (...args: any[]) => consoleLogger.logFn('trace', ...args),
  debug: (...args: any[]) => consoleLogger.logFn('debug', ...args),
  info: (...args: any[]) => consoleLogger.logFn('info', ...args),
  warn: (...args: any[]) => consoleLogger.logFn('warn', ...args),
  error: (...args: any[]) => consoleLogger.logFn('error', ...args),
  fatal: (...args: any[]) => consoleLogger.logFn('fatal', ...args),
  silent: () => {},
  child(opts) {
    return {
      level: this.level,
      trace: (...args: any[]) => this.trace(opts, ...args),
      debug: (...args: any[]) => this.debug(opts, ...args),
      info: (...args: any[]) => this.info(opts, ...args),
      warn: (...args: any[]) => this.warn(opts, ...args),
      error: (...args: any[]) => this.error(opts, ...args),
      fatal: (...args: any[]) => this.error(opts, ...args),
      silent: () => {},
      child: (copts) => this.child({ ...opts, ...copts }),
    }
  },
}

let internalLogger: LoggingApi | undefined = undefined

export function getLogger(
  config: LoggingConfig = DefaultLoggingConfig
): LoggingApi {
  if (!internalLogger) {
    if (config.logging === false) {
      internalLogger = {
        level: 'silent',
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        silent: () => {},
        child: () => internalLogger!,
      }
    } else if (config.logging === true) {
      internalLogger = consoleLogger
    } else if (typeof config.logging === 'string') {
      internalLogger = consoleLogger
      consoleLogger.level = config.logging
    } else {
      internalLogger = config.logging
    }
  }
  return internalLogger!
}

// export for testing purposes
export function clearLogger() {
  internalLogger = undefined
}
