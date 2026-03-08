'use client'

import { useState } from 'react'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useTranslations } from 'next-intl'

interface PriceWithTooltipProps {
    /** Net price in EUR (before VAT) */
    netEur: number
    /** The formatted price string to display (from formatPrice/formatPriceGross) */
    displayPrice: string
    className?: string
}

/**
 * Wraps a price with a hover tooltip showing the breakdown:
 * e.g. "9.02 EUR + 1.98 EUR (22% DDV)"
 */
export default function PriceWithTooltip({ netEur, displayPrice, className }: PriceWithTooltipProps) {
    const { formatPriceBreakdown, isB2B } = useCurrency()
    const tc = useTranslations('common')
    const [show, setShow] = useState(false)

    const bd = formatPriceBreakdown(netEur)
    // For B2C: gross price shown, tooltip shows "net + vat = gross"
    // For B2B: net price shown, tooltip shows "net + vat at checkout"
    const tooltipText = isB2B
        ? `${bd.net} + ${bd.vatAmount} (${bd.vatPercent}% ${tc('vatTerm')})`
        : `${bd.net} + ${bd.vatAmount} (${bd.vatPercent}% ${tc('vatTerm')})`

    return (
        <span
            className={`relative inline-block cursor-help ${className ?? ''}`}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {displayPrice}
            {show && (
                <span className="absolute bottom-full left-0 mb-1.5 z-50 whitespace-nowrap bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none">
                    {tooltipText}
                    <span className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
                </span>
            )}
        </span>
    )
}
