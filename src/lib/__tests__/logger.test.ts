import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger } from '../logger'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('logs debug messages', () => {
    logger.debug('test debug')
    expect(console.debug).toHaveBeenCalled()
  })

  it('logs info messages', () => {
    logger.info('test info', { key: 'value' })
    expect(console.info).toHaveBeenCalled()
  })

  it('logs warning messages', () => {
    logger.warn('test warn')
    expect(console.warn).toHaveBeenCalled()
  })

  it('logs error messages with error object', () => {
    logger.error('test error', {}, new Error('boom'))
    expect(console.error).toHaveBeenCalled()
  })

  it('logs security events', () => {
    logger.security('unauthorized_access', { ip: '1.2.3.4' })
    expect(console.warn).toHaveBeenCalled()
  })

  it('logs API requests', () => {
    logger.apiRequest('POST', '/api/test', 200, 42)
    expect(console.info).toHaveBeenCalled()
  })

  it('logs 5xx as errors', () => {
    logger.apiRequest('GET', '/api/fail', 500, 100)
    expect(console.error).toHaveBeenCalled()
  })

  it('logs 4xx as warnings', () => {
    logger.apiRequest('GET', '/api/notfound', 404, 50)
    expect(console.warn).toHaveBeenCalled()
  })
})
