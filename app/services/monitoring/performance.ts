import { InteractionManager, Platform } from 'react-native'
import * as Sentry from '@sentry/react-native'
import { useEffect } from 'react'

interface PerformanceMetrics {
  timeToInteractive: number
  renderTime: number
  memoryUsage?: number
  batteryLevel?: number
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, PerformanceMetrics>
  private marks: Map<string, number>

  private constructor() {
    this.metrics = new Map()
    this.marks = new Map()
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  mark(name: string): void {
    this.marks.set(name, performance.now())
  }

  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark)
    if (!start) {
      throw new Error(`Start mark "${startMark}" not found`)
    }
    const duration = performance.now() - start
    return duration
  }

  async trackScreenLoad(screenName: string): Promise<void> {
    const startTime = performance.now()

    await InteractionManager.runAfterInteractions(() => {
      const endTime = performance.now()
      const timeToInteractive = endTime - startTime

      const metrics: PerformanceMetrics = {
        timeToInteractive,
        renderTime: timeToInteractive, // Simplified for now
      }

      this.metrics.set(screenName, metrics)

      // Report to Sentry
      if (!__DEV__) {
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Screen Load: ${screenName}`,
          data: metrics,
          level: 'info',
        })

        // Create a performance transaction
        const transaction = Sentry.startTransaction({
          name: `Screen Load: ${screenName}`,
          op: 'navigation',
        })

        transaction.setMeasurement('timeToInteractive', timeToInteractive, 'millisecond')
        transaction.setMeasurement('renderTime', metrics.renderTime, 'millisecond')

        transaction.finish()
      }
    })
  }

  getMetrics(screenName: string): PerformanceMetrics | undefined {
    return this.metrics.get(screenName)
  }

  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics)
  }

  clearMetrics(): void {
    this.metrics.clear()
    this.marks.clear()
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()

// Hook for React components
export function useTrackScreenLoad(screenName: string): void {
  useEffect(() => {
    performanceMonitor.trackScreenLoad(screenName)
  }, [screenName])
} 