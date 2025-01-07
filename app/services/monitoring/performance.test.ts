import { performanceMonitor } from './performance'
import * as Sentry from '@sentry/react-native'

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  startTransaction: jest.fn(() => ({
    setMeasurement: jest.fn(),
    finish: jest.fn(),
  })),
}))

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    performanceMonitor.clearMetrics()
  })

  describe('mark and measure', () => {
    it('should correctly measure duration between marks', () => {
      performanceMonitor.mark('start')
      
      // Simulate some time passing
      jest.advanceTimersByTime(100)
      
      const duration = performanceMonitor.measure('test', 'start')
      expect(duration).toBeGreaterThan(0)
    })

    it('should throw error for non-existent mark', () => {
      expect(() => {
        performanceMonitor.measure('test', 'nonexistent')
      }).toThrow('Start mark "nonexistent" not found')
    })
  })

  describe('trackScreenLoad', () => {
    it('should track screen load metrics', async () => {
      const screenName = 'TestScreen'
      await performanceMonitor.trackScreenLoad(screenName)

      const metrics = performanceMonitor.getMetrics(screenName)
      expect(metrics).toBeDefined()
      expect(metrics?.timeToInteractive).toBeGreaterThan(0)
      expect(metrics?.renderTime).toBeGreaterThan(0)
    })

    it('should report metrics to Sentry in production', async () => {
      const originalDev = global.__DEV__
      global.__DEV__ = false

      const screenName = 'TestScreen'
      await performanceMonitor.trackScreenLoad(screenName)

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'performance',
          message: `Screen Load: ${screenName}`,
        })
      )

      expect(Sentry.startTransaction).toHaveBeenCalledWith({
        name: `Screen Load: ${screenName}`,
        op: 'navigation',
      })

      global.__DEV__ = originalDev
    })
  })

  describe('metrics management', () => {
    it('should store and retrieve metrics', async () => {
      const screenName = 'TestScreen'
      await performanceMonitor.trackScreenLoad(screenName)

      const metrics = performanceMonitor.getMetrics(screenName)
      expect(metrics).toBeDefined()

      const allMetrics = performanceMonitor.getAllMetrics()
      expect(allMetrics.size).toBe(1)
      expect(allMetrics.get(screenName)).toBeDefined()
    })

    it('should clear all metrics', async () => {
      const screenName = 'TestScreen'
      await performanceMonitor.trackScreenLoad(screenName)
      
      performanceMonitor.clearMetrics()
      
      expect(performanceMonitor.getMetrics(screenName)).toBeUndefined()
      expect(performanceMonitor.getAllMetrics().size).toBe(0)
    })
  })
}) 