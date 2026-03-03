// Debounce utility for expensive operations
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null
            func(...args)
        }

        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

// Debounced search utility
export const debouncedSearch = debounce((callback: (...args: any[]) => void, delay: number = 300) => {
    return debounce(callback, delay)
}, 100)

// Memoization utility
export function memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyFn: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args)
): T {
    const cache = new Map<string, ReturnType<T>>()

    return ((...args: Parameters<T>): ReturnType<T> => {
        const key = keyFn(...args)
        if (cache.has(key)) {
            return cache.get(key)!
        }

        const result = fn(...args)
        cache.set(key, result)
        return result
    }) as T
}

// Lazy loading utility
export function lazyLoadImage(img: HTMLImageElement, src: string) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                img.src = src
                observer.unobserve(img)
            }
        })
    })

    imageObserver.observe(img)
}

// Virtualization utility for long lists
export function getVisibleItems<T>(
    items: T[],
    startIndex: number,
    endIndex: number,
    buffer: number = 5
): T[] {
    const start = Math.max(0, startIndex - buffer)
    const end = Math.min(items.length, endIndex + buffer)
    return items.slice(start, end)
}

// Performance monitoring
export function measurePerformance<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    console.debug(`${name}: ${end - start}ms`)
    return result
}

// Batch API calls
export class BatchProcessor<T, R> {
    private queue: Array<{ resolve: (result: R) => void; reject: (error: any) => void; data: T }> = []
    private processing = false
    private batchSize: number
    private delay: number

    constructor(batchSize: number = 10, delay: number = 100) {
        this.batchSize = batchSize
        this.delay = delay
    }

    async process(data: T, processor: (batch: T[]) => Promise<R[]>): Promise<R> {
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject, data })

            if (!this.processing) {
                this.processing = true
                setTimeout(() => this.flush(processor), this.delay)
            }
        })
    }

    private async flush(processor: (batch: T[]) => Promise<R[]>) {
        if (this.queue.length === 0) {
            this.processing = false
            return
        }

        const batch = this.queue.splice(0, this.batchSize)
        const data = batch.map(item => item.data)

        try {
            const results = await processor(data)
            batch.forEach((item, index) => {
                item.resolve(results[index])
            })
        } catch (error) {
            batch.forEach(item => {
                item.reject(error)
            })
        }

        if (this.queue.length > 0) {
            setTimeout(() => this.flush(processor), this.delay)
        } else {
            this.processing = false
        }
    }
}