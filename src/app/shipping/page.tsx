import { useTranslations } from 'next-intl'
import { generateStaticPageMetadata } from '@/lib/utils/static-page-metadata'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
    return generateStaticPageMetadata('shipping')
}

export default function ShippingPage() {
    const t = useTranslations('staticPages.shipping')

    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>
            <div className="prose max-w-none text-gray-600">
                <p>{t('pLead')}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('hDeliveryTimes')}</h2>
                <p>{t('pDeliveryTimes')}</p>
                <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-4">{t('hCarriers')}</h2>
                <p>{t('pCarriers')}</p>
            </div>
        </div>
    )
}
