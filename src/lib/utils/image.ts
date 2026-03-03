import { ImageLoaderProps } from 'next/image'
import { useState, useEffect } from 'react'

// Custom image loader for optimized image serving
export function imageLoader({ src, width, quality }: ImageLoaderProps): string {
    // If it's already a full URL, return as is
    if (src.startsWith('http')) {
        return src
    }

    // For Supabase images, add width and quality parameters
    if (src.includes('supabase.co')) {
        const url = new URL(src)
        url.searchParams.set('width', width.toString())
        url.searchParams.set('quality', (quality || 75).toString())
        return url.toString()
    }

    // For local images, use Next.js built-in loader
    return `${src}?w=${width}&q=${quality || 75}`
}

// Lazy loading hook for images
export function useLazyImage(src: string, fallbackSrc?: string) {
    const [imageSrc, setImageSrc] = useState(fallbackSrc || src)
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        const img = new Image()
        img.src = src
        img.onload = () => {
            setImageSrc(src)
            setIsLoaded(true)
        }
        img.onerror = () => {
            if (fallbackSrc) {
                setImageSrc(fallbackSrc)
            }
        }
    }, [src, fallbackSrc])

    return { imageSrc, isLoaded }
}

// Image optimization utilities
export const IMAGE_FORMATS = {
    WEBP: 'webp',
    AVIF: 'avif',
    JPEG: 'jpeg',
    PNG: 'png'
} as const

export function getOptimizedImageSrc(src: string, format: string = IMAGE_FORMATS.WEBP, quality: number = 75): string {
    if (!src) return ''

    try {
        const url = new URL(src)
        url.searchParams.set('format', format)
        url.searchParams.set('quality', quality.toString())
        return url.toString()
    } catch {
        // If URL parsing fails, append params manually
        const separator = src.includes('?') ? '&' : '?'
        return `${src}${separator}format=${format}&quality=${quality}`
    }
}

// Progressive image loading component props
export interface ProgressiveImageProps {
    src: string
    alt: string
    width?: number
    height?: number
    className?: string
    placeholder?: string
    quality?: number
    priority?: boolean
}