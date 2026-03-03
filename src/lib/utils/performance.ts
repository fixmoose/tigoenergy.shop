import { measurePerformance } from './optimization'
import React from 'react'

// Performance monitoring utilities
export class PerformanceMonitor {
    private static instance: PerformanceMonitor
    private metrics: Map<string, number[]> = new Map()

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor()
        }
        return PerformanceMonitor.instance
    }

    startTimer(name: string): () => void {
        const startTime = performance.now()
        return () => {
            const duration = performance.now() - startTime
            this.recordMetric(name, duration)
            console.debug(`Performance: ${name} took ${duration.toFixed(2)}ms`)
        }
    }

    recordMetric(name: string, value: number) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, [])
        }
        this.metrics.get(name)!.push(value)
    }

    getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
        const result: Record<string, { avg: number; min: number; max: number; count: number }> = {}

        this.metrics.forEach((values, name) => {
            const sum = values.reduce((a, b) => a + b, 0)
            result[name] = {
                avg: sum / values.length,
                min: Math.min(...values),
                max: Math.max(...values),
                count: values.length
            }
        })

        return result
    }

    clearMetrics(): void {
        this.metrics.clear()
    }
}

// Resource loading utilities
export class ResourceLoader {
    private static instance: ResourceLoader
    private loadedResources: Set<string> = new Set()

    static getInstance(): ResourceLoader {
        if (!ResourceLoader.instance) {
            ResourceLoader.instance = new ResourceLoader()
        }
        return ResourceLoader.instance
    }

    async loadScript(src: string, attributes: Record<string, string> = {}): Promise<void> {
        if (this.loadedResources.has(src)) {
            return
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = src
            script.async = true

            Object.entries(attributes).forEach(([key, value]) => {
                script.setAttribute(key, value)
            })

            script.onload = () => {
                this.loadedResources.add(src)
                resolve()
            }

            script.onerror = () => {
                reject(new Error(`Failed to load script: ${src}`))
            }

            document.head.appendChild(script)
        })
    }

    async loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
            img.src = src
        })
    }
}

// Memory management utilities
export class MemoryManager {
    private static instance: MemoryManager
    private cleanupCallbacks: Set<() => void> = new Set()

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager()
        }
        return MemoryManager.instance
    }

    registerCleanup(callback: () => void): void {
        this.cleanupCallbacks.add(callback)
    }

    cleanup(): void {
        this.cleanupCallbacks.forEach(callback => {
            try {
                callback()
            } catch (error) {
                console.error('Cleanup error:', error)
            }
        })
        this.cleanupCallbacks.clear()
    }

    // Force garbage collection hint (not guaranteed to work)
    forceGC(): void {
        if (typeof window !== 'undefined' && (window as any).gc) {
            try {
                ; (window as any).gc()
            } catch (error) {
                console.warn('Garbage collection not available')
            }
        }
    }
}

// Bundle size optimization utilities
export const BundleOptimizer = {
    // Dynamic import wrapper with error handling
    async loadModule<T>(importFn: () => Promise<T>): Promise<T> {
        try {
            return await importFn()
        } catch (error) {
            console.error('Failed to load module:', error)
            throw error
        }
    },

    // Code splitting utility
    createLazyComponent<T extends React.ComponentType<any>>(
        importFn: () => Promise<{ default: T }>
    ): React.FC<React.ComponentProps<T>> {
        return React.lazy(importFn) as React.FC<React.ComponentProps<T>>
    }
}

// Usage examples:
// 
// // Performance monitoring
// const monitor = PerformanceMonitor.getInstance()
// const endTimer = monitor.startTimer('api-call')
// // ... perform operation
// endTimer()
// 
// // Resource loading
// const loader = ResourceLoader.getInstance()
// await loader.loadScript('https://example.com/widget.js')
// 
// // Memory management
// const memoryManager = MemoryManager.getInstance()
// memoryManager.registerCleanup(() => {
//   // Cleanup logic
// })
// 
// // Bundle optimization
// const LazyComponent = BundleOptimizer.createLazyComponent(
//   () => import('./HeavyComponent')
// )