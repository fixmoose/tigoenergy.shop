import { useTranslations } from 'next-intl'
import { generateStaticPageMetadata } from '@/lib/utils/static-page-metadata'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
    return generateStaticPageMetadata('privacy')
}

export default function PrivacyPage() {
    const t = useTranslations('staticPages.privacy')

    return (
        <div className="max-w-4xl mx-auto py-16 px-4">
            <h1 className="text-3xl font-bold mb-4">{t('title')}</h1>
            <p className="text-sm text-gray-400 mb-8">{t('lastUpdated')}</p>
            <div className="prose max-w-none text-gray-600 space-y-6">
                <p>{t('intro')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hController')}</h2>
                <p>{t('pController')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hDataCollected')}</h2>
                <p>{t('pDataCollected')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hLegalBasis')}</h2>
                <p>{t('pLegalBasis')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hUsage')}</h2>
                <p>{t('pUsage')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hSharing')}</h2>
                <p>{t('pSharing')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hTransfers')}</h2>
                <p>{t('pTransfers')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hRetention')}</h2>
                <p>{t('pRetention')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hRights')}</h2>
                <p>{t('pRights')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hAutomated')}</h2>
                <p>{t('pAutomated')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hChildren')}</h2>
                <p>{t('pChildren')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hCookiesRef')}</h2>
                <p>{t('pCookiesRef')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hSecurity')}</h2>
                <p>{t('pSecurity')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hChanges')}</h2>
                <p>{t('pChanges')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hDPO')}</h2>
                <p>{t('pDPO')}</p>

                <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">{t('hComplaint')}</h2>
                <p>{t('pComplaint')}</p>
            </div>
        </div>
    )
}
