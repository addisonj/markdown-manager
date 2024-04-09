import { describe, it, expect, beforeEach } from 'vitest'
import type { LoggingApi } from './logging.js'
import { clearLogger, getLogger } from './logging.js'

describe('getLogger', () => {
  beforeEach(() => {
    clearLogger()
  })
  it('should return a logger with default configuration if no config is provided', () => {
    const logger = getLogger()
    expect(logger).toBeDefined()
    expect(logger.level).toBe('silent')
  })

  it('should return a logger with silent level if config.logging is set to false', () => {
    const logger = getLogger({ logging: false })
    expect(logger).toBeDefined()
    expect(logger.level).toBe('silent')
  })

  it('should return a logger with consoleLogger if config.logging is set to true', () => {
    const logger = getLogger({ logging: true })
    const clogger = logger as any
    let callCount = 0
    function logFn() {
      callCount++
    }
    clogger._rootLog = {
      log: logFn,
      trace: logFn,
      debug: logFn,
      info: logFn,
      warn: logFn,
      error: logFn,
    }
    expect(logger).toBeDefined()
    expect(clogger._level).toBe('info')
    expect(clogger._type).toBe('console')
    logger.info('test1')
    logger.trace('test2')
    logger.debug('test3')
    logger.level = 'debug'
    logger.debug('test4')
    expect(callCount).toBe(2)
  })

  it('should return a logger with consoleLogger and specified level if config.logging is a string', () => {
    const logger = getLogger({ logging: 'debug' })
    logger.info('test3')
    const clogger = logger as any
    expect(logger).toBeDefined()
    expect(clogger._level).toBe('debug')
  })

  it('should return the provided logger if config.logging is an object', () => {
    let loggerCalled = false
    function logFn() {
      loggerCalled = true
    }
    const customLogger: LoggingApi = {
      level: 'info',
      trace: logFn,
      debug: logFn,
      info: logFn,
      warn: logFn,
      error: logFn,
      fatal: logFn,
      silent: logFn,
      child: () => customLogger,
    }
    const logger = getLogger({ logging: customLogger })
    logger.info('test')
    expect(logger).toBeDefined()
    expect(logger).toBe(customLogger)
    expect(loggerCalled).toBe(true)
  })
})
