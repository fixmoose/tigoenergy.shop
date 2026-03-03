import React, { useState, useEffect, useMemo } from 'react'
import { getVisibleItems } from '@/lib/utils/optimization'

interface VirtualizedListProps<T> {
    items: T[]
    itemHeight: number
    containerHeight: number
    renderItem: (item: T, index: number) => React.ReactNode
    keyExtractor: (item: T, index: number) => string
    overscan?: number
}

const VirtualizedList = <T,>({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    keyExtractor,
    overscan = 5
}: VirtualizedListProps<T>) => {
    const [scrollTop, setScrollTop] = useState(0)
    const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null)

    const totalHeight = items.length * itemHeight
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2)

    const visibleItems = useMemo(() => {
        return getVisibleItems(items, startIndex, endIndex, overscan)
    }, [items, startIndex, endIndex, overscan])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop)
    }

    useEffect(() => {
        if (containerRef) {
            setScrollTop(0)
        }
    }, [items.length, containerRef])

    return (
        <div
            ref={setContainerRef}
            style={{ height: containerHeight, overflow: 'auto' }}
            onScroll={handleScroll}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${startIndex * itemHeight}px)` }}>
                    {visibleItems.map((item, index) => (
                        <div
                            key={keyExtractor(item, startIndex + index)}
                            style={{ height: itemHeight }}
                        >
                            {renderItem(item, startIndex + index)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default VirtualizedList