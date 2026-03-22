import { useTranslations } from 'next-intl'
import { generateStaticPageMetadata } from '@/lib/utils/static-page-metadata'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
    return generateStaticPageMetadata('terms')
}

export default function TermsOfServicePage() {
    const t = useTranslations('staticPages.terms')

    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-4">{t('title')}</h1>
            <p className="text-sm text-gray-400 mb-8">{t('lastUpdated')}</p>
            <div className="prose max-w-none text-gray-600 space-y-6">
                <p>{t('intro')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hDefinitions')}</h2>
                <p>{t('pDefinitions')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hEligibility')}</h2>
                <p>{t('pEligibility')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hOrders')}</h2>
                <p>{t('pOrders')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hPricing')}</h2>
                <p>{t('pPricing')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hPayment')}</h2>
                <p>{t('pPayment')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hShipping')}</h2>
                <p>{t('pShipping')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hRisk')}</h2>
                <p>{t('pRisk')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hInspection')}</h2>
                <p>{t('pInspection')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hWithdrawal')}</h2>
                <p>{t('pWithdrawal')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hReturns')}</h2>
                <p>{t('pReturns')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hB2B')}</h2>
                <p>{t('pB2B')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hWarranty')}</h2>
                <p>{t('pWarranty')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hLiability')}</h2>
                <p>{t('pLiability')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hIP')}</h2>
                <p>{t('pIP')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hAccuracy')}</h2>
                <p>{t('pAccuracy')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hProhibited')}</h2>
                <p>{t('pProhibited')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hPrivacy')}</h2>
                <p>{t('pPrivacy')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hForce')}</h2>
                <p>{t('pForce')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hGoverning')}</h2>
                <p>{t('pGoverning')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hDispute')}</h2>
                <p>{t('pDispute')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hSeverability')}</h2>
                <p>{t('pSeverability')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hAmendments')}</h2>
                <p>{t('pAmendments')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hEntire')}</h2>
                <p>{t('pEntire')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hContact')}</h2>
                <p>{t('pContact')}</p>
            </div>
        </div>
    )
}
