import { useTranslations } from 'next-intl'
import SupportMessagingWindow from '@/components/support/SupportMessagingWindow'

export default function ShopSupportPage() {
    const t = useTranslations('staticPages.shopSupport')

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
                    <p className="text-gray-600">{t('intro')}</p>
                </div>

                <SupportMessagingWindow type="shipping" title={t('title')} />
            </div>
        </div>
    )
}
