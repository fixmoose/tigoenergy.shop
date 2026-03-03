import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useLazyImage, getOptimizedImageSrc, ProgressiveImageProps } from '@/lib/utils/image'

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
    src,
    alt,
    width,
    height,
    className,
    placeholder,
    quality = 75,
    priority = false
}) => {
    const { imageSrc, isLoaded } = useLazyImage(src, placeholder)
    const [isInView, setIsInView] = useState(false)

    useEffect(() => {
        if (priority) {
            setIsInView(true)
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.1 }
        )

        const imgElement = document.querySelector(`[data-src="${src}"]`)
        if (imgElement) {
            observer.observe(imgElement)
        }

        return () => observer.disconnect()
    }, [src, priority])

    if (!isInView) {
        return (
            <div
                className={className}
                style={{ width, height }}
                data-src={src}
            >
                {placeholder && (
                    <Image
                        src={placeholder}
                        alt={alt}
                        width={width}
                        height={height}
                        className={className}
                        priority={priority}
                    />
                )}
            </div>
        )
    }

    return (
        <Image
            src={getOptimizedImageSrc(imageSrc, 'webp', quality)}
            alt={alt}
            width={width}
            height={height}
            className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            priority={priority}
            style={{
                transition: 'opacity 0.3s ease-in-out',
                objectFit: 'cover'
            }}
        />
    )
}

export default ProgressiveImage